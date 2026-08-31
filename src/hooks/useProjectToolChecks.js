import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyProjectToolChecks,
  loadProjectToolChecks,
  runProjectToolChecks,
  saveProjectToolChecks,
  shouldRunProjectToolChecks,
} from "../lib/projectToolChecks.js";
import { loadToolResult, saveToolResult } from "../lib/projectsApi.js";

const DASHBOARD_CHECKS_KEY = "dashboardChecks";

function userIdFor(user) {
  return user?.uid || user?.id || "";
}

export function useProjectToolChecks(project, user) {
  const userId = userIdFor(user);
  const projectKey = project?.id || project?.fullUrl || project?.domain || "";
  const runIdRef = useRef(0);
  const autoStartedRef = useRef("");
  const [hydratedKey, setHydratedKey] = useState("");
  const [checks, setChecks] = useState(() => {
    return project ? loadProjectToolChecks(project) || createEmptyProjectToolChecks(project) : null;
  });

  useEffect(() => {
    if (!project) {
      setChecks(null);
      setHydratedKey("");
      return;
    }
    const nextHydratedKey = `${userId}:${projectKey}`;
    const cachedChecks = loadProjectToolChecks(project) || createEmptyProjectToolChecks(project);
    setChecks(cachedChecks);

    if (!userId || !project.id) {
      setHydratedKey(nextHydratedKey);
      return undefined;
    }

    let cancelled = false;
    loadToolResult(userId, { projectId: project.id, toolKey: DASHBOARD_CHECKS_KEY })
      .then((storedChecks) => {
        if (cancelled || !storedChecks) return;
        saveProjectToolChecks(project, storedChecks);
        setChecks(storedChecks);
      })
      .catch(() => {
        // The session cache remains available if the database is temporarily unavailable.
      })
      .finally(() => {
        if (!cancelled) setHydratedKey(nextHydratedKey);
      });

    return () => {
      cancelled = true;
    };
  }, [project, projectKey, userId]);

  const persistChecks = useCallback(
    (nextChecks) => {
      saveProjectToolChecks(project, nextChecks);
      if (!userId || !project?.id) return;

      saveToolResult(userId, {
        projectId: project.id,
        projectUrl: nextChecks.projectUrl || project.fullUrl || project.url || "",
        toolKey: DASHBOARD_CHECKS_KEY,
        result: nextChecks,
      }).catch(() => {
        // Keep the cache as a short-lived fallback; the next run can retry the write.
      });
    },
    [project, userId]
  );

  const runChecks = useCallback(
    async ({ force = false } = {}) => {
      if (!project) return null;
      const loaded = loadProjectToolChecks(project);
      if (!force && loaded && !shouldRunProjectToolChecks(project, loaded)) {
        setChecks(loaded);
        return loaded;
      }

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const initial = createEmptyProjectToolChecks(project);
      initial.status = "running";
      setChecks(initial);
      persistChecks(initial);

      return runProjectToolChecks(project, {
        userId,
        onUpdate: (next) => {
          if (runIdRef.current !== runId) return;
          setChecks(next);
          persistChecks(next);
        },
      });
    },
    [persistChecks, project, userId]
  );

  useEffect(() => {
    if (!project || hydratedKey !== `${userId}:${projectKey}`) return;
    const loaded = loadProjectToolChecks(project);
    const autoKey = `${projectKey}:${loaded?.completedAt || "empty"}`;
    if (autoStartedRef.current === autoKey) return;
    if (!loaded || shouldRunProjectToolChecks(project, loaded)) {
      autoStartedRef.current = autoKey;
      runChecks();
    }
  }, [hydratedKey, project, projectKey, runChecks, userId]);

  return {
    checks,
    isRunning: checks?.status === "running",
    rerun: () => runChecks({ force: true }),
  };
}
