import { useMemo } from "react";
import { useProjects } from "../context/ProjectsContext.jsx";

/**
 * useEagerProjects - Shared cached project access for the dashboard and project selectors.
 *
 * This hook intentionally reads from the same project cache used across the app.
 * It avoids separate direct API requests when multiple pages/components request
 * the same project list at the same time.
 */
export function useEagerProjects(userId) {
  const { projects, loading, error, ready, refreshProjects } = useProjects();

  const value = useMemo(() => {
    if (!userId) {
      return { projects: [], loading: false, error: null, ready: true, refresh: refreshProjects };
    }

    return {
      projects,
      loading,
      error,
      ready,
      refresh: refreshProjects,
    };
  }, [error, loading, projects, ready, refreshProjects, userId]);

  return value;
}
