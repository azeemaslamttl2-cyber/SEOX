import { Outlet } from "react-router-dom";
import IconRail from "../components/auditor/IconRail.jsx";
import BrandRadarSecondaryNav from "../components/brandradar/BrandRadarSecondaryNav.jsx";
import BrandRadarTopBar from "../components/brandradar/BrandRadarTopBar.jsx";

export default function BrandRadarLayout() {
  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      <div className="flex">
        <IconRail />
        <BrandRadarSecondaryNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <BrandRadarTopBar />
          <main className="app-main min-w-0 flex-1 px-4 pb-12 pt-4 lg:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
