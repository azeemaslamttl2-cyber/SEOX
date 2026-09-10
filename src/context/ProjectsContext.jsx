import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { deleteProject as deleteProjectApi, loadProjects, saveProjectMeta, saveProjectWithMeta } from '../lib/projectsApi.js';
import {
  clearProjectsCache,
  fetchProjectsCached,
  getCachedProjects,
  setProjectsCache,
} from '../lib/projectsCache.js';
import { useAuth } from './AuthContext.jsx';

const ProjectsContext = createContext(null);

const EMPTY_PAYLOAD = {
  projects: [],
  selectedProjectId: null,
  deletedProjectIds: [],
};

function projectIdOf(project) {
  return String(project?.id || project?.project_id || '');
}

/**
 * ProjectsProvider - the single source of truth for the signed-in user's
 * project inventory.
 *
 * Every page reads the list from here.  `GET /api/projects` is issued once per
 * signed-in user; concurrent consumers share the same in-flight request through
 * `projectsCache`, and create/update/delete mutate this state directly rather
 * than triggering another list request.
 *
 * Page-specific data (tool results, GSC/GBP metrics, crawl output, ...) is not
 * cached here - those pages keep fetching from their own endpoints.
 */
export function ProjectsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid || user?.id || null;

  const uidRef = useRef(uid);
  uidRef.current = uid;
  // uid whose payload is currently held in state; used to detect user switches.
  const loadedUidRef = useRef(null);

  const [payload, setPayload] = useState(() => (uid ? getCachedProjects(uid) || EMPTY_PAYLOAD : EMPTY_PAYLOAD));
  const [loading, setLoading] = useState(Boolean(uid));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // Mirror of `payload` that is readable synchronously, so a mutation can be
  // computed and returned to its caller without waiting for a re-render.
  const payloadRef = useRef(payload);

  // Writes a payload to the React state, the synchronous mirror, and the shared
  // cache, so any later reader (including a remount) sees the same data without
  // a network call.
  const commitPayload = useCallback((next) => {
    const normalized = {
      projects: Array.isArray(next?.projects) ? next.projects : [],
      selectedProjectId: next?.selectedProjectId || null,
      deletedProjectIds: Array.isArray(next?.deletedProjectIds) ? next.deletedProjectIds : [],
    };
    payloadRef.current = normalized;
    if (uidRef.current) setProjectsCache(uidRef.current, normalized);
    setPayload(normalized);
    return normalized;
  }, []);

  const mutatePayload = useCallback(
    (updater) => {
      const current = payloadRef.current;
      const next = updater(current);
      if (!next || next === current) return current;
      return commitPayload(next);
    },
    [commitPayload]
  );

  // State-only write, used for values that already come from (or belong out of)
  // the cache. Never writes back, so it cannot poison a cache entry.
  const adoptPayload = useCallback((next) => {
    payloadRef.current = next;
    setPayload(next);
  }, []);

  /**
   * Loads the project list for the active user.  Without `force` this resolves
   * from the shared cache, so navigating between pages never hits the API.
   */
  const refreshProjects = useCallback(
    async (force = false) => {
      const currentUid = uidRef.current;
      if (!currentUid) {
        adoptPayload(EMPTY_PAYLOAD);
        setLoading(false);
        setError(null);
        return EMPTY_PAYLOAD;
      }

      setLoading(true);
      try {
        const data = await fetchProjectsCached(currentUid, loadProjects, { force });
        if (uidRef.current !== currentUid) return data;
        adoptPayload(data);
        setError(null);
        return data;
      } catch (err) {
        if (uidRef.current === currentUid) setError(err?.message || 'Failed to load projects');
        return EMPTY_PAYLOAD;
      } finally {
        if (uidRef.current === currentUid) {
          setLoading(false);
          setReady(true);
        }
      }
    },
    [adoptPayload]
  );

  // One effect owns project loading for the whole application.
  useEffect(() => {
    let cancelled = false;

    // A different user (or a sign-out) must never keep the previous user's
    // projects visible, in state or in the shared cache.
    if (loadedUidRef.current !== uid) {
      if (loadedUidRef.current) clearProjectsCache(loadedUidRef.current);
      loadedUidRef.current = uid;
      adoptPayload((uid && getCachedProjects(uid)) || EMPTY_PAYLOAD);
      setError(null);
    }

    if (!uid) {
      clearProjectsCache();
      setLoading(false);
      // Only settled once auth itself has resolved; otherwise consumers would
      // treat the pre-hydration "no user" state as a confirmed empty account.
      setReady(!authLoading);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    fetchProjectsCached(uid, loadProjects)
      .then((data) => {
        if (cancelled || uidRef.current !== uid) return;
        adoptPayload(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || uidRef.current !== uid) return;
        setError(err?.message || 'Failed to load projects');
      })
      .finally(() => {
        if (cancelled || uidRef.current !== uid) return;
        setLoading(false);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [adoptPayload, authLoading, uid]);

  /* ------------------------------------------------------------------ *
   * Local state transitions - no API traffic, used to keep the context
   * in step with writes performed elsewhere (e.g. CrawlContext).
   * ------------------------------------------------------------------ */

  const applyProjectUpsert = useCallback(
    (project, { selectedProjectId } = {}) => {
      const id = projectIdOf(project);
      if (!id) return null;
      return mutatePayload((current) => {
        const index = current.projects.findIndex((item) => projectIdOf(item) === id);
        const nextProjects =
          index >= 0
            ? current.projects.map((item, position) =>
                position === index ? { ...item, ...project } : item
              )
            : [...current.projects, project];
        return {
          projects: nextProjects,
          selectedProjectId: selectedProjectId !== undefined ? selectedProjectId : current.selectedProjectId,
          deletedProjectIds: current.deletedProjectIds.filter((item) => String(item) !== id),
        };
      });
    },
    [mutatePayload]
  );

  const applyProjectRemoval = useCallback(
    (projectId, { selectedProjectId, markDeleted = true } = {}) => {
      const id = String(projectId || '');
      if (!id) return null;
      return mutatePayload((current) => {
        const nextProjects = current.projects.filter((item) => projectIdOf(item) !== id);
        const nextSelected =
          selectedProjectId !== undefined
            ? selectedProjectId
            : current.selectedProjectId === id
            ? projectIdOf(nextProjects[0]) || null
            : current.selectedProjectId;
        return {
          projects: nextProjects,
          selectedProjectId: nextSelected,
          // A rolled-back optimistic insert passes markDeleted:false - the row
          // was never persisted, so it must not join the tombstone list.
          deletedProjectIds:
            !markDeleted || current.deletedProjectIds.includes(id)
              ? current.deletedProjectIds
              : [...current.deletedProjectIds, id],
        };
      });
    },
    [mutatePayload]
  );

  const applySelectedProjectId = useCallback(
    (projectId) => {
      const id = projectId ? String(projectId) : null;
      return mutatePayload((current) =>
        current.selectedProjectId === id ? current : { ...current, selectedProjectId: id }
      );
    },
    [mutatePayload]
  );

  /** Replaces the whole list, e.g. after a hydration pass that merged sources. */
  const setProjectsPayload = useCallback((next) => commitPayload(next), [commitPayload]);

  /* ------------------------------------------------------------------ *
   * CRUD - persist first, then update the context in place.
   * ------------------------------------------------------------------ */

  /**
   * Persists a project and publishes it to the context.
   *
   * `saveProjectWithMeta` also rewrites the account-wide meta (selected project
   * and the deleted-project tombstones) for every row, so both must carry the
   * current values unless the caller deliberately changes them - otherwise an
   * ordinary edit would silently reselect the project and erase the tombstones.
   */
  const persistProject = useCallback(
    async (project, { selectedProjectId, deletedProjectIds }) => {
      const currentUid = uidRef.current;
      if (!currentUid || !project?.id) return null;

      const response = await saveProjectWithMeta(currentUid, project, {
        selectedProjectId,
        deletedProjectIds,
      });
      // Only reached when the write succeeded; a rejection leaves the context
      // untouched. The POST echoes the database row shape (project_id /
      // stringified project_data), so the client object we just persisted is
      // the accurate value to publish - and no extra GET is needed either way.
      applyProjectUpsert(project, { selectedProjectId });
      return response;
    },
    [applyProjectUpsert]
  );

  /** Creating a project selects it, matching the existing creation flow. */
  const addProject = useCallback(
    (project, meta = {}) =>
      persistProject(project, {
        selectedProjectId: meta.selectedProjectId || project?.id,
        deletedProjectIds: meta.deletedProjectIds ?? payloadRef.current.deletedProjectIds,
      }),
    [persistProject]
  );

  /** Editing a project leaves the current selection alone. */
  const updateProject = useCallback(
    (project, meta = {}) =>
      persistProject(project, {
        selectedProjectId:
          meta.selectedProjectId ?? payloadRef.current.selectedProjectId ?? project?.id,
        deletedProjectIds: meta.deletedProjectIds ?? payloadRef.current.deletedProjectIds,
      }),
    [persistProject]
  );

  const removeProject = useCallback(
    async (projectId) => {
      const currentUid = uidRef.current;
      if (!currentUid || !projectId) return false;
      await deleteProjectApi(currentUid, projectId);
      const next = applyProjectRemoval(projectId);
      await saveProjectMeta(currentUid, {
        selectedProjectId: next?.selectedProjectId || null,
        deletedProjectIds: next?.deletedProjectIds || [],
      }).catch(() => {});
      return true;
    },
    [applyProjectRemoval]
  );

  const value = useMemo(
    () => ({
      projects: payload.projects,
      selectedProjectId: payload.selectedProjectId,
      deletedProjectIds: payload.deletedProjectIds,
      loading,
      ready,
      error,
      refreshProjects,
      addProject,
      updateProject,
      removeProject,
      applyProjectUpsert,
      applyProjectRemoval,
      applySelectedProjectId,
      setProjectsPayload,
      clearCache: () => clearProjectsCache(uidRef.current),
    }),
    [
      addProject,
      applyProjectRemoval,
      applySelectedProjectId,
      applyProjectUpsert,
      error,
      loading,
      payload,
      ready,
      refreshProjects,
      removeProject,
      setProjectsPayload,
      updateProject,
    ]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used inside ProjectsProvider');
  }
  return context;
}
