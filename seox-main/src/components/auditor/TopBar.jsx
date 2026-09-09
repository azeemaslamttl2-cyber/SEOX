import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronDown,
  Globe2,
  Layers,
  Settings,
  Printer,
  Search,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { project as fallbackProject } from "../../data/auditorData.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCrawl } from "../../context/CrawlContext.jsx";
import Avatar from "../Avatar.jsx";

export default function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    project,
    projects,
    selectedProjectId,
    projectStates,
    status,
    selectProject,
    deleteProject,
    stopCrawl,
  } = useCrawl();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [issueQuery, setIssueQuery] = useState("");
  const [segmentOpen, setSegmentOpen] = useState(false);

  const displayName = project?.name || "Add website";
  const isCrawling = status === "crawling";
  const crawledDate = project?.crawledOn || fallbackProject.crawledOn;

  const submitIssueSearch = (event) => {
    event.preventDefault();
    const query = issueQuery.trim();
    navigate(query ? `/auditor/issues?q=${encodeURIComponent(query)}` : "/auditor/issues");
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-ink-900/85 px-4 backdrop-blur-xl">
      {/* Project selector */}
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <button
            onClick={() => setSwitcherOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 transition hover:bg-white/[0.08]"
            aria-expanded={switcherOpen}
          >
            <span className="h-5 w-5 flex items-center justify-center rounded bg-gradient-to-br from-brand-500 to-amber-400 text-[9px] font-bold text-white">
              {(displayName || "S")[0].toUpperCase()}
            </span>
            <span className="font-semibold text-white">Site Audit</span>
            <span className="text-white/40">/</span>
            <span className="max-w-[140px] truncate text-white/80">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          </button>

          {switcherOpen && (
            <div role="menu" className="site-menu animate-scale-in absolute left-0 top-10 z-30 w-80 overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-2xl shadow-black/40">
              <div className="site-menu-label border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Websites
              </div>
              <div className="max-h-80 overflow-y-auto p-1.5">
                {projects.map((site) => {
                  const siteState = projectStates[site.id];
                  const active = site.id === selectedProjectId;
                  const siteStatus = siteState?.status || "idle";
                  const crawledCount = siteState?.stats?.crawledCount || site.totalUrls || 0;
                  return (
                    <div
                      key={site.id}
                      className={`site-menu-row group flex w-full items-center gap-2 rounded-lg px-2 py-2 transition ${
                        active ? "is-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          selectProject(site.id);
                          setSwitcherOpen(false);
                        }}
                        className="site-menu-select flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                      <span className="site-menu-icon flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                        <Globe2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {site.name}
                        </span>
                        <span className="site-menu-url block truncate text-xs">
                          {site.fullUrl || site.domain}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {active && <Check className="h-4 w-4 text-brand-300" />}
                        <span className="site-menu-count text-[10px] uppercase tracking-wide">
                          {siteStatus === "crawling"
                            ? "Live"
                            : `${crawledCount.toLocaleString()} URLs`}
                        </span>
                      </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const remainingCount = deleteProject(site.id);
                          setSwitcherOpen(false);
                          if (remainingCount === 0) {
                            navigate("/auditor/new", { replace: true });
                          }
                        }}
                        title={`Delete ${site.name}`}
                        className="site-menu-delete flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                {projects.length === 0 && (
                  <div className="px-3 py-5 text-center text-xs text-white/45">
                    No websites yet.
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate("/auditor/new")}
                className="site-menu-add flex w-full items-center gap-2 border-t px-3 py-2 text-xs font-semibold transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add website
              </button>
            </div>
          )}
        </div>

        <Link
          to="/auditor/log"
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 transition hover:bg-white/[0.08]"
        >
          <Calendar className="h-3.5 w-3.5 text-white/50" />
          <span className="text-white/85">
            {isCrawling ? "Now" : crawledDate.split(" ").slice(0, 2).join(" ")}
          </span>
          {isCrawling && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-400" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-brand-400" />
              </span>
              Crawling
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        </Link>

      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <form
          onSubmit={submitIssueSearch}
          className="hidden h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs lg:flex"
        >
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            value={issueQuery}
            onChange={(event) => setIssueQuery(event.target.value)}
            placeholder="Search issues, URLs…"
            className="w-44 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-white/40">
            /
          </kbd>
        </form>

        <button
          type="button"
          onClick={() => setSegmentOpen(true)}
          className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] xl:flex"
        >
          <Layers className="h-3.5 w-3.5" /> Segment <ChevronDown className="h-3 w-3" />
        </button>

        {isCrawling ? (
          <button
            onClick={stopCrawl}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
          >
            <Square className="h-3.5 w-3.5 fill-current" /> Stop crawl
          </button>
        ) : (
          <button
            onClick={() => navigate("/auditor/new")}
            className="group inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-brand-glow transition hover:scale-[1.02]"
          >
            <Plus className="h-3.5 w-3.5" /> New crawl
          </button>
        )}

        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.04] hover:text-white">
          <Settings className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          title="Print to PDF"
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.04] hover:text-white sm:flex"
        >
          <Printer className="h-4 w-4" />
        </button>

        {user && <Avatar user={user} size={32} className="ml-1" />}
      </div>
      {segmentOpen && (
        <SegmentModal
          resultCount={projectStates[selectedProjectId]?.stats?.crawledCount || 0}
          onClose={() => setSegmentOpen(false)}
        />
      )}
    </header>
  );
}

function SegmentModal({ resultCount, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="absolute right-6 top-16 w-[min(1030px,calc(100vw-48px))] overflow-hidden rounded-lg border border-white/10 bg-[#2f3032] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
          <h2 className="text-lg font-bold">Segment filter</h2>
          <button onClick={onClose} className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white">
            x
          </button>
        </div>
        <div className="space-y-2 border-b border-white/10 p-3">
          <div className="flex items-center">
            <button className="rounded-l border border-amber-500/40 bg-amber-600 px-3 py-1 text-xs font-bold">AND</button>
            <button className="rounded-r border border-white/20 px-3 py-1 text-xs font-bold text-white/75">OR</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded border border-white/20 px-3 py-1 text-xs font-semibold text-white/75">Previous</button>
            <button className="rounded border border-amber-500/40 bg-amber-600 px-3 py-1 text-xs font-semibold">Current</button>
            <select className="h-8 min-w-64 rounded border border-white/20 bg-[#353638] px-2 text-xs">
              <option>URL</option>
              <option>Status code</option>
              <option>Content type</option>
            </select>
            <select className="h-8 min-w-48 rounded border border-white/20 bg-[#353638] px-2 text-xs">
              <option>Exists</option>
              <option>Contains</option>
              <option>Does not contain</option>
            </select>
            <button className="h-8 rounded border border-white/20 px-3 text-lg leading-none text-white/80">x</button>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">+ Rule</button>
            <button className="rounded border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">+ Group</button>
          </div>
        </div>
        <div className="flex items-center gap-4 border-b border-white/10 px-3 py-4">
          <button disabled className="rounded border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-white/35">
            Apply
          </button>
          <span className="text-sm font-semibold text-white/55">
            {resultCount.toLocaleString()} results matching
          </span>
          <button className="text-sm font-semibold text-sky-300 hover:underline">Reset</button>
          <button className="ml-auto text-sm font-semibold text-white/55 hover:text-white">+ Save segment...</button>
        </div>
        <div className="h-[50vh]" />
      </div>
    </div>
  );
}
