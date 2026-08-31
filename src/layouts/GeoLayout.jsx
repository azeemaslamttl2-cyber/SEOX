import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import GeoSecondaryNav from "../components/geo/GeoSecondaryNav.jsx";
import GeoTopBar from "../components/geo/GeoTopBar.jsx";

export default function GeoLayout() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      {/* Ambient glow — emerald-cyan theme */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/3 h-[600px] w-[700px] rounded-full bg-emerald-500/[0.06] blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.04] blur-[160px]" />
      </div>

      <div className="flex">
        <IconRail />
        <GeoSecondaryNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <GeoTopBar />
          <main className="min-w-0 flex-1 px-4 pb-12 pt-4 lg:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
