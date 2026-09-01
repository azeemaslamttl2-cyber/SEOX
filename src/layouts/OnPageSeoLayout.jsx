import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import OnPageSecondaryNav from "../components/onpage/OnPageSecondaryNav.jsx";
import OnPageTopBar from "../components/onpage/OnPageTopBar.jsx";

export default function OnPageSeoLayout() {
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <OnPageSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <OnPageTopBar />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {/* Ambient glow */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
