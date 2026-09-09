import ReportShell, { StatCard, ChartCard } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { externalLinkStats, safeSegments } from "../../../lib/auditor/reports/liveReportData.js";

export default function ExternalPagesReport() {
  const { stats } = useCrawl();
  const report = externalLinkStats(stats?.latestUrls || []);
  const maxDomainLinks = Math.max(...report.domains.map((item) => item.links), 1);

  return (
    <ReportShell title="External pages">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total external" value={report.total} accent="brand" />
        <StatCard label="Linked from internal" value={report.total} accent="brand" />
        <StatCard label="Broken external" value={report.broken} sub={`${report.broken} broken pages`} accent="rose" />
        <StatCard label="Redirects" value={report.redirects} accent="brand" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="HTTP status codes distribution" hint>
          <DonutChart
            segments={safeSegments(report.statusSegments)}
            size={170}
          />
        </ChartCard>
        <ChartCard title="Protocols distribution" hint>
          <DonutChart
            segments={safeSegments(report.protocolSegments)}
            size={170}
          />
        </ChartCard>
      </div>

      <ChartCard title="Top linked external domains" hint>
        <ul className="space-y-2.5 text-sm">
          {report.domains.length ? report.domains.map((d) => (
            <li key={d.domain} className="flex items-center gap-3">
              <span className="w-44 truncate text-white/80">{d.domain}</span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-400"
                  style={{ width: `${(d.links / maxDomainLinks) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right tabular-nums text-white/80">
                {d.links}
              </span>
            </li>
          )) : (
            <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-sm text-white/40">
              No external links found in the current crawl.
            </li>
          )}
        </ul>
      </ChartCard>
    </ReportShell>
  );
}
