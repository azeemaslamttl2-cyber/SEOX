import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import GscSecondaryNav from "../components/gsc/GscSecondaryNav.jsx";
import GscTopBar from "../components/gsc/GscTopBar.jsx";
import { GscInsightsProvider } from "../context/GscInsightsContext.jsx";

export default function GscLayout() {
  return (
    <GscInsightsProvider>
      <div className="relative h-screen overflow-hidden bg-ink-900 text-white">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 left-1/4 h-[600px] w-[700px] rounded-full bg-emerald-500/[0.06] blur-[160px]" />
          <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-teal-500/[0.04] blur-[160px]" />
        </div>

        <div className="flex h-full">
          <IconRail />
          <GscSecondaryNav />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <GscTopBar />
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-12 pt-4 lg:px-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </GscInsightsProvider>
  );
}
