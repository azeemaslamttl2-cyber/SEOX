import ReportShell, { StatCard, ChartCard } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { htmlRows, safeSegments } from "../../../lib/auditor/reports/liveReportData.js";

export default function SitemapsReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const auditIssues = stats?.auditIssues || {};
  const sitemapCategory = issueCategories.find((category) => category.title === "Sitemaps");
  const sitemapIssueRows = [
    ...(sitemapCategory?.items || []),
    ...((sitemapCategory?.subgroups || []).flatMap((group) => group.items || [])),
  ];
  const issueCount = (pattern) =>
    sitemapIssueRows
      .filter((row) => pattern.test(row.title || ""))
      .reduce((sum, row) => sum + Number(row.crawled || row.count || 0), 0);
  const sitemapErrorCount = sitemapIssueRows
    .filter((row) => row.severity === "error")
    .reduce((sum, row) => sum + Number(row.crawled || row.count || 0), 0);
  const pages = htmlRows(latestUrls).filter((row) => row.status >= 200 && row.status < 300);
  const notInSitemap = Number(auditIssues?.["indexable-page-not-in-sitemap"]?.crawled || 0) || issueCount(/not in sitemap/i);
  const inSitemap = Math.max(0, pages.length - notInSitemap);
  const multipleSitemaps = Number(auditIssues?.["page-in-multiple-sitemaps"]?.crawled || 0) || issueCount(/multiple sitemaps/i);
  const issueSegments = sitemapIssueRows
    .filter((row) => Number(row.crawled || row.count || 0) > 0)
    .map((row, index) => ({
      label: row.title,
      value: Number(row.crawled || row.count || 0),
      color: ["#c76c61", "#df3c27", "#ffc600", "#4197cb"][index % 4],
    }));

  return (
    <ReportShell title="Sitemaps">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pages in sitemap" value={inSitemap} accent="brand" />
        <StatCard label="Errors" value={sitemapErrorCount} accent="rose" />
        <StatCard label="Not in sitemap" value={notInSitemap} accent="amber" />
        <StatCard label="Multiple sitemaps" value={multipleSitemaps} accent="brand" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Sitemap coverage" hint>
          <DonutChart
            segments={[
              { label: "In sitemap", value: inSitemap, color: "#34d399" },
              { label: "Not in sitemap", value: notInSitemap, color: "#df3c27" },
            ]}
            size={170}
          />
        </ChartCard>
        <ChartCard title="Sitemap issues" hint>
          <DonutChart
            segments={safeSegments(issueSegments, "No sitemap issues")}
            size={170}
          />
        </ChartCard>
      </div>
    </ReportShell>
  );
}
