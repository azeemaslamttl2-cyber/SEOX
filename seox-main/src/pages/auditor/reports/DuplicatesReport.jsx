import { useMemo, useState } from "react";
import ReportShell, { ChartCard } from "../../../components/auditor/ReportShell.jsx";
import { Columns3 } from "lucide-react";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { issueGroupsForCategory, issueRowsForGroups, TrackedIssuesPanel } from "../../../lib/auditor/reports/ReportInsights.jsx";
import { duplicateClusters, duplicateSummary } from "../../../lib/auditor/reports/liveReportData.js";

export default function DuplicatesReport() {
  const [tab, setTab] = useState("near");
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "Duplicates"));
  const issueRows = issueRowsForGroups(issueGroups);
  const duplicateData = useMemo(() => {
    const summary = duplicateSummary(latestUrls);
    const nearClusters = ["title", "description", "h1"]
      .flatMap((field) => duplicateClusters(latestUrls, field))
      .slice(0, 20);
    const exactClusters = duplicateClusters(latestUrls, "content").slice(0, 20);
    return {
      distribution: summary
        .filter((item) => item.field !== "content")
        .map((item) => ({
          label: item.field === "description" ? "Description" : item.field === "h1" ? "H1 tag" : "Title tag",
          value: item.percent,
          count: item.duplicateUrls,
        })),
      nearClusters,
      exactClusters,
    };
  }, [latestUrls]);
  const visibleClusters = tab === "near" ? duplicateData.nearClusters : duplicateData.exactClusters;

  return (
    <ReportShell title="Duplicates">
      {(activeTab) =>
        activeTab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <ChartCard title="Duplicate content distribution" hint>
              <DistributionBars rows={duplicateData.distribution} />
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="text-white/65">URLs sharing the same captured field value</span>
              </div>
            </ChartCard>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">
                  Clusters of pages with {tab === "near" ? "near duplicate" : "exact duplicate"} content
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTab("near")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      tab === "near"
                        ? "bg-brand-500/20 text-brand-200 ring-1 ring-inset ring-brand-500/40"
                        : "text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    Near duplicates
                  </button>
                  <button
                    onClick={() => setTab("exact")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      tab === "exact"
                        ? "bg-brand-500/20 text-brand-200 ring-1 ring-inset ring-brand-500/40"
                        : "text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    Exact duplicates
                  </button>
                </div>
              </div>
              {visibleClusters.length ? (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-ink-900/95">
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/40">
                        <th className="px-4 py-2 font-medium">Element</th>
                        <th className="px-4 py-2 font-medium">Duplicate value</th>
                        <th className="px-4 py-2 text-right font-medium">URLs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleClusters.map((cluster) => (
                        <tr key={`${cluster.field}-${cluster.key}`} className="border-b border-white/[0.05] align-top">
                          <td className="px-4 py-3 text-xs font-semibold uppercase text-white/45">
                            {cluster.field === "description" ? "Meta description" : cluster.field === "h1" ? "H1" : cluster.field === "content" ? "Body copy" : "Title"}
                          </td>
                          <td className="px-4 py-3">
                            <p className="line-clamp-2 text-white/80">{cluster.value}</p>
                            <div className="mt-2 space-y-1">
                              {cluster.rows.slice(0, 5).map((row) => (
                                <a
                                  key={row.url}
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block break-all text-xs text-brand-300 hover:underline"
                                >
                                  {row.url}
                                </a>
                              ))}
                              {cluster.rows.length > 5 && (
                                <span className="text-xs text-white/40">
                                  +{cluster.rows.length - 5} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                            {cluster.rows.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center">
                  <span className="rounded-md bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
                    No duplicates in captured crawl data
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      }
    </ReportShell>
  );
}

function DistributionBars({ rows }) {
  const displayRows = rows.length
    ? rows
    : [
        { label: "Title tag", value: 0, count: 0 },
        { label: "Description", value: 0, count: 0 },
        { label: "H1 tag", value: 0, count: 0 },
      ];
  return (
    <div>
      {/* X-axis ticks */}
      <div className="mb-1 flex justify-between text-[10px] text-white/30">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
      <div className="space-y-3">
        {displayRows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-white/65">{r.label}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-300/80"
                style={{ width: `${r.value}%` }}
              />
            </div>
            <span className="w-16 text-right text-xs tabular-nums text-white/45">
              {r.count || 0}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end">
        <button className="rounded-md p-1 text-white/30 hover:bg-white/5 hover:text-white/60">
          <Columns3 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
