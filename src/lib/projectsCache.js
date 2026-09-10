import { loadProjects } from './projectsApi.js';

/**
 * Process-wide project cache.
 *
 * This module is the only place that is allowed to issue `GET /api/projects`
 * for the project inventory.  It guarantees two things:
 *
 *  1. One request per user - once a payload is cached, later readers reuse it.
 *  2. One request in flight - if several components ask for projects while a
 *     request is still running, they all await the same promise instead of
 *     starting their own.
 *
 * The cache is in-memory only, so a browser refresh always refetches.
 */
const projectCache = new Map();

const DEFAULT_PROJECTS_PAYLOAD = {
  projects: [],
  selectedProjectId: null,
  deletedProjectIds: [],
};

function normalizePayload(payload) {
  const candidate = payload || DEFAULT_PROJECTS_PAYLOAD;
  return {
    projects: Array.isArray(candidate.projects) ? candidate.projects : [],
    selectedProjectId: candidate.selectedProjectId || null,
    deletedProjectIds: Array.isArray(candidate.deletedProjectIds) ? candidate.deletedProjectIds : [],
  };
}

export function clearProjectsCache(uid = null) {
  if (!uid) {
    projectCache.clear();
    return;
  }
  projectCache.delete(uid);
}

export function getProjectsCache(uid) {
  if (!uid) return null;
  return projectCache.get(uid) || null;
}

/** Returns the cached payload for a user, or null when nothing is cached yet. */
export function getCachedProjects(uid) {
  if (!uid) return null;
  return projectCache.get(uid)?.data || null;
}

/**
 * Writes a payload into the cache without touching the network.  Used after a
 * create/update/delete so the next reader sees the mutation without a refetch.
 */
export function setProjectsCache(uid, payload) {
  if (!uid) return DEFAULT_PROJECTS_PAYLOAD;
  const normalized = normalizePayload(payload);
  const cached = projectCache.get(uid);
  projectCache.set(uid, {
    ...cached,
    data: normalized,
    updatedAt: Date.now(),
  });
  return normalized;
}

export async function fetchProjectsCached(uid, fetcher = loadProjects, { force = false } = {}) {
  if (!uid) return DEFAULT_PROJECTS_PAYLOAD;

  const cached = projectCache.get(uid);

  // Join an in-flight request instead of starting a second one.  A forced
  // refresh only joins another forced refresh, so it never resolves with a
  // snapshot that was already stale when its request started.
  if (cached?.pending && (!force || cached.pendingForce)) {
    return cached.pending;
  }

  if (!force && cached?.data) {
    return cached.data;
  }

  const request = Promise.resolve(fetcher(uid))
    .then((payload) => {
      const normalized = normalizePayload(payload);
      projectCache.set(uid, {
        data: normalized,
        pending: null,
        pendingForce: false,
        updatedAt: Date.now(),
      });
      return normalized;
    })
    .catch((error) => {
      projectCache.set(uid, {
        data: cached?.data || null,
        pending: null,
        pendingForce: false,
        updatedAt: Date.now(),
        error,
      });
      throw error;
    });

  projectCache.set(uid, {
    data: cached?.data || null,
    pending: request,
    pendingForce: force,
    updatedAt: Date.now(),
  });

  return request;
}
