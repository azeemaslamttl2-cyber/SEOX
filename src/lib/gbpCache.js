import { fetchIfNeeded, invalidate } from './projectDataStore.js';
import { getConnectionStatus, listAttachedLocations } from './gbpApi.js';

/**
 * Cached reads for the two Business Profile endpoints every GBP screen needs.
 *
 * The connection status and the attached locations are the same for the whole
 * section, but `GbpConnect`, `GbpOverview` and the dashboard's `GbpCard` each
 * called the API directly on mount. Measured over a five-step walk through the
 * section: `POST /api/gbp/connect` four times and `GET /api/gbp/locations` five
 * times, for data that had not changed.
 *
 * These go through `projectDataStore`, so all callers share one entry per
 * project - including `useGbpLocation`, which reads the same
 * `gbp:locations` key through `useProjectData`. Whichever screen asks first
 * pays for the request; the rest read it from memory. Concurrent callers share
 * one in-flight promise.
 *
 * Deliberately NOT wrapped inside `gbpApi.js` itself: `useProjectData` already
 * calls `listAttachedLocations` as its fetcher, so caching at the API level
 * would make the store call itself for the same key and wait on its own
 * promise.
 */

export const GBP_STATUS_KEY = 'gbp:status';
export const GBP_LOCATIONS_KEY = 'gbp:locations';

/** Connection state changes only when the user connects or disconnects, and
 *  every one of those paths forces a refresh below. */
const STATUS_STALE_MS = 5 * 60 * 1000;
/** Matches the stale time `useGbpLocation` uses for the same key. */
const LOCATIONS_STALE_MS = 60 * 60 * 1000;

export function readGbpConnectionStatus(projectId, { force = false } = {}) {
  if (!projectId) return Promise.resolve(null);
  return fetchIfNeeded(projectId, GBP_STATUS_KEY, () => getConnectionStatus(projectId), {
    staleTime: STATUS_STALE_MS,
    force,
  });
}

export function readGbpAttachedLocations(projectId, { force = false } = {}) {
  if (!projectId) return Promise.resolve({ locations: [] });
  return fetchIfNeeded(projectId, GBP_LOCATIONS_KEY, () => listAttachedLocations(projectId), {
    staleTime: LOCATIONS_STALE_MS,
    force,
  });
}

/**
 * Marks both entries stale after a mutation - connect, disconnect, account
 * selection, attach/detach, resync. The screen that performed it then reads
 * with `force`, and any screen visited afterwards refetches rather than showing
 * the pre-mutation state.
 */
export function invalidateGbpConnection(projectId) {
  if (!projectId) return;
  invalidate(projectId, GBP_STATUS_KEY);
  invalidate(projectId, GBP_LOCATIONS_KEY);
}
