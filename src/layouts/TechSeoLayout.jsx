import { Outlet, useLocation } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import TechSeoSecondaryNav from "../components/techseo/TechSeoSecondaryNav.jsx";
import TechSeoTopBar from "../components/techseo/TechSeoTopBar.jsx";

export default function TechSeoLayout() {
  const { pathname } = useLocation();

  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      <div className="flex">
        <IconRail />
        <TechSeoSecondaryNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TechSeoTopBar />
          <main className="app-main min-w-0 flex-1 px-4 pb-12 pt-4 lg:px-6">
            <Outlet key={pathname} />
          </main>
        </div>
      </div>
    </div>
  );
}
