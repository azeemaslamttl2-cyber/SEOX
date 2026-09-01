import { useMemo } from "react";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import ReportShell, { ChartCard, DepthBars, StatCard } from "../../../components/auditor/ReportShell.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import {
  issueGroupsForCategory,
  issueRowsForGroups,
  RedirectIncomingInsights,
  TrackedIssuesPanel,
} from "./ReportInsights.jsx";
import { pageExplorerHref } from "./reportLinks.js";

export default function RedirectsReport() {
  const { project, issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "Redirects"));
  const issueRows = issueRowsForGroups(issueGroups);
  const issueCount = (pattern) =>
    issueRows
      .filter((row) => pattern.test(row.title || row.label || ""))
      .reduce((sum, row) => sum + Number(row.crawled || row.count || 0), 0);
  const liveStats = useMemo(() => {
    const redirects = latestUrls.filter((row) => row.status >= 300 && row.status < 400);
    const statusCounts = redirects.reduce((acc, row) => {
      const key = String(row.status || "3xx");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const depthBuckets = redirects.reduce((acc, row) => {
      let depth = 0;
      try {
        const pathname = new URL(row.url).pathname.replace(/^\/|\/$/g, "");
        depth = pathname ? pathname.split("/").filter(Boolean).length : 0;
      } catch { /* keep 0 */ }
      acc[depth] = (acc[depth] || 0) + 1;
      return acc;
    }, {});
    return { redirects, statusCounts, depthBuckets };
  }, [latestUrls]);
  const redirectCount = liveStats.redirects.length;
  const chainCount = issueCount(/redirect chain/i);
  const loopCount = issueCount(/redirect loop/i);
  const brokenChainCount = issueCount(/broken redirect|broken chain/i);
  const redirectSegments = Object.entries(liveStats.statusCounts).length
    ? Object.entries(liveStats.statusCounts).map(([status, value], index) => ({
        label: `${status} redirect`,
        value,
        color: index % 2 ? "#fbbf24" : "#f97316",
      }))
    : [{ label: "No redirects", value: 0, color: "#64748b" }];
  const depthValues = Object.entries(liveStats.depthBuckets)
    .map(([depth, value]) => ({ depth, value, color: "bg-gradient-to-r from-brand-500 to-amber-400" }))
    .filter((item) => item.value > 0);

  return (
    <ReportShell title="Redirects">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Internal URL redirects" value={redirectCount} accent="brand" to={pageExplorerHref("redirects", "Internal URL redirects")} />
              <StatCard label="Redirect chains" value={chainCount} accent="brand" to={pageExplorerHref("redirects", "Redirect chains")} />
              <StatCard label="Redirect loops" value={loopCount} accent="brand" to={pageExplorerHref("redirects", "Redirect loops")} />
              <StatCard label="Broken chains" value={brokenChainCount} accent="rose" to={pageExplorerHref("broken", "Broken chains")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Internal redirect type distribution" hint>
                <DonutChart
                  segments={redirectSegments}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="Destination status code distribution" hint>
                <DonutChart segments={[{ label: "Redirect URLs", value: redirectCount, color: "#fbbf24" }]} size={170} />
              </ChartCard>
            </div>

            <DepthBars
              title="Internal redirect types by depth level"
              values={depthValues}
            />

            <RedirectIncomingInsights project={project} latestUrls={latestUrls} />
          </div>
        )
      }
    </ReportShell>
  );
}
