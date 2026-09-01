import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import GeoSecondaryNav from "../components/geo/GeoSecondaryNav.jsx";
import GeoTopBar from "../components/geo/GeoTopBar.jsx";

export default function GeoLayout() {
  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      <div className="flex">
        <IconRail />
        <GeoSecondaryNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <GeoTopBar />
          <main className="app-main min-w-0 flex-1 px-4 pb-12 pt-4 lg:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
