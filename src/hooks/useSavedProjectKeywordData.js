import { useMemo } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useProjects } from "../context/ProjectsContext.jsx";
import { useSelectedProjectDomain } from "./useSelectedProjectDomain.js";

/**
 * Reads a saved `project_data` entry for the selected project.
 *
 * The project inventory (which carries `project_data`) is already loaded once by
 * ProjectsContext, so this hook resolves from that shared state instead of
 * issuing its own `GET /api/projects`.
 */
export function useSavedProjectKeywordData(key) {
  const { user } = useAuth();
  const { project } = useSelectedProjectDomain();
  const { projects, loading, error, ready } = useProjects();
  const userId = user?.uid || user?.id || "";
  const projectId = project?.id || project?.project_id || "";

  return useMemo(() => {
    if (!userId || !projectId || !key) {
      return { loading: false, error: "", data: null, project, projectId };
    }

    if (loading || !ready) {
      return { loading: true, error: "", data: null, project, projectId };
    }

    if (error) {
      return {
        loading: false,
        error: error || "Could not load saved keyword data.",
        data: null,
        project,
        projectId,
      };
    }

    const current = (projects || []).find(
      (item) => String(item.id ?? item.project_id) === String(projectId)
    );
    return {
      loading: false,
      error: "",
      data: current?.project_data?.[key] ?? null,
      project,
      projectId,
    };
  }, [error, key, loading, project, projectId, projects, ready, userId]);
}
