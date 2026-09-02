import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useSelectedProjectDomain } from "./useSelectedProjectDomain.js";
import { loadProjects } from "../lib/projectsApi.js";

export function useSavedProjectKeywordData(key) {
  const { user } = useAuth();
  const { project } = useSelectedProjectDomain();
  const userId = user?.uid || user?.id || "";
  const projectId = project?.id || project?.project_id || "";
  const [state, setState] = useState({ loading: false, error: "", data: null });

  useEffect(() => {
    let active = true;
    if (!userId || !projectId || !key) {
      setState({ loading: false, error: "", data: null });
      return () => { active = false; };
    }
    setState({ loading: true, error: "", data: null });
    loadProjects(userId)
      .then(({ projects }) => {
        if (!active) return;
        const current = (projects || []).find((item) => String(item.id) === String(projectId));
        setState({ loading: false, error: "", data: current?.project_data?.[key] ?? null });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error?.message || "Could not load saved keyword data.", data: null });
      });
    return () => { active = false; };
  }, [key, projectId, userId]);

  return { ...state, project, projectId };
}

