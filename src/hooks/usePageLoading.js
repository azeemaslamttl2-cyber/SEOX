import { useEffect, useState } from "react";

/**
 * Decides what a data-gated page should show. Pure, so the rules can be tested
 * without a renderer.
 *
 * The rule that matters: a full-page loader is for when the page cannot be
 * drawn at all. If the data is already in hand - served from the projects
 * cache, or left over from a previous visit - the page renders immediately and
 * any background refresh stays invisible. `ProjectsContext` flips `loading`
 * true on every mount even when it resolves straight from the cache, so gating
 * on `loading` alone would blank a page that had everything it needed.
 *
 *   hasData        -> the page, always (a refresh in flight is not a loader)
 *   error, no data -> the error state, with a retry
 *   loading        -> the loader, but only once it has been slow enough to see
 *
 * `showContent` stays true when nothing is pending and nothing failed, so an
 * empty-but-loaded page renders its own empty state rather than spinning.
 */
export function resolvePageState({ loading = false, hasData = false, error = null, slow = false }) {
  const pending = Boolean(loading) && !hasData;
  const showLoader = pending && slow;
  // An error only takes over when there is nothing to show instead: a failed
  // background refresh must not throw away content already on screen.
  const showError = Boolean(error) && !hasData && !pending;

  return {
    pending,
    showLoader,
    showError,
    showContent: hasData || (!pending && !showError),
  };
}

/**
 * React binding for {@link resolvePageState}. Holds the loader back for `delay`
 * ms so a cache hit or a fast request never flashes a spinner.
 *
 * @returns {{pending: boolean, showLoader: boolean, showError: boolean, showContent: boolean}}
 */
export function usePageLoading({ loading = false, hasData = false, error = null, delay = 200 } = {}) {
  const pending = Boolean(loading) && !hasData;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) {
      // Reset, so the next wait starts its own delay instead of painting at once.
      setSlow(false);
      return undefined;
    }
    if (delay === 0) {
      setSlow(true);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), delay);
    return () => clearTimeout(timer);
  }, [pending, delay]);

  return resolvePageState({ loading, hasData, error, slow });
}
