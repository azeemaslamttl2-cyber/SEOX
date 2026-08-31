import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import GscSecondaryNav from "../components/gsc/GscSecondaryNav.jsx";
import GscTopBar from "../components/gsc/GscTopBar.jsx";
import { GscInsightsProvider } from "../context/GscInsightsContext.jsx";

export default function GscLayout() {
  return (
    <GscInsightsProvider>
      <div className="relative h-screen overflow-hidden bg-ink-900 text-white">
        <div className="flex h-full">
          <IconRail />
          <GscSecondaryNav />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <GscTopBar />
            <main className="app-main min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-12 pt-4 lg:px-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </GscInsightsProvider>
  );
}
