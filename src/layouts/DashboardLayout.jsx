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
    <div className="flex h-screen overflow-hidden bg-ink-900 text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/3 h-[600px] w-[700px] rounded-full bg-brand-500/[0.06] blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/[0.04] blur-[160px]" />
      </div>

      <IconRail />
      <DashboardSidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardTopBar projectsLoading={projectsLoading} />
        <main className="flex-1 overflow-y-auto min-w-0 px-4 pb-8 pt-5 lg:px-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
