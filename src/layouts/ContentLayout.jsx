import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import ContentSecondaryNav from "../components/content/ContentSecondaryNav.jsx";
import ContentTopBar from "../components/content/ContentTopBar.jsx";

export default function ContentLayout() {
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <ContentSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ContentTopBar />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
