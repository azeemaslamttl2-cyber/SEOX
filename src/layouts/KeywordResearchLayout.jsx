import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import KeywordSecondaryNav from "../components/keywords/KeywordSecondaryNav.jsx";
import KeywordTopBar from "../components/keywords/KeywordTopBar.jsx";

export default function KeywordResearchLayout() {
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <KeywordSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <KeywordTopBar />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
