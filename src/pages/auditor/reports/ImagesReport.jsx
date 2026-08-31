import DonutChart from "../../../components/auditor/DonutChart.jsx";
import ReportShell, { ChartCard, StatCard } from "../../../components/auditor/ReportShell.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { issueGroupsForCategory, issueRowsForGroups, TrackedIssuesPanel } from "../../../lib/auditor/reports/ReportInsights.jsx";
import { imageStats, safeSegments } from "../../../lib/auditor/reports/liveReportData.js";

export default function ImagesReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const report = imageStats(stats?.latestUrls || [], stats?.auditIssues || {});
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "Images"));
  const issueRows = issueRowsForGroups(issueGroups);

  return (
    <ReportShell title="Images">
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
              <ChartCard title="Alt attribute distribution" hint>
                <DonutChart segments={safeSegments(report.altSegments)} size={170} />
              </ChartCard>
              <ChartCard title="Image subtype distribution" hint>
                <DonutChart segments={safeSegments(report.subtypeSegments)} size={170} />
              </ChartCard>
            </div>
          </div>
        )
      }
    </ReportShell>
  );
}
