import { Info, Settings2 } from "lucide-react";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import ReportShell, { ChartCard } from "../../../components/auditor/ReportShell.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { issueGroupsForCategory, issueRowsForGroups, TrackedIssuesPanel } from "./ReportInsights.jsx";
import { fileSizeSegments, loadTimeSegments, safeSegments } from "./liveReportData.js";

export default function PerformanceReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const encodingCounts = latestUrls.reduce((acc, row) => {
    const encoding = row.contentEncoding || row.audit?.contentEncoding || "Unknown";
    acc[encoding] = (acc[encoding] || 0) + 1;
    return acc;
  }, {});
  const encodingSegments = Object.entries(encodingCounts).map(([label, value], index) => ({
    label,
    value,
    color: ["#34d399", "#f97316", "#fbbf24", "#60a5fa"][index % 4],
  }));
  const issueGroups = issueGroupsForCategory(
    issueCategories.find((category) => category.title === "Usability and performance")
  );
  const issueRows = issueRowsForGroups(issueGroups);

  return (
    <ReportShell title="Performance">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
                Core Web Vitals
              </p>
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                <p className="text-sm text-white/75">
                  To get page speed data from Google PageSpeed Insights, enable Core Web Vitals in{" "}
                  <a className="inline-flex items-center gap-1 text-brand-300 hover:underline">
                    <Settings2 className="h-3.5 w-3.5" /> Crawl settings
                  </a>
                  .
                </p>
              </div>
            </div>

            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
                AI Smart Seo metrics
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Time to first byte distribution" hint>
                  <DonutChart
                    segments={safeSegments(loadTimeSegments(latestUrls), "No timing data")}
                    size={170}
                  />
                </ChartCard>
                <ChartCard title="Load time distribution" hint>
                  <DonutChart
                    segments={safeSegments(loadTimeSegments(latestUrls), "No timing data")}
                    size={170}
                  />
                </ChartCard>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ChartCard title="File size distribution" hint>
                  <DonutChart
                    segments={safeSegments(fileSizeSegments(latestUrls), "No size data")}
                    size={170}
                  />
                </ChartCard>
                <ChartCard title="Content encoding distribution" hint>
                  <DonutChart segments={safeSegments(encodingSegments)} size={170} />
                </ChartCard>
              </div>
            </div>
          </div>
        )
      }
    </ReportShell>
  );
}
