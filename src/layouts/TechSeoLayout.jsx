import { Outlet, useLocation } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import TechSeoSecondaryNav from "../components/techseo/TechSeoSecondaryNav.jsx";
import TechSeoTopBar from "../components/techseo/TechSeoTopBar.jsx";

export default function TechSeoLayout() {
  const { pathname } = useLocation();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      {/* Ambient glow — blue-violet theme */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/3 h-[600px] w-[700px] rounded-full bg-blue-500/[0.06] blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/[0.04] blur-[160px]" />
      </div>

      <div className="flex">
        <IconRail />
        <TechSeoSecondaryNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TechSeoTopBar />
          <main className="min-w-0 flex-1 px-4 pb-12 pt-4 lg:px-6">
            <Outlet key={pathname} />
          </main>
        </div>
      </div>
    </div>
  );
}
