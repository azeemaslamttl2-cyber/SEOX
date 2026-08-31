import DonutChart from "../../../components/auditor/DonutChart.jsx";
import ReportShell, { ChartCard, StatCard } from "../../../components/auditor/ReportShell.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { issueGroupsForCategory, issueRowsForGroups, TrackedIssuesPanel } from "../../../lib/auditor/reports/ReportInsights.jsx";
import { resourceStats, safeSegments } from "../../../lib/auditor/reports/liveReportData.js";

export default function JavaScriptReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const report = resourceStats(stats?.latestUrls || [], "javascript");
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "JavaScript"));
  const issueRows = issueRowsForGroups(issueGroups);

  return (
    <ReportShell title="JavaScript">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Crawled" value={report.crawled} accent="brand" />
              <StatCard label="Redirects" value={report.redirects} accent="brand" />
              <StatCard label="Broken" value={report.broken} accent="rose" />
              <StatCard label="Blocked by robots.txt" value={report.blocked} sub={`${report.blocked} links`} accent="brand" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="HTTP status codes distribution" hint>
                <DonutChart segments={safeSegments(report.statusSegments)} size={170} />
              </ChartCard>
              <ChartCard title="Protocols distribution" hint>
                <DonutChart segments={safeSegments(report.protocolSegments)} size={170} />
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="File size distribution" hint>
                <DonutChart segments={safeSegments(report.fileSizeSegments)} size={170} />
              </ChartCard>
              <ChartCard title="Load time distribution" hint>
                <DonutChart segments={safeSegments(report.loadTimeSegments)} size={170} />
              </ChartCard>
            </div>
          </div>
        )
      }
    </ReportShell>
  );
}
