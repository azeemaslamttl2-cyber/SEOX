import IconRail from "../components/auditor/IconRail.jsx";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import DashboardTopBar from "../components/dashboard/DashboardTopBar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useEagerProjects } from "../hooks/useEagerProjects.js";
import RouteOutlet from "../components/RouteOutlet.jsx";

export default function DashboardLayout({ children }) {
  const { user } = useAuth();

  // Projects are shared through the app-wide ProjectsContext cache, so this
  // reads the one list the whole application uses rather than fetching again.
  // The topbar only needs to know whether that list is still on its way.
  //
  // A no-op effect used to sit here subscribing to CrawlContext to "sync"
  // projects; its body was empty, so all it did was re-render this layout -
  // icon rail, sidebar and topbar - on every crawl state change.
  const { loading: projectsLoading } = useEagerProjects(user?.uid || user?.id || null);

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <DashboardSidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardTopBar projectsLoading={projectsLoading} />
        <main className="app-main flex-1 overflow-y-auto min-w-0 px-4 pb-10 pt-6 lg:px-8">
          {children || <RouteOutlet />}
        </main>
      </div>
    </div>
  );
}
