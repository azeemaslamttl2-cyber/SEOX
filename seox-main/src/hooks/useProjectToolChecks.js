import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyProjectToolChecks,
  loadProjectToolChecks,
  runProjectToolChecks,
  saveProjectToolChecks,
  shouldRunProjectToolChecks,
} from "../lib/projectToolChecks.js";
import { useNotifications } from "../context/NotificationsContext.jsx";

function userIdFor(user) {
  return user?.uid || user?.id || "";
}

export function useProjectToolChecks(project, user) {
  const { notify } = useNotifications();
  const userId = userIdFor(user);
  const projectKey = project?.id || project?.fullUrl || project?.domain || "";
  const runIdRef = useRef(0);
  const autoStartedRef = useRef("");
  const [checks, setChecks] = useState(() => {
    return project ? loadProjectToolChecks(project) || createEmptyProjectToolChecks(project) : null;
  });

  useEffect(() => {
    if (!project) {
      setChecks(null);
      return;
    }
    setChecks(loadProjectToolChecks(project) || createEmptyProjectToolChecks(project));
  }, [projectKey, project]);

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
      saveProjectToolChecks(project, initial);

      return runProjectToolChecks(project, {
        userId,
        onUpdate: (next) => {
          if (runIdRef.current === runId) setChecks(next);
        },
      })
        .then((next) => {
          const tools = Object.values(next?.tools || {});
          const completed = tools.filter((tool) => tool.status === "complete").length;
          const failed = tools.filter((tool) => tool.status === "error").length;
          notify({
            type: failed ? "warning" : "success",
            title: "Dashboard checks complete",
            body: `${completed} checks completed for ${project.name || project.domain || "your website"}.`,
            href: "/dashboard",
          });
          return next;
        })
        .catch((error) => {
          notify({
            type: "error",
            title: "Dashboard checks failed",
            body: error?.message || "Could not complete the dashboard checks.",
            href: "/dashboard",
          });
          throw error;
        });
    },
    [notify, project, userId]
  );

  useEffect(() => {
    if (!project) return;
    const loaded = loadProjectToolChecks(project);
    const autoKey = `${projectKey}:${loaded?.completedAt || "empty"}`;
    if (autoStartedRef.current === autoKey) return;
    if (!loaded || shouldRunProjectToolChecks(project, loaded)) {
      autoStartedRef.current = autoKey;
      runChecks();
    }
  }, [project, projectKey, runChecks]);

  return {
    checks,
    isRunning: checks?.status === "running",
    rerun: () => runChecks({ force: true }),
  };
}
