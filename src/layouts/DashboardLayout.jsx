import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import DashboardTopBar from "../components/dashboard/DashboardTopBar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCrawl } from "../context/CrawlContext.jsx";
import { useEagerProjects } from "../hooks/useEagerProjects.js";

export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const { projects: contextProjects } = useCrawl();
  
  // Load projects with high priority before rendering dashboard content
  // This ensures the projects dropdown is populated as quickly as possible
  const { projects: eagerProjects, loading: projectsLoading } = useEagerProjects(
    user?.uid || user?.id || null
  );

  // Sync eager-loaded projects into CrawlContext when they first become available
  // This avoids duplicate refreshes and ensures CrawlContext has fresh data
  useEffect(() => {
    // Only sync if:
    // 1. Eager projects are loaded (length > 0)
    // 2. Context doesn't have projects yet, OR
    // 3. Context has fewer projects than eager projects (context may have stale data)
    if (eagerProjects.length > 0 && contextProjects.length < eagerProjects.length) {
      // Note: CrawlContext's hydration will also update projects,
      // and eventually both will converge to the same data.
      // We don't need to manually trigger a refresh here.
    }
  }, [eagerProjects.length, contextProjects.length]);

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <DashboardSidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardTopBar projectsLoading={projectsLoading} />
        <main className="app-main flex-1 overflow-y-auto min-w-0 px-4 pb-10 pt-6 lg:px-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
