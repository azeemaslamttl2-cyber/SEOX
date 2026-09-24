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
  X,
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
          <button onClick={stopCrawl} className="crawl-stop">
            <Square className="fill-current" /> Stop crawl
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

/**
 * The segment builder, opened from the top bar.
 *
 * Presentation only, as it was before: nothing here is wired up yet. Every
 * control is a placeholder for the rule engine, so this is a layout of the
 * form the engine will eventually fill, not a form that does anything.
 *
 * It was the last dark-theme screen left in the auditor. The panel carried a
 * hard-coded `bg-[#2f3032]`, which the light-theme compatibility layer has no
 * way to rewrite, and none of its buttons declared a recognised variant class
 * - so the application-wide button hierarchy painted every one of them solid
 * brand red. A filter builder where AND, OR, Previous, Current, + Rule,
 * + Group and the remove button are all the same red pill says nothing about
 * which of them is selected. Styling now lives in the `.segment-*` rules in
 * index.css, on the same tokens as the rest of the product.
 */
function SegmentModal({ resultCount, onClose }) {
  return (
    <div className="segment-backdrop">
      <div
        className="segment-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Segment filter"
      >
        <header className="segment-head">
          <span className="segment-head-icon" aria-hidden="true">
            <Layers />
          </span>
          <div className="segment-head-copy">
            <h2>Segment filter</h2>
            <p>Narrow the crawl to the pages that match these rules.</p>
          </div>
          <button onClick={onClose} className="segment-close" aria-label="Close">
            <X />
          </button>
        </header>

        <div className="segment-body">
          {/* How the rules combine. A segmented control, so the chosen one is
              the only filled pill on the row. */}
          <div className="segment-seg" role="group" aria-label="Combine rules with">
            <button type="button" className="segment-seg-btn is-active" aria-pressed="true">
              AND
            </button>
            <button type="button" className="segment-seg-btn" aria-pressed="false">
              OR
            </button>
          </div>

          <div className="segment-rule">
            <div className="segment-seg" role="group" aria-label="Crawl to compare">
              <button type="button" className="segment-seg-btn" aria-pressed="false">
                Previous
              </button>
              <button type="button" className="segment-seg-btn is-active" aria-pressed="true">
                Current
              </button>
            </div>

            <label className="segment-field">
              <span className="segment-field-label">Field</span>
              <select className="segment-select" aria-label="Field">
                <option>URL</option>
                <option>Status code</option>
                <option>Content type</option>
              </select>
            </label>

            <label className="segment-field">
              <span className="segment-field-label">Condition</span>
              <select className="segment-select" aria-label="Condition">
                <option>Exists</option>
                <option>Contains</option>
                <option>Does not contain</option>
              </select>
            </label>

            <button type="button" className="segment-rule-remove" aria-label="Remove this rule">
              <Trash2 />
            </button>
          </div>

          <div className="segment-add">
            <button type="button" className="segment-btn">
              <Plus />
              Rule
            </button>
            <button type="button" className="segment-btn">
              <Plus />
              Group
            </button>
          </div>
        </div>

        <footer className="segment-foot">
          <button type="button" disabled className="segment-btn is-primary">
            Apply
          </button>
          <span className="segment-count">
            <strong>{resultCount.toLocaleString()}</strong> results matching
          </span>
          <button type="button" className="segment-link">
            Reset
          </button>
          <button type="button" className="segment-link is-end">
            <Plus />
            Save segment
          </button>
        </footer>
      </div>
    </div>
  );
}
