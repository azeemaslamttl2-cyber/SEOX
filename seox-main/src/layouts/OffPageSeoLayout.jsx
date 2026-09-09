import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import OffPageSecondaryNav from "../components/offpage/OffPageSecondaryNav.jsx";
import OffPageTopBar from "../components/offpage/OffPageTopBar.jsx";

export default function OffPageSeoLayout() {
  return (
    <div className="app-shell flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <OffPageSecondaryNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <OffPageTopBar />
        <main className="app-main flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
