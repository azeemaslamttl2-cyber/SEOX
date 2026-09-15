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
 */

/** Held back this long so an instant navigation never flashes a spinner. */
const SHOW_DELAY_MS = 120;
/** Once shown, stays at least this long, so it cannot blink out. */
const MIN_VISIBLE_MS = 350;
/** Last-resort release, so a wedged navigation can never strand the loader. */
const SAFETY_TIMEOUT_MS = 15000;

const listeners = new Set();

let state = { pending: false, visible: false, path: null };
let showTimer = null;
let hideTimer = null;
let safetyTimer = null;
let shownAt = 0;
let installed = false;

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
    merged.path === state.path
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

/** Current snapshot. Stable reference until something changes. */
export function getRouteTransitionState() {
  return state;
}

export function subscribeRouteTransition(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
  setState({ pending: true, path });

  showTimer = setTimeout(() => {
    if (!state.pending) return;
    shownAt = Date.now();
    setState({ visible: true });
  }, SHOW_DELAY_MS);

  safetyTimer = setTimeout(() => {
    endRouteTransition(path, { immediate: true });
  }, SAFETY_TIMEOUT_MS);
}

/**
 * The destination committed (or failed). Clearing respects a minimum visible
 * time so a loader that did appear does not blink straight out again.
 */
export function endRouteTransition(path, { immediate = false } = {}) {
  if (!state.pending) return;
  // A stale signal from a route we already navigated away from is ignored.
  if (path && state.path && path !== state.path) return;

  clearTimers();

  if (!state.visible || immediate) {
    setState({ pending: false, visible: false, path: null });
    return;
  }

  const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  if (remaining === 0) {
    setState({ pending: false, visible: false, path: null });
    return;
  }
  setState({ pending: false });
  hideTimer = setTimeout(() => setState({ visible: false, path: null }), remaining);
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
  state = { pending: false, visible: false, path: null };
  shownAt = 0;
}
