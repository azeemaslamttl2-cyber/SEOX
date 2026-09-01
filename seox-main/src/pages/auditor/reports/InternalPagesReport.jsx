import { useMemo } from "react";
import ReportShell, { StatCard, ChartCard, DepthBars } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import IssueTable from "../../../components/auditor/IssueTable.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { DiscoverySourceInsights } from "./ReportInsights.jsx";
import { pageExplorerHref } from "./reportLinks.js";

export default function InternalPagesReport() {
  const { project, issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];

  // ── Derive stats from real crawl data when available ──
  const liveStats = useMemo(() => {
    if (latestUrls.length === 0) return null;

    let html = 0, nonHtml = 0, redirects = 0, broken = 0, success = 0;
    const depthBuckets = {};

    for (const row of latestUrls) {
      const status = row.status || 0;
      const ct = (row.contentType || "").toLowerCase();
      const isHtml = /text\/html|application\/xhtml/i.test(ct) || (!ct && status >= 200 && status < 300);

      if (isHtml) html++;
      else nonHtml++;

      if (status >= 300 && status < 400) redirects++;
      else if (status >= 400 || status === 0) broken++;
      else success++;

      // Compute depth from URL
      let depth = 0;
      try {
        const pathname = new URL(row.url).pathname.replace(/^\/|\/$/g, "");
        depth = pathname ? pathname.split("/").filter(Boolean).length : 0;
      } catch { /* default 0 */ }
      depthBuckets[depth] = (depthBuckets[depth] || 0) + 1;
    }

    const total = latestUrls.length;
    const maxDepth = Math.max(0, ...Object.keys(depthBuckets).map(Number));

    return {
      total,
      html,
      nonHtml,
      redirects,
      broken,
      success,
      depthBuckets,
      maxDepth,
    };
  }, [latestUrls]);

  // Use live data if available, otherwise fall back to audit data calculations
  const internal = liveStats?.total ?? 0;
  const errors = liveStats?.broken ?? 0;
  const redirects = liveStats?.redirects ?? 0;
  const success = liveStats?.success ?? Math.max(0, internal - redirects - errors);
  const htmlPages = liveStats?.html ?? 0;
  const nonHtml = liveStats?.nonHtml ?? 0;
  // Build depth bars from live data or computed values
  const depthValues = useMemo(() => {
    if (liveStats?.depthBuckets) {
      const buckets = liveStats.depthBuckets;
      const maxD = Math.min(liveStats.maxDepth, 8);
      return Array.from({ length: maxD + 1 }, (_, i) => ({
        depth: i,
        value: buckets[i] || 0,
        color: "bg-gradient-to-r from-emerald-500 to-emerald-300",
      })).filter((d) => d.value > 0);
    }
    return [];
  }, [liveStats]);

  // ── Extract "Internal pages" issues from issueCategories ──
  const internalIssues = useMemo(() => {
    const category = issueCategories.find((cat) => cat.title === "Internal pages");
    if (!category) return [];
    return category.items || [];
  }, [issueCategories]);

  return (
    <ReportShell title="Internal pages">
      {(tab) => (
        tab === "Issues" ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
            <header className="border-b border-white/10 px-4 py-3">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Internal pages
              </h2>
            </header>
            <IssueTable rows={internalIssues} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Total crawled" value={internal} accent="brand" to={pageExplorerHref("all-crawled", "Total crawled")} />
              <StatCard label="HTML pages" value={htmlPages} accent="brand" to={pageExplorerHref("html", "HTML pages")} />
              <StatCard label="Non-HTML files" value={nonHtml} accent="brand" to={pageExplorerHref("non-html", "Non-HTML files")} />
              <StatCard label="Redirects" value={redirects} accent="amber" to={pageExplorerHref("redirects", "Redirects")} />
              <StatCard label="Broken" value={errors} accent="rose" to={pageExplorerHref("broken", "Broken")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="HTTP status codes distribution" hint>
                <DonutChart
                  segments={[
                    { label: "Success (2xx)", value: success, color: "#34d399" },
                    { label: "Redirect (3xx)", value: redirects, color: "#fbbf24" },
                    { label: "Broken", value: errors, color: "#f43f5e" },
                  ]}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="Protocols distribution" hint>
                <DonutChart
                  segments={[
                    { label: "HTTPS", value: Math.max(0, internal - nonHtml), color: "#34d399" },
                    { label: "HTTP", value: 0, color: "#fbbf24" },
                  ]}
                  size={170}
                />
              </ChartCard>
            </div>

            <DepthBars
              title="HTTP status codes by depth level"
              values={depthValues}
            />

            <DiscoverySourceInsights project={project} totalInternal={htmlPages} latestUrls={latestUrls} />
          </div>
        )
      )}
    </ReportShell>
  );
}
