import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Activity,
  Clock,
} from "lucide-react";
import { useCrawl, formatDuration, formatTime } from "../../context/CrawlContext.jsx";

const STATUS_COLORS = {
  "2xx": "#34d399", // emerald-400
  "3xx": "#fbbf24", // amber-400
  "4xx": "#f43f5e", // rose-500
  "5xx": "#a855f7", // purple-500
};

const STATUS_BADGE_COLORS = {
  2: "bg-emerald-500/15 text-emerald-400",
  3: "bg-amber-500/15 text-amber-400",
  4: "bg-rose-500/15 text-rose-400",
  5: "bg-purple-500/15 text-purple-400",
};

export default function CrawlLog() {
  const { project, status, stats, startCrawl, stopCrawl, resumeCrawl, resetCrawl } =
    useCrawl();
  const crawledHtmlPages = stats.latestUrls.filter((row) =>
    String(row.contentType || "").toLowerCase().includes("text/html")
  ).length;

  // Auto-scroll prevention: don't, but mark new rows briefly
  const seenRef = useRef(new Set());
  useEffect(() => {
    stats.latestUrls.forEach((u) => {
      const k = u.url + u.time;
      if (!seenRef.current.has(k)) {
        seenRef.current.add(k);
      }
    });
  }, [stats.latestUrls]);

  // No project yet
  if (!project) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <Activity className="h-5 w-5 text-brand-400" />
            Crawl log
          </h1>
          {status === "crawling" && (
            <span className="flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-400" />
                <span className="relative h-2 w-2 rounded-full bg-brand-400" />
              </span>
              Crawling
            </span>
          )}
          {status === "complete" && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "crawling" ? (
            <button
              onClick={stopCrawl}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/15"
            >
              <Pause className="h-3.5 w-3.5" /> Stop crawl
            </button>
          ) : status === "complete" ? (
            <>
              <button
                onClick={resumeCrawl}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08]"
              >
                <Play className="h-3.5 w-3.5" /> Resume
              </button>
              <Link
                to="/auditor/new"
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-brand-glow"
              >
                <RotateCcw className="h-3.5 w-3.5" /> New crawl
              </Link>
            </>
          ) : (
            <button
              onClick={() => startCrawl(project)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-brand-glow"
            >
              <Play className="h-3.5 w-3.5" /> Start crawl
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="grid grid-cols-2 divide-x divide-white/5 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi
            label="From"
            value={stats.startedAt ? "Today" : "—"}
            sub={stats.startedAt ? formatTime(stats.startedAt) : ""}
          />
          <Kpi
            label="To"
            value={status === "crawling" ? "Now" : stats.finishedAt ? "Today" : "—"}
            sub={
              status === "crawling"
                ? formatTime(new Date())
                : stats.finishedAt
                ? formatTime(stats.finishedAt)
                : ""
            }
            highlight={status === "crawling"}
          />
          <Kpi
            label="Duration"
            value={formatDuration(stats.duration)}
            sub="hh:mm:ss"
            mono
          />
          <Kpi
            label="URLs crawled"
            value={stats.crawledCount.toLocaleString()}
            sub={`${stats.scheduled.toLocaleString()} scheduled`}
            big
          />
          <Kpi
            label="HTML pages"
            value={crawledHtmlPages.toLocaleString()}
            sub="captured in this crawl"
          />
        </div>
      </div>

      {/* URLs crawled (per-minute bar chart) */}
      <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-white">URLs crawled</h3>
            <HelpCircle className="h-3.5 w-3.5 text-white/30" />
            <span className="ml-1 text-xs text-white/40">1 bar ≈ 5 s</span>
          </div>
          <Legend />
        </div>
        <CrawlChart bars={stats.perMinute} max={120} />
      </div>

      {/* Latest URLs crawled */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Latest URLs crawled</h3>
          {status === "crawling" && (
            <span className="flex items-center gap-1.5 text-xs text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Streaming live
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-1.5 py-2.5 font-medium">Content type</th>
                <th className="px-1.5 py-2.5 text-right font-medium">Load time</th>
                <th className="px-3 py-2.5 text-right font-medium">Size</th>
                <th className="px-3 py-2.5 text-right font-medium">Outlinks</th>
                <th className="px-3 py-2.5 font-medium">URL</th>
              </tr>
            </thead>
            <tbody>
              {stats.latestUrls.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                    <Clock className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    Waiting for the crawler to discover URLs…
                  </td>
                </tr>
              )}
              {stats.latestUrls.slice(0, 30).map((u) => (
                <tr
                  key={u.id || u.url}
                  className="animate-row-in border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]"
                >
                  <td className="px-4 py-2 font-mono text-xs text-white/70">
                    {formatTime(u.time)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge code={u.status} />
                  </td>
                  <td className="px-1.5 py-2 text-xs text-white/60">{u.contentType}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-white/70">
                    {u.loadTime} ms
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/70">
                    {u.sizeKb.toFixed(1)}K
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/70">
                    {u.outlinks}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-brand-300 hover:underline"
                    >
                      <span className="break-all">{u.url}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Local CSS for slide-in animation */}
      <style>{`
        @keyframes rowIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
        .animate-row-in { animation: rowIn 200ms ease-out both }
      `}</style>
    </div>
  );
}

/* ---------- helpers ---------- */
function Kpi({ label, value, sub, big, mono, highlight }) {
  return (
    <div className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div
        className={`mt-1 font-display font-bold ${big ? "text-3xl" : "text-2xl"} ${
          mono ? "font-mono tabular-nums" : ""
        } ${highlight ? "gradient-text" : "text-white"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      {Object.entries(STATUS_COLORS).map(([code, color]) => (
        <span key={code} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-white/60">{code}</span>
        </span>
      ))}
    </div>
  );
}

function CrawlChart({ bars, max }) {
  // Last 60 bars visible; pad with empty slots so the chart fills
  const slots = 60;
  const data = [...bars];
  while (data.length < slots) data.push(null);
  const visible = data.slice(-slots);
  const maxVal = Math.max(
    max,
    ...visible.map((b) => (b ? b.total : 0)),
    1
  );

  return (
    <div className="relative mt-4">
      {/* Y-axis ticks */}
      <div className="absolute right-0 top-0 flex h-44 flex-col justify-between text-[10px] text-white/30">
        {[1, 2, 3, 4].map((n) => (
          <span key={n}>{Math.round((maxVal / 4) * (5 - n))}</span>
        ))}
      </div>

      {/* Bars */}
      <div className="relative flex h-44 items-end gap-[2px] pr-6">
        {visible.map((b, i) => {
          if (!b) {
            return (
              <div key={i} className="flex-1 rounded-sm bg-white/[0.03]" style={{ height: 2 }} />
            );
          }
          const total = b.total;
          const heightPct = (total / maxVal) * 100;
          return (
            <div
              key={i}
              className="relative flex-1 overflow-hidden rounded-sm"
              style={{ height: `${heightPct}%`, minHeight: 2 }}
              title={`${total} URLs`}
            >
              {/* Stack by status from bottom up */}
              <StatusStack byStatus={b.byStatus} />
            </div>
          );
        })}
      </div>

      {/* X-axis baseline (green) */}
      <div className="mt-1 h-1 rounded-full bg-gradient-to-r from-emerald-500/40 via-emerald-400 to-emerald-500/40" />
    </div>
  );
}

function StatusStack({ byStatus }) {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-full w-full flex-col-reverse">
      {Object.entries(byStatus).map(([code, count]) => {
        if (!count) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={code}
            style={{ height: `${pct}%`, backgroundColor: STATUS_COLORS[code] }}
          />
        );
      })}
    </div>
  );
}

function StatusBadge({ code }) {
  if (!code) {
    return (
      <span className="inline-block min-w-[36px] rounded-md bg-rose-500/15 px-2 py-0.5 text-center text-xs font-bold text-rose-400">
        ERR
      </span>
    );
  }
  const c = Math.floor(code / 100);
  const cls = STATUS_BADGE_COLORS[c] || "bg-white/10 text-white/60";
  return (
    <span className={`inline-block min-w-[36px] rounded-md px-2 py-0.5 text-center text-xs font-bold tabular-nums ${cls}`}>
      {code}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl py-20 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/10">
        <Activity className="h-8 w-8 text-brand-300" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
        No active crawl
      </h1>
      <p className="mt-2 text-sm text-white/55">
        Create a project to start crawling your site. The crawl log will stream live URLs
        here as they're discovered.
      </p>
      <Link
        to="/auditor/new"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-2.5 text-sm font-semibold shadow-brand-glow transition hover:scale-[1.02]"
      >
        <Sparkles className="h-4 w-4" />
        Create a project
      </Link>
    </div>
  );
}
