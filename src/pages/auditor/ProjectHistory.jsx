import { CheckCircle2, Clock3, Verified } from "lucide-react";
import { useCrawl, formatDuration } from "../../context/CrawlContext.jsx";

export default function ProjectHistory() {
  const { project, status, stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const crawled = stats?.crawledCount || latestUrls.length || 0;
  const errors = (stats?.byStatus?.["4xx"] || 0) + (stats?.byStatus?.["5xx"] || 0);
  const internalPages = latestUrls.filter((row) =>
    String(row.contentType || "").toLowerCase().includes("text/html")
  ).length;
  const resources = Math.max(0, crawled - internalPages);
  const health = crawled ? Math.max(0, Math.round(((crawled - errors) / crawled) * 100)) : 0;
  const rows = crawled
    ? [
        {
          date: stats?.finishedAt
            ? new Date(stats.finishedAt).toLocaleString()
            : stats?.startedAt
            ? new Date(stats.startedAt).toLocaleString()
            : "Current crawl",
          duration: formatDuration(stats?.duration || 0) || "-",
          status: status === "crawling" ? "Crawling" : status === "complete" ? "Completed" : "Idle",
          health,
          urls: crawled,
          internal: internalPages,
          external: 0,
          resources,
          errors,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight">Project history</h1>
        <div className="flex items-center gap-1.5 text-xs text-white/70">
          <span className="font-mono">{project?.fullUrl || project?.domain || "No project selected"}</span>
          {project && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Verified className="h-3 w-3" /> Active
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="URLs crawled" value={crawled.toLocaleString()} />
        <MetricCard label="Health score" value={crawled ? `${health}%` : "-"} />
        <MetricCard label="Internal URLs having errors" value={errors.toLocaleString()} tone="rose" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">
          {rows.length} crawl{rows.length === 1 ? "" : "s"}
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Clock3 className="h-10 w-10 text-white/20" />
            <p className="text-sm font-medium text-white/60">No crawl history yet</p>
            <p className="max-w-md text-xs text-white/35">
              Run a crawl to populate this page with real crawl data. Historical snapshots are only shown after they exist.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Duration</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Health score</th>
                  <th className="px-3 py-3 text-right font-medium">Total URLs crawled</th>
                  <th className="px-3 py-3 text-right font-medium">Internal pages</th>
                  <th className="px-3 py-3 text-right font-medium">External pages</th>
                  <th className="px-3 py-3 text-right font-medium">Total resources</th>
                  <th className="px-3 py-3 text-right font-medium">Internal URLs having errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                    <td className="px-4 py-3 font-medium text-white">{row.date}</td>
                    <td className="px-3 py-3 text-white/70">{row.duration}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-400">
                      {row.health}%
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-brand-300">{row.urls.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-brand-300">{row.internal.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/60">{row.external.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/80">{row.resources.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-rose-400">{row.errors.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = "brand" }) {
  const toneClass = tone === "rose" ? "text-rose-300" : "text-brand-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }) {
  if (status === "Crawling") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-2.5 py-0.5 text-xs font-semibold text-brand-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
        Crawling
      </span>
    );
  }
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  return <span className="text-white/40">{status}</span>;
}
