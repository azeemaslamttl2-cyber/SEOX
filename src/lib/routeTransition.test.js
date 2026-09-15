import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

/**
 * The module reads `window` and `document` at call time, not at import time, so
 * a minimal stub installed before each test is enough - no DOM library needed.
 * `#app-boot` is modelled as a single removable node, which is all the boot
 * handover depends on.
 */
function installDom({ withBootNode = true } = {}) {
  const bootNode = { removed: false, remove() { this.removed = true; } };

  globalThis.window = {
    location: { pathname: '/local-seo/gbp', search: '' },
    __appBootTimeout: withBootNode ? 1 : null,
    // The module dates the minimum-visible floor from first-contentful-paint,
    // so the stub has to report one. "Painted just now" keeps the floor fully
    // in play, which is what the timing assertions below are about.
    performance: {
      now: () => 0,
      getEntriesByType: () => [{ name: 'first-contentful-paint', startTime: 0 }],
    },
  };
  globalThis.document = {
    getElementById: (id) =>
      id === 'app-boot' && withBootNode && !bootNode.removed ? bootNode : null,
  };

  return bootNode;
}

function uninstallDom() {
  delete globalThis.window;
  delete globalThis.document;
}

/**
 * Fresh module instance per test, so the one-shot boot flag cannot leak.
 * Tracked so the timers it arms can be cleared afterwards - a live safety timer
 * would otherwise hold the test runner open for its full 15 seconds.
 */
let loaded = null;
async function loadModule() {
  loaded = await import(`./routeTransition.js?t=${Math.random()}`);
  return loaded;
}

function teardown() {
  if (loaded) loaded.resetRouteTransition();
  loaded = null;
  uninstallDom();
}

/**
 * The loader is held on screen for a minimum time, so hiding is asynchronous
 * even when the route is ready at once. Resolves with how long it took.
 */
function whenHidden(mod, timeout = 3000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    if (!mod.getRouteTransitionState().visible) {
      resolve(Date.now() - started);
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('the loader never hid'));
    }, timeout);
    const unsubscribe = mod.subscribeRouteTransition(() => {
      if (mod.getRouteTransitionState().visible) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(Date.now() - started);
    });
  });
}

describe('routeTransition initial load', () => {
  let bootNode;

  beforeEach(() => {
    bootNode = installDom();
  });

  afterEach(teardown);

  it('is pending and visible from the moment the bundle runs', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();

    const state = mod.getRouteTransitionState();
    assert.equal(state.pending, true);
    assert.equal(state.visible, true, 'a reload must show the loader with no delay');
    assert.equal(state.boot, true);
    assert.equal(state.path, '/local-seo/gbp');
  });

  it('hides and removes the boot node once the route commits', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.endRouteTransition('/local-seo/gbp');
    await whenHidden(mod);

    assert.equal(mod.getRouteTransitionState().visible, false);
    assert.equal(mod.getRouteTransitionState().boot, false);
    assert.equal(bootNode.removed, true, 'the static loader must not outlive the app');
    assert.equal(globalThis.window.__appBootTimeout, null, 'the fail-safe timer is cancelled');
  });

  it('counts the floor from the paint, not from when the bundle ran', async () => {
    uninstallDom();
    const bootNode = installDom();
    // The loader has already been up for a second by the time this module runs,
    // which is the normal case: the document paints it long before the entry
    // chunk executes. Charging the floor again on top is what made every reload
    // feel slower, so there must be nothing left to wait for.
    globalThis.window.performance = {
      now: () => 1000,
      getEntriesByType: () => [{ name: 'first-contentful-paint', startTime: 0 }],
    };
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.endRouteTransition('/local-seo/gbp');
    const elapsed = await whenHidden(mod);

    assert.ok(elapsed < 150, `the floor was charged twice: waited a further ${elapsed}ms`);
    assert.equal(bootNode.removed, true);
  });

  it('stays on screen long enough to be seen when the route is instant', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.endRouteTransition('/local-seo/gbp');
    const elapsed = await whenHidden(mod);

    // The regression this guards: a route that commits in single-digit
    // milliseconds used to take the loader with it, so a warm reload showed
    // nothing at all. Loose lower bound - only the order of magnitude matters.
    assert.ok(elapsed >= 120, `the loader was only up for ${elapsed}ms`);
  });

  it('runs only once, so a second call cannot restart a finished load', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.endRouteTransition('/local-seo/gbp');
    await whenHidden(mod);
    mod.beginInitialLoad();

    assert.equal(mod.getRouteTransitionState().pending, false);
  });

  it('does nothing when the page was served without the boot markup', async () => {
    uninstallDom();
    installDom({ withBootNode: false });
    const mod = await loadModule();

    mod.beginInitialLoad();

    assert.equal(mod.getRouteTransitionState().pending, false);
  });

  it('stays up across a redirect out of a route guard', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    // <Navigate to="/login" replace/> runs before the ready signal for the
    // route it replaced, so that stale signal must not take the loader down.
    mod.startRouteTransition('/login');
    mod.endRouteTransition('/local-seo/gbp');

    assert.equal(mod.getRouteTransitionState().visible, true, 'the redirect target is still loading');
    assert.equal(bootNode.removed, false);

    mod.endRouteTransition('/login');
    await whenHidden(mod);
    assert.equal(bootNode.removed, true);
  });
});

describe('routeTransition required-data holds', () => {
  let bootNode;

  beforeEach(() => {
    bootNode = installDom();
  });

  afterEach(teardown);

  it('keeps the loader up after commit while required data is in flight', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    const release = mod.holdGlobalLoader('gbp-connect');
    mod.endRouteTransition('/local-seo/gbp');

    assert.equal(
      mod.getRouteTransitionState().visible,
      true,
      'mounting is not ready - the page is still empty'
    );
    assert.equal(bootNode.removed, false);

    release();
    await whenHidden(mod);
    assert.equal(bootNode.removed, true);
  });

  it('lifts on a failed request, because the hold releases either way', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    const release = mod.holdGlobalLoader('gbp-connect');
    mod.endRouteTransition('/local-seo/gbp');

    // What the page's `finally` does after the status request rejects.
    release();

    await assert.doesNotReject(whenHidden(mod), 'a failure must not spin for ever');
  });

  it('waits for the last of several holds', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    const releaseA = mod.holdGlobalLoader('a');
    const releaseB = mod.holdGlobalLoader('b');
    mod.endRouteTransition('/local-seo/gbp');

    releaseA();
    assert.equal(mod.getRouteTransitionState().visible, true);
    releaseB();
    await whenHidden(mod);
  });

  it('ignores a repeated release, so one holder cannot clear another', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    const releaseA = mod.holdGlobalLoader('a');
    releaseA();
    releaseA();
    const releaseB = mod.holdGlobalLoader('b');
    mod.endRouteTransition('/local-seo/gbp');

    assert.equal(mod.getRouteTransitionState().visible, true);
    releaseB();
    await whenHidden(mod);
  });

  it('survives a hold changing hands inside one React commit', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    // The Suspense fallback waiting for the page chunk.
    const releaseFallback = mod.holdGlobalLoader('route-outlet-fallback');
    mod.endRouteTransition('/local-seo/gbp');

    // React runs the unmounting fallback's cleanup before the page it was
    // waiting for registers its own hold, so for an instant nothing is held.
    releaseFallback();
    const pageHold = mod.holdGlobalLoader('gbp-connect');

    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(
      mod.getRouteTransitionState().visible,
      true,
      'the loader must not lift in the gap between the two holders'
    );

    pageHold();
    await whenHidden(mod);
  });

  it('drops holds left behind by the outgoing route', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.holdGlobalLoader('never-released');
    mod.startRouteTransition('/dashboard');
    mod.endRouteTransition('/dashboard');

    await assert.doesNotReject(
      whenHidden(mod),
      'a stale hold must not follow the user to the next page'
    );
  });

  it('takes no hold once the load has finished', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.endRouteTransition('/local-seo/gbp');
    await whenHidden(mod);
    mod.holdGlobalLoader('late');

    assert.equal(
      mod.getRouteTransitionState().visible,
      false,
      'a page mounting later must not re-show the loader'
    );
  });

  it('releases every hold when the safety net gives up', async () => {
    const mod = await loadModule();

    mod.beginInitialLoad();
    mod.holdGlobalLoader('wedged');
    mod.endRouteTransition('/local-seo/gbp', { immediate: true });

    assert.equal(mod.getRouteTransitionState().visible, false);
    assert.equal(bootNode.removed, true);
  });
});
