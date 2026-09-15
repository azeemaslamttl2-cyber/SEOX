/**
 * Route-transition state for the global navigation loader.
 *
 * Why this exists rather than a plain `<Suspense>` fallback:
 *
 * React Router 7 wraps every navigation in `React.startTransition`. During a
 * transition React deliberately keeps the *current* UI on screen and does not
 * render the fallback of an already-mounted Suspense boundary. So navigating
 * between two lazy routes inside the same layout - `/content/nlp` to
 * `/content/grammar` - showed the old page until the new chunk arrived, with no
 * loader at all. Measured: the boundary never even mounted across a 2.5s chunk
 * delay.
 *
 * The transition belongs to the router, so `useTransition`'s `isPending` is not
 * available to us, and `useNavigation()` needs a data router (this app uses the
 * declarative `<BrowserRouter>`). What *is* available is that the URL changes
 * synchronously, before the transition commits. So navigation start is detected
 * from history itself, outside React, and the pending flag is set with a normal
 * state update that commits immediately.
 *
 * It is cleared when the destination actually commits - an effect inside the
 * routed subtree - not when the URL changes. A route whose chunk is still
 * downloading keeps the loader up.
 *
 * A module store (read through `useSyncExternalStore`) rather than a context,
 * matching `projectDataStore`: the error boundary is a class component and can
 * clear the flag without any context plumbing.
 *
 * ---------------------------------------------------------------------------
 * Initial page load
 *
 * A browser reload fires none of pushState / replaceState / popstate, so the
 * watcher below cannot see it and the overlay stayed hidden for the whole of a
 * refresh - the reason the loader appeared when clicking a link but not when
 * reloading. The initial load is therefore started explicitly, by
 * `beginInitialLoad()`, and it is rendered by the static `#app-boot` node in
 * index.html rather than by React, because React does not exist yet at the
 * moment it has to be on screen. This module owns that node's removal, which
 * keeps one concept of "the app is loading" instead of two.
 *
 * ---------------------------------------------------------------------------
 * Required data
 *
 * A route committing means the page is mounted, not that it is usable. A page
 * with data it genuinely cannot render without takes a hold (see
 * `holdGlobalLoader`, and `useGlobalLoadingHold` for the React binding); the
 * loader then survives the commit and lifts when the last hold is released.
 * Holds are opt-in on purpose - a background or optional request must not keep
 * the loader up. Every hold releases on failure as well as on success, and
 * carries its own timeout, so a rejected request cannot strand the loader.
 */

/** Held back this long so an instant navigation never flashes a spinner. */
const SHOW_DELAY_MS = 120;
/** Once shown, stays at least this long, so it cannot blink out. */
const MIN_VISIBLE_MS = 350;
/**
 * Floor for the initial load specifically, counted from the paint that put the
 * loader on screen rather than from the moment this module ran.
 *
 * It is a real cost, so it is set deliberately rather than generously. On this
 * app the shell paints only ~50ms after the loader does - both wait on the same
 * render-blocking stylesheet - so without a floor the loader is a flicker
 * nobody registers, and with a large one it sits on top of a shell that is
 * ready underneath. Measured on the built app: a 400ms floor cost ~370ms of
 * that, on every route and every network profile, which is what made reloads
 * feel slow. This is the compromise, and it is the one number to change if the
 * balance is wrong - raise it to make the loader more insistent, drop it to 0
 * to let every page paint the instant it can.
 */
const BOOT_MIN_VISIBLE_MS = 150;

/**
 * When the boot loader actually appeared, as a `Date.now()` value.
 *
 * The browser paints it before any of this code exists, so "how long has it
 * been up" cannot be measured from module scope - an earlier attempt did
 * exactly that and charged every reload the full floor on top of a shell that
 * was already painted underneath, which made the whole app feel slower.
 * First-contentful-paint is the real answer.
 *
 * Deliberately read when the loader is about to come down rather than when it
 * went up: the render-blocking stylesheet means the entry chunk often executes
 * *before* the first paint, so at `beginInitialLoad()` there is no paint entry
 * yet and the fallback silently dates the loader to navigation start - which
 * over-credits it and lets the floor expire before the loader has really been
 * seen. By the time anything wants to hide it, the entry exists.
 */
function bootShownAt() {
  try {
    const timing = window.performance;
    const paint = timing
      .getEntriesByType('paint')
      .find((entry) => entry.name === 'first-contentful-paint');
    if (!paint) return shownAt;
    return Date.now() - (timing.now() - paint.startTime);
  } catch {
    return shownAt;
  }
}
/** Last-resort release, so a wedged navigation can never strand the loader. */
const SAFETY_TIMEOUT_MS = 15000;
/** Independent cap per data hold, for a page that never releases its own. */
const HOLD_TIMEOUT_MS = 20000;

const listeners = new Set();

let state = { pending: false, visible: false, path: null, boot: false };
let showTimer = null;
let hideTimer = null;
let safetyTimer = null;
let shownAt = 0;
let installed = false;
let bootStarted = false;
/** The destination has rendered. Distinct from `pending`, which holds data too. */
let committed = false;
/** key -> timeout id. Non-empty means something required is still in flight. */
const holds = new Map();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // One bad subscriber must not stop the others being told.
    }
  });
}

function setState(next) {
  const merged = { ...state, ...next };
  if (
    merged.pending === state.pending &&
    merged.visible === state.visible &&
    merged.path === state.path &&
    merged.boot === state.boot
  ) {
    return;
  }
  state = merged;
  emit();
}

function clearTimers() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  clearTimeout(safetyTimer);
  showTimer = null;
  hideTimer = null;
  safetyTimer = null;
}

function releaseAllHolds() {
  holds.forEach((timer) => clearTimeout(timer));
  holds.clear();
}

/**
 * Takes down the static boot node from index.html and cancels its own
 * fail-safe timer. Idempotent: the node may already be gone, either because
 * that timer fired or because this ran once already.
 */
function removeBootNode() {
  if (typeof document === 'undefined') return;
  if (typeof window !== 'undefined' && window.__appBootTimeout) {
    clearTimeout(window.__appBootTimeout);
    window.__appBootTimeout = null;
  }
  const node = document.getElementById('app-boot');
  if (node) node.remove();
}

/** Current snapshot. Stable reference until something changes. */
export function getRouteTransitionState() {
  return state;
}

export function subscribeRouteTransition(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The very first load of the application - a reload, a hard refresh, a pasted
 * URL, a new tab. Called once from the module scope of App.jsx, so it runs
 * before the router mounts and before any route can signal ready.
 *
 * There is no show delay: the loader is already painted by index.html, and the
 * whole point is that it is continuously on screen from the first frame.
 */
export function beginInitialLoad() {
  if (bootStarted || typeof window === 'undefined') return;
  bootStarted = true;

  // Nothing to take over if the fail-safe already fired, or if the page was
  // served without the boot markup. Treat the app as already visible.
  if (typeof document !== 'undefined' && !document.getElementById('app-boot')) return;

  committed = false;
  // Provisional: `finish()` re-reads it from the paint timeline, which is only
  // populated later.
  shownAt = Date.now();
  setState({
    pending: true,
    visible: true,
    boot: true,
    path: window.location.pathname + window.location.search,
  });

  safetyTimer = setTimeout(() => {
    endRouteTransition(state.path, { immediate: true });
  }, SAFETY_TIMEOUT_MS);
}

/**
 * Registers something the page cannot be considered ready without. Returns the
 * release function; call it in both the success and the failure path - a
 * `finally`, or an effect cleanup via `useGlobalLoadingHold`.
 *
 * @param {string} key unique per holder, so remounts cannot leak a hold
 * @returns {() => void} release
 */
export function holdGlobalLoader(key) {
  if (!state.pending) return () => {};

  const id = key || `hold:${holds.size + 1}`;
  clearTimeout(holds.get(id));
  // A required request that never settles must not outlast this.
  holds.set(
    id,
    setTimeout(() => releaseGlobalLoader(id), HOLD_TIMEOUT_MS)
  );

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseGlobalLoader(id);
  };
}

function releaseGlobalLoader(id) {
  const timer = holds.get(id);
  if (timer === undefined) return;
  clearTimeout(timer);
  holds.delete(id);
  if (committed && holds.size === 0) finish();
}

/** Hides the loader, if the route has committed and nothing required is left. */
function finish({ immediate = false } = {}) {
  if (!committed || holds.size > 0) return;

  clearTimers();

  const done = () => {
    if (state.boot) removeBootNode();
    setState({ pending: false, visible: false, path: null, boot: false });
  };

  if (immediate) {
    done();
    return;
  }

  const floor = state.boot ? BOOT_MIN_VISIBLE_MS : MIN_VISIBLE_MS;
  const since = state.boot ? bootShownAt() : shownAt;
  const remaining = state.visible ? Math.max(0, floor - (Date.now() - since)) : 0;

  // Deferred even when there is nothing left to wait for, because holds change
  // hands inside a single React commit: the Suspense fallback that was waiting
  // for a page chunk unmounts and releases, and the page it was waiting for
  // mounts and takes its own, with React running the release first. Hiding
  // synchronously in between would lift the loader in that gap. A timer runs
  // after the whole effect flush, so the successor is already registered.
  //
  // `pending` deliberately stays true until then: `holdGlobalLoader` refuses a
  // hold once the load is over, and the successor must not be refused here.
  hideTimer = setTimeout(() => {
    if (holds.size > 0) return;
    done();
  }, remaining);
}

/**
 * A navigation has started. Called from the history patch below, so it runs
 * synchronously on click - outside the router transition that would otherwise
 * defer it.
 */
export function startRouteTransition(path) {
  // Re-navigating to the same path renders nothing new; no loader for it.
  if (state.pending && state.path === path) return;

  clearTimers();
  // Holds belong to the route that registered them. The outgoing page releases
  // its own on unmount, but dropping them here means a page that failed to
  // clean up cannot hold the loader over a route it no longer owns.
  releaseAllHolds();
  committed = false;

  // A redirect during the initial load - <Navigate replace/> out of a guard -
  // swaps the destination while the boot loader is still the thing on screen.
  // Keep it up and keep owning it; only the path has changed.
  const wasBoot = state.boot;
  setState({ pending: true, path, visible: wasBoot ? true : state.visible });

  if (!wasBoot) {
    showTimer = setTimeout(() => {
      if (!state.pending) return;
      shownAt = Date.now();
      setState({ visible: true });
    }, SHOW_DELAY_MS);
  }

  safetyTimer = setTimeout(() => {
    endRouteTransition(path, { immediate: true });
  }, SAFETY_TIMEOUT_MS);
}

/**
 * The destination committed (or failed). Clearing respects a minimum visible
 * time so a loader that did appear does not blink straight out again, and waits
 * on any required data the page declared.
 */
export function endRouteTransition(path, { immediate = false } = {}) {
  if (!state.pending) return;
  // A stale signal from a route we already navigated away from is ignored.
  if (path && state.path && path !== state.path) return;

  committed = true;
  // The safety net fired, or an error boundary is giving up: nothing is worth
  // waiting for any more.
  if (immediate) releaseAllHolds();

  finish({ immediate });
}

/**
 * Watches history for navigation starts.
 *
 * `pushState` / `replaceState` are patched because React Router calls them
 * synchronously while the transition that renders the new page is still
 * pending - that is precisely the moment the loader needs to appear.
 * Idempotent, so a double import or a fast-refresh cycle cannot stack patches.
 */
export function installRouteTransitionWatcher() {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;

  const { pushState, replaceState } = window.history;

  const currentPath = () => window.location.pathname + window.location.search;

  window.history.pushState = function patchedPushState(...args) {
    const before = currentPath();
    const result = pushState.apply(this, args);
    const after = currentPath();
    if (after !== before) startRouteTransition(after);
    return result;
  };

  // replaceState is used for redirects (<Navigate replace/>), which also swap
  // the rendered route.
  window.history.replaceState = function patchedReplaceState(...args) {
    const before = currentPath();
    const result = replaceState.apply(this, args);
    const after = currentPath();
    if (after !== before) startRouteTransition(after);
    return result;
  };

  const onPopState = () => startRouteTransition(currentPath());
  window.addEventListener('popstate', onPopState);

  return () => {
    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
    window.removeEventListener('popstate', onPopState);
    clearTimers();
    installed = false;
  };
}

/** Test helper. Not used by application code. */
export function resetRouteTransition() {
  clearTimers();
  releaseAllHolds();
  state = { pending: false, visible: false, path: null, boot: false };
  shownAt = 0;
  committed = false;
  bootStarted = false;
}
