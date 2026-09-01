import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChevronDown,
  Globe2,
  Check,
  Settings,
  Search,
  Plus,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCrawl } from "../../context/CrawlContext.jsx";
import { useGscInsights } from "../../context/GscInsightsContext.jsx";
import { filterSitesByProjects } from "../../lib/domainMatching.js";
import Avatar from "../Avatar.jsx";

export default function GscTopBar() {
  const { user } = useAuth();
  const { projects } = useCrawl();
  const {
    error,
    handleSignIn,
    gscEmail,
    isSignedIn,
    isStartingConnection,
    normalizedSites,
    setSelectedSite,
  } = useGscInsights();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { siteId } = useParams();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const profileSites = useMemo(
    () => filterSitesByProjects(normalizedSites, projects),
    [normalizedSites, projects]
  );
  const activeSiteId = pathname.includes("bulk-analysis") ? null : siteId;
  const currentSite = activeSiteId
    ? profileSites.find((site) => site.id === activeSiteId) || null
    : null;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-ink-900/85 px-4 backdrop-blur-xl">
      {/* Left: breadcrumb / project selector */}
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 transition hover:bg-white/[0.08]"
          >
            <span className="h-5 w-5 flex items-center justify-center rounded bg-gradient-to-br from-emerald-500 to-teal-400 text-[9px] font-bold text-white">
              G
            </span>
            <span className="font-semibold text-white">GSC Insights</span>
            {currentSite && (
              <>
                <span className="text-white/40">/</span>
                <span className="max-w-[180px] truncate text-white/80">
                  {currentSite.name}
                </span>
              </>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          </button>

          {switcherOpen && (
            <div className="absolute left-0 top-10 z-30 w-80 overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-2xl shadow-black/40">
              <div className="border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                GSC Properties
              </div>
              <div className="max-h-80 overflow-y-auto p-1.5">
                {normalizedSites.length === 0 && (
                  <div className="px-3 py-4 text-xs leading-relaxed text-white/50">
                    Connect Google Search Console to list your verified
                    properties here.
                  </div>
                )}
                {normalizedSites.length > 0 && profileSites.length === 0 && (
                  <div className="px-3 py-4 text-xs leading-relaxed text-white/50">
                    No Search Console properties match your saved projects.
                    Add the domain as a project to show it here.
                  </div>
                )}
                {profileSites.map((site) => {
                  const active = site.id === activeSiteId;
                  return (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSelectedSite(site.siteUrl);
                        navigate(`/gsc/${site.id}`);
                        setSwitcherOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                        active
                          ? "bg-brand-500/15 text-white"
                          : "text-white/75 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/75">
                        <Globe2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {site.name}
                        </span>
                        <span className="block truncate text-xs text-white/45">
                          {site.domain}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {active && <Check className="h-4 w-4 text-brand-300" />}
                        {site.verified && (
                          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            Verified
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Link
                to="/gsc"
                onClick={() => setSwitcherOpen(false)}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-xs font-semibold text-brand-200 transition hover:bg-brand-500/10"
              >
                <Globe2 className="h-3.5 w-3.5" />
                GSC Insights
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <div className="hidden h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs lg:flex">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Search keywords, pages…"
            className="w-44 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSignIn}
          disabled={isStartingConnection}
          className="group inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition hover:scale-[1.02]"
        >
          <Plus className="h-3.5 w-3.5" />
          {isStartingConnection ? "Opening Google..." : isSignedIn ? "Reconnect GSC" : "Connect GSC"}
        </button>

        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.04] hover:text-white">
          <Settings className="h-4 w-4" />
        </button>

        {error && (
          <span
            title={error}
            className="hidden max-w-[260px] truncate rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 xl:block"
          >
            {error}
          </span>
        )}
        {gscEmail && (
          <span className="hidden max-w-[180px] truncate text-xs text-white/45 xl:block">
            {gscEmail}
          </span>
        )}
        {user && <Avatar user={user} size={32} className="ml-1" />}
      </div>
    </header>
  );
}
