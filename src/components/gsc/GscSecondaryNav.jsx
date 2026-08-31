import { NavLink, useLocation, useParams } from "react-router-dom";
import { Zap, ChevronRight } from "lucide-react";
import { useGscInsights } from "../../context/GscInsightsContext.jsx";

export default function GscSecondaryNav() {
  const { siteId } = useParams();
  const { pathname } = useLocation();
  const { handleSignIn, normalizedSites, selectedSiteInfo } = useGscInsights();
  const isBulkAnalysis = pathname.includes("bulk-analysis");
  const activeSiteId = isBulkAnalysis ? null : siteId;
  const site = normalizedSites.find((s) => s.id === activeSiteId) || selectedSiteInfo;

  const nav = activeSiteId
    ? [
        {
          section: `GSC / ${site?.name || "Site"}`,
          items: [
            { label: "Overview", to: `/gsc/${activeSiteId}`, end: true },
            { label: "Keywords", to: `/gsc/${activeSiteId}/keywords` },
            { label: "Pages", to: `/gsc/${activeSiteId}/pages` },
            { label: "Anonymous queries", to: `/gsc/${activeSiteId}/anonymous` },
          ],
        },
      ]
    : [
        {
          section: "GSC Insights",
          items: [
            { label: "GSC Insights", to: "/gsc", end: true },
            { label: "Google Bulk Analysis", to: "/gsc/bulk-analysis" },
            { label: "Bing Bulk Analysis", to: "/gsc/bing-bulk-analysis" },
            { label: "Yandex Bulk Analysis", to: "/gsc/yandex-bulk-analysis" },
          ],
        },
      ];

  return (
    <aside className="app-sidebar sticky top-0 hidden h-full w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <nav className="space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              {section.section}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? "bg-gradient-to-r from-brand-500/15 to-transparent text-brand-200"
                          : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="h-1 w-1 rounded-full bg-brand-400" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Settings link for site detail */}
        {activeSiteId && (
          <div className="mx-1 mt-6 rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/15 to-transparent p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-300">
              <Zap className="h-3.5 w-3.5" /> Connect more sites
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              Link additional Google Search Console properties to PGC.
            </p>
            <button
              onClick={handleSignIn}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-200 hover:underline"
            >
              Add property <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}
