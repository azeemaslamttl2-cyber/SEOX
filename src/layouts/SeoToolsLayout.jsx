import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import SeoToolsSecondaryNav from "../components/seotools/SeoToolsSecondaryNav.jsx";
import SeoToolsTopBar from "../components/seotools/SeoToolsTopBar.jsx";

export default function SeoToolsLayout() {
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <SeoToolsSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SeoToolsTopBar />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
