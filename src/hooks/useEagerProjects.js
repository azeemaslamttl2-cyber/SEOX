import { useEffect, useRef, useState } from "react";
import { loadProjects } from "../lib/projectsApi.js";

/**
 * useEagerProjects - High-priority project loading hook
 * 
 * This hook is designed to load the user's projects as early as possible,
 * with high priority over other dashboard data loads. It's meant to populate
 * the projects dropdown immediately so users can select a project quickly.
 * 
 * Usage: Call this in DashboardLayout to ensure projects load before children
 * Example: const { projects, loading, error } = useEagerProjects(userId);
 */
export function useEagerProjects(userId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      if (mountedRef.current) {
        setProjects([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    const requestId = ++requestRef.current;

    // High-priority fetch with minimal delay
    const fetchProjects = async () => {
      try {
        const data = await loadProjects(userId);
        
        // Only update if this is still the latest request and component is mounted
        if (requestRef.current === requestId && mountedRef.current) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
          setError(null);
        }
      } catch (err) {
        // Non-blocking: keep existing projects if fetch fails
        if (requestRef.current === requestId && mountedRef.current) {
          setError(err?.message || "Failed to load projects");
        }
      } finally {
        if (requestRef.current === requestId && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Fetch immediately with no delay
    fetchProjects();

    // Cancel if unmounted or userId changes
    return () => {
      requestRef.current++;
    };
  }, [userId]);

  return { projects, loading, error };
}
