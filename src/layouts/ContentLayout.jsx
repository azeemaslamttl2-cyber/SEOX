import IconRail from "../components/auditor/IconRail.jsx";
import ContentSecondaryNav from "../components/content/ContentSecondaryNav.jsx";
import ContentTopBar from "../components/content/ContentTopBar.jsx";
import RouteOutlet from "../components/RouteOutlet.jsx";

export default function ContentLayout() {
  // `min-h-[100dvh]` let the shell grow with the page, so `overflow-hidden`
  // never clamped it and the window scrolled instead of <main> — taking the
  // icon rail, sidebar and top bar with it. Every other app layout pins the
  // shell to the viewport so only the main column scrolls.
  return (
    <div className="app-shell flex h-[100dvh] overflow-hidden bg-ink-900 text-white">
      <IconRail />
      <ContentSecondaryNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ContentTopBar />
        <main className="app-main min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <RouteOutlet />
        </main>
      </div>
    </div>
  );
}
