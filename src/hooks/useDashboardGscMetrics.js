import { useMemo } from "react";
import {
  EMPTY_GSC_PERFORMANCE_METRICS,
  fetchProjectGscPerformance,
} from "../lib/gscPerformance.js";
import { saveToolResult } from "../lib/projectsApi.js";
import { useProjectData } from "./useProjectData.js";

function userIdFor(user) {
  return user?.uid || user?.id || "";
}

function projectKeyFor(project) {
  return project?.id || project?.fullUrl || project?.url || project?.domain || "";
}

const INITIAL_STATE = {
  status: "idle",
  summary: "Waiting for website",
  detail: "",
  metrics: EMPTY_GSC_PERFORMANCE_METRICS,
  previousMetrics: EMPTY_GSC_PERFORMANCE_METRICS,
  deltas: EMPTY_GSC_PERFORMANCE_METRICS,
  dailyData: [],
  topQueries: [],
  topPages: [],
  quickWins: [],
  siteUrl: "",
  fetchedAt: "",
};

/**
 * Search Console performance for the dashboard.
 *
 * The result is cached per project for 15 minutes. Previously this lived in
 * local state with no TTL, so leaving the dashboard threw the data away and
 * coming back made another live call to Google.
 *
 * The returned shape is unchanged, so `Dashboard.jsx` needs no edit.
 */
export function useDashboardGscMetrics(project, user) {
  const projectKey = projectKeyFor(project);
  const userId = userIdFor(user);

  const { data, status, error } = useProjectData(
    "gsc:performance",
    async () => {
      const next = await fetchProjectGscPerformance(project, { userId });

      // Persisting the snapshot is a side effect of a successful fetch, not
      // something the cache should repeat on a cache hit - which is exactly
      // what this change stops.
      if (userId && project?.id && next.status === "complete") {
        await saveToolResult(userId, {
          projectId: project.id,
          projectUrl: project.fullUrl || project.url || project.domain || "",
          toolKey: "gsc",
          result: next,
        }).catch(() => {
          // A failed write must not invalidate metrics we already have.
        });
      }

      return next;
    },
    { staleTime: 15 * 60 * 1000, enabled: Boolean(project && projectKey) }
  );

  return useMemo(() => {
    if (!project) return INITIAL_STATE;

    if (status === "error") {
      return {
        ...INITIAL_STATE,
        status: "error",
        summary: "GSC error",
        detail: error?.message || "Could not load Search Console metrics.",
      };
    }

    if (!data) {
      return {
        ...INITIAL_STATE,
        status: "loading",
        summary: "Fetching GSC",
        detail: "Loading Search Console performance for the selected website.",
      };
    }

    return {
      ...INITIAL_STATE,
      ...data,
      status: data.status || "complete",
      metrics: data.metrics || EMPTY_GSC_PERFORMANCE_METRICS,
      previousMetrics: data.previousMetrics || EMPTY_GSC_PERFORMANCE_METRICS,
      deltas: data.deltas || EMPTY_GSC_PERFORMANCE_METRICS,
    };
  }, [data, error, project, status]);
}
