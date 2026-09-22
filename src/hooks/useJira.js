import { useCallback, useMemo } from 'react';
import { useProjectData } from './useProjectData.js';
import {
  JIRA_LINKS_KEY,
  JIRA_STATUS_KEY,
  invalidateJiraLinks,
  invalidateJiraStatus,
} from '../lib/jiraCache.js';
import { getJiraStatus, listJiraLinks } from '../lib/jiraApi.js';
import { buildLinkIndex, findingKey } from '../lib/jiraFindings.js';

/**
 * Jira state for the selected project.
 *
 * Both hooks read through `useProjectData`, which gives per-key
 * subscriptions, one in-flight request per key and isolated error state - so
 * a Jira outage cannot take down a page that also renders crawl data, and no
 * Redux store is needed for any of it.
 *
 * `connected: false` is the quiet default. Every Jira affordance in the UI
 * is gated on it, so a user who has never set Jira up sees nothing at all.
 */

export function useJiraConnection({ enabled = true } = {}) {
  const { data, status, error, isLoading, refresh } = useProjectData(
    JIRA_STATUS_KEY,
    (projectId) => getJiraStatus(projectId),
    { staleTime: 5 * 60 * 1000, enabled }
  );

  return {
    // A failed status fetch must not look like "connected" - default closed.
    connected: Boolean(data?.connected),
    serverConfigured: data?.serverConfigured !== false,
    status: data || null,
    mapping: data?.mapping || null,
    counts: data?.counts || null,
    health: data?.health || null,
    webhook: data?.webhook || null,
    isLoading,
    fetchStatus: status,
    error,
    refresh,
  };
}

/**
 * Every Jira link for the project in ONE request, plus an index for O(1)
 * per-row lookups. A table of 200 findings costs one request, not 200.
 */
export function useJiraLinks({ enabled = true } = {}) {
  const { data, status, error, isLoading, refresh } = useProjectData(
    JIRA_LINKS_KEY,
    (projectId) => listJiraLinks(projectId),
    { staleTime: 2 * 60 * 1000, enabled }
  );

  const links = useMemo(() => (Array.isArray(data?.links) ? data.links : []), [data]);
  const index = useMemo(() => buildLinkIndex(links), [links]);

  const lookup = useCallback(
    (descriptor) => (descriptor ? index.get(findingKey(descriptor)) || null : null),
    [index]
  );

  return {
    links,
    index,
    lookup,
    counts: data?.counts || null,
    isLoading,
    fetchStatus: status,
    error,
    refresh,
  };
}

/** Drop both caches after an action that changed either. */
export function useJiraRefresh(projectId) {
  return useCallback(() => {
    invalidateJiraStatus(projectId);
    invalidateJiraLinks(projectId);
  }, [projectId]);
}
