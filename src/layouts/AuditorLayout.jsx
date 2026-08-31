import { Navigate, Outlet } from "react-router-dom";
import { Database, Loader2 } from "lucide-react";
import IconRail from "../components/auditor/IconRail.jsx";
import SecondaryNav from "../components/auditor/SecondaryNav.jsx";
import TopBar from "../components/auditor/TopBar.jsx";
import { useCrawl } from "../context/CrawlContext.jsx";

export default function AuditorLayout() {
  const { projects, storageReady } = useCrawl();

  if (!storageReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/70 px-5 py-4 shadow-2xl shadow-black/20">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Database className="h-5 w-5" />
            <Loader2 className="absolute -right-1 -top-1 h-4 w-4 animate-spin text-brand-400" />
          </span>
          <div>
            <p className="text-sm font-semibold">Restoring your audit</p>
            <p className="text-xs text-white/50">
              Loading saved project URLs, issues, and crawl history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return <Navigate to="/auditor/new" replace />;
  }

  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      <div className="flex">
        <IconRail />
        <SecondaryNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="app-main min-w-0 flex-1 px-4 pb-12 pt-4 lg:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
