import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import SeoToolsSecondaryNav from "../components/seotools/SeoToolsSecondaryNav.jsx";
import SeoToolsTopBar from "../components/seotools/SeoToolsTopBar.jsx";

export default function SeoToolsLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <SeoToolsSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SeoToolsTopBar />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="pointer-events-none fixed right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-indigo-700/[0.06] blur-[120px]" />
          <div className="pointer-events-none fixed left-0 bottom-0 -z-10 h-[400px] w-[400px] rounded-full bg-violet-700/[0.05] blur-[120px]" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
