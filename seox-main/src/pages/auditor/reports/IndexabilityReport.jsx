import { useMemo } from "react";
import ReportShell, { StatCard, ChartCard, DepthBars } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { IndexabilityDonutInsights, TrackedIssuesPanel } from "./ReportInsights.jsx";
import { pageExplorerHref } from "./reportLinks.js";

function isHtmlContentType(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  if (/text\/html|application\/xhtml/i.test(ct)) return true;
  if (!ct) {
    try {
      return !/\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|avif|bmp|xml|json|woff2?|ttf|eot|pdf|zip)$/i.test(new URL(url).pathname);
    } catch {
      return true;
    }
  }
  return false;
}

export default function IndexabilityReport() {
  const { crawledUrls, errorDistribution, issueCategories, issueDetail } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const auditIssues = stats?.auditIssues || {};

  const liveStats = useMemo(() => {
    if (!latestUrls.length) return null;
    const noindexUrls = new Set(
      (auditIssues?.["noindex-page"]?.urls || [])
        .map((item) => item.url)
        .filter(Boolean)
    );
    const pages = latestUrls.filter((row) => row.url && isHtmlContentType(row.contentType, row.url));
    let indexable = 0;
    let blocked = 0;
    let noindexCount = 0;
    let non200Count = 0;
    const depthBuckets = {};

    pages.forEach((row) => {
      const robots = `${row.robotsMeta || ""} ${row.audit?.robotsMeta || ""} ${row.xRobotsTag || ""}`;
      const noindex = noindexUrls.has(row.url) || /\bnoindex\b/i.test(robots);
      const isBlocked = Boolean(row.robotsTxtBlocked || row.blockedByRobotsTxt || row.audit?.blockedByRobotsTxt);
      if (noindex) noindexCount += 1;
      if (row.status < 200 || row.status >= 300) non200Count += 1;
      const ok = row.status >= 200 && row.status < 300 && !noindex && !isBlocked;
      if (ok) indexable += 1;
      if (isBlocked) blocked += 1;

      let depth = 0;
      try {
        const pathname = new URL(row.url).pathname.replace(/^\/|\/$/g, "");
        depth = pathname ? pathname.split("/").filter(Boolean).length : 0;
      } catch { /* keep 0 */ }
      const key = Math.min(depth, 8);
      depthBuckets[key] = (depthBuckets[key] || 0) + (ok ? 0 : 1);
    });

    return {
      total: pages.length,
      indexable,
      nonIndexable: Math.max(0, pages.length - indexable),
      blocked,
      noindexCount,
      non200Count,
      depthBuckets,
    };
  }, [latestUrls, auditIssues]);

  const totalInternal = liveStats?.total ?? 0;
  const nonIndexable = liveStats?.nonIndexable ?? 0;
  const indexable = liveStats?.indexable ?? 0;
  const blockedRobots = liveStats?.blocked ?? 0;
  const noindexCount = liveStats?.noindexCount ?? 0;
  const non200Count = liveStats?.non200Count ?? 0;
  const depthValues = liveStats
    ? Object.entries(liveStats.depthBuckets)
        .map(([depth, value]) => ({ depth, value, color: "bg-gradient-to-r from-amber-500 to-amber-300" }))
        .filter((item) => item.value > 0)
    : [];

  const indexabilityRows =
    issueCategories.find((category) => category.title === "Indexability")?.items || [];

  return (
    <ReportShell title="Indexability">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={indexabilityRows} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total internal" value={totalInternal} accent="brand" to={pageExplorerHref("html", "Total internal")} />
              <StatCard label="Indexable" value={indexable} accent="emerald" to={pageExplorerHref("indexable", "Indexable")} />
              <StatCard label="Non-indexable" value={nonIndexable} accent="amber" to={pageExplorerHref("non-indexable", "Non-indexable")} />
              <StatCard label="Blocked by robots.txt" value={blockedRobots} sub={`${blockedRobots} links`} accent="rose" to={pageExplorerHref("blocked-robots", "Blocked by robots.txt")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Indexability distribution" hint>
                <DonutChart
                  segments={[
                    { label: "Indexable", value: indexable, color: "#34d399" },
                    { label: "Non-indexable", value: nonIndexable, color: "#fbbf24" },
                  ]}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="Non-indexability causes" hint>
                <DonutChart
                  segments={[
                    { label: "Non-200", value: non200Count, color: "#f97316" },
                    { label: "Noindex", value: noindexCount, color: "#fbbf24" },
                  ]}
                  size={170}
                />
              </ChartCard>
            </div>

            <DepthBars
              title="Indexability by depth level"
              values={depthValues}
            />

            <IndexabilityDonutInsights indexable={indexable} nonIndexable={nonIndexable} latestUrls={latestUrls} />
          </div>
        )
      }
    </ReportShell>
  );
}
