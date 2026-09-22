import { fetchIfNeeded, invalidate } from './projectDataStore.js';
import { getJiraStatus, listJiraLinks } from './jiraApi.js';

/**
 * Cached reads for the two Jira endpoints every Jira-aware screen needs.
 *
 * The connection status and the link list are the same for a whole project,
 * but the settings panel, the issues table and every finding detail page all
 * want them. Without a shared cache each screen would refetch on mount - the
 * exact problem `gbpCache.js` was written to solve for the Business Profile
 * pages, measured there at nine redundant requests over a five-step walk.
 *
 * These go through `projectDataStore`, so all callers share one entry per
 * project and concurrent callers share one in-flight promise. Status and
 * error live per entry, which is what keeps a Jira outage from affecting any
 * other part of a page.
 *
 * Deliberately NOT wrapped inside `jiraApi.js`: the store's fetcher calls
 * those functions, so caching at the API level would make the store call
 * itself and wait on its own promise.
 */

export const JIRA_STATUS_KEY = 'jira:status';
export const JIRA_LINKS_KEY = 'jira:links';

/** Connection state changes only when the user acts, and those paths force a refresh. */
const STATUS_STALE_MS = 5 * 60 * 1000;
/** Links move when Jira does, so a shorter window - but still not per-render. */
const LINKS_STALE_MS = 2 * 60 * 1000;

export function readJiraStatus(projectId, { force = false } = {}) {
  if (!projectId) return Promise.resolve(null);
  return fetchIfNeeded(projectId, JIRA_STATUS_KEY, () => getJiraStatus(projectId), {
    staleTime: STATUS_STALE_MS,
    force,
  });
}

/**
 * Every link for the project, in ONE request.
 *
 * The issues list can show ~200 finding rows; asking "is this one linked?"
 * per row would be 200 requests. Callers build a Map from this instead and
 * answer each row from memory.
 */
export function readJiraLinks(projectId, { force = false } = {}) {
  if (!projectId) return Promise.resolve({ links: [], counts: {} });
  return fetchIfNeeded(projectId, JIRA_LINKS_KEY, () => listJiraLinks(projectId), {
    staleTime: LINKS_STALE_MS,
    force,
  });
}

/** Called after create, unlink, retry and sync-now. */
export function invalidateJiraLinks(projectId) {
  if (projectId) invalidate(projectId, JIRA_LINKS_KEY);
}

export function invalidateJiraStatus(projectId) {
  if (projectId) invalidate(projectId, JIRA_STATUS_KEY);
}

export function invalidateJira(projectId) {
  invalidateJiraStatus(projectId);
  invalidateJiraLinks(projectId);
}
