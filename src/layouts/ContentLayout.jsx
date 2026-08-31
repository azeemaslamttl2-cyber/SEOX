import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import ContentSecondaryNav from "../components/content/ContentSecondaryNav.jsx";
import ContentTopBar from "../components/content/ContentTopBar.jsx";

export default function ContentLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <ContentSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ContentTopBar />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="pointer-events-none fixed right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-teal-500/[0.03] blur-[120px]" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
