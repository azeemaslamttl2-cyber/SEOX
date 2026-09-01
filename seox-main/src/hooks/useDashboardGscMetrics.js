import { useEffect, useRef, useState } from "react";
import {
  EMPTY_GSC_PERFORMANCE_METRICS,
  fetchProjectGscPerformance,
} from "../lib/gscPerformance.js";

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

export function useDashboardGscMetrics(project, user) {
  const requestRef = useRef(0);
  const projectKey = projectKeyFor(project);
  const userId = userIdFor(user);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!project) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({
      ...current,
      status: "loading",
      summary: "Fetching GSC",
      detail: "Loading Search Console performance for the selected website.",
    }));

    fetchProjectGscPerformance(project, { userId })
      .then((next) => {
        if (requestRef.current !== requestId) return;
        setState({
          ...INITIAL_STATE,
          ...next,
          status: next.status || "complete",
          metrics: next.metrics || EMPTY_GSC_PERFORMANCE_METRICS,
          previousMetrics: next.previousMetrics || EMPTY_GSC_PERFORMANCE_METRICS,
          deltas: next.deltas || EMPTY_GSC_PERFORMANCE_METRICS,
        });
      })
      .catch((error) => {
        if (requestRef.current !== requestId) return;
        setState({
          ...INITIAL_STATE,
          status: "error",
          summary: "GSC error",
          detail: error?.message || "Could not load Search Console metrics.",
        });
      });
  }, [project, projectKey, userId]);

  return state;
}
