import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  fetchIfNeeded,
  getSnapshot,
  setData as writeData,
  invalidate as invalidateKey,
  subscribe,
} from '../lib/projectDataStore.js';
import { useProjectSelection } from '../context/CrawlContext.jsx';

/**
 * Reads one slice of the selected project's data, fetching it only when the
 * cache cannot answer.
 *
 * `useSyncExternalStore` is what makes this cheap: the component subscribes to
 * its own `projectId + dataKey` slot, so another page filling a different key -
 * or the crawl ticking - cannot re-render it. That is the selector-level
 * granularity a single large context cannot give, without adding Redux.
 *
 * Returns the same shape whatever the source:
 *
 *   { data, status, error, isLoading, isStale, refresh, setData }
 *
 * `status` is 'idle' | 'loading' | 'refreshing' | 'success' | 'error'.
 * `isLoading` is true only when there is nothing to show yet, so a page can
 * render cached data immediately and let a background refresh stay invisible -
 * the same rule `usePageLoading` already applies to the project list.
 *
 * @param {string} dataKey     stable identifier, e.g. 'gbp:locations'
 * @param {Function} fetcher   called with (projectId) when a fetch is needed
 * @param {object}  [options]
 * @param {number}  [options.staleTime] ms the value stays fresh (default 10 min)
 * @param {boolean} [options.enabled]   set false to hold the fetch back
 * @param {string}  [options.projectId] override the selected project
 */
export function useProjectData(dataKey, fetcher, options = {}) {
  const { staleTime = 10 * 60 * 1000, enabled = true, projectId: projectIdOverride } = options;

  const { project } = useProjectSelection();
  const projectId = String(projectIdOverride || project?.id || '');

  // The fetcher is nearly always an inline arrow, so a new identity every
  // render. Held in a ref so it never becomes a reason to refetch - the cache
  // key is (projectId, dataKey), and that is what should drive requests.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const snapshot = useSyncExternalStore(
    useCallback((listener) => subscribe(projectId, dataKey, listener), [projectId, dataKey]),
    useCallback(() => getSnapshot(projectId, dataKey), [projectId, dataKey]),
    useCallback(() => getSnapshot(projectId, dataKey), [projectId, dataKey])
  );

  useEffect(() => {
    if (!enabled || !projectId || !dataKey) return;
    // Rejections are already recorded on the entry as `error`; swallowing here
    // only stops an unhandled rejection from reaching the console.
    fetchIfNeeded(projectId, dataKey, () => fetcherRef.current(projectId), { staleTime }).catch(() => {});
  }, [dataKey, enabled, projectId, staleTime]);

  const refresh = useCallback(
    () =>
      fetchIfNeeded(projectId, dataKey, () => fetcherRef.current(projectId), {
        staleTime,
        force: true,
      }),
    [dataKey, projectId, staleTime]
  );

  const setData = useCallback(
    (value) => writeData(projectId, dataKey, value, { staleTime }),
    [dataKey, projectId, staleTime]
  );

  const invalidate = useCallback(() => invalidateKey(projectId, dataKey), [dataKey, projectId]);

  return {
    data: snapshot.data,
    status: snapshot.status,
    error: snapshot.error,
    // Only true when there is nothing to render yet. A refresh over existing
    // data is not a loading state.
    isLoading: snapshot.status === 'loading',
    isRefreshing: snapshot.status === 'refreshing',
    isStale: snapshot.isStale,
    lastFetched: snapshot.lastFetched,
    refresh,
    setData,
    invalidate,
  };
}
