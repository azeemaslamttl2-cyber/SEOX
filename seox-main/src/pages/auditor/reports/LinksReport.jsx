import { useMemo } from "react";
import ReportShell, { ChartCard, DepthBars, HBars, StatCard } from "../../../components/auditor/ReportShell.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import {
  issueGroupsForCategory,
  issueRowsForGroups,
  LinksDofollowInsights,
  LinksTopIncomingInsights,
  TrackedIssuesPanel,
} from "../../../lib/auditor/reports/ReportInsights.jsx";
import { linkExplorerHref } from "../../../lib/auditor/reports/reportLinks.js";
import { linkStats } from "../../../lib/auditor/reports/liveReportData.js";

export default function LinksReport() {
  const { project, issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];

  const liveStats = useMemo(() => {
    return linkStats(latestUrls);
  }, [latestUrls]);

  const internal = liveStats.internal;
  const external = liveStats.external;
  const broken = liveStats.brokenInternal;
  const brokenExternal = liveStats.brokenExternal;
  const internalDofollow = liveStats.internalDofollow;
  const internalNofollow = liveStats.internalNofollow;
  const externalDofollow = liveStats.externalDofollow;
  const externalNofollow = liveStats.externalNofollow;
  const notCrawled = liveStats.notCrawled;
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "Links"));
  const issueRows = issueRowsForGroups(issueGroups);

  return (
    <ReportShell title="Links">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Internal" value={internal} accent="brand" to={linkExplorerHref("internal", "Internal links")} />
              <StatCard label="Broken internal" value={broken} sub={`${broken} broken pages`} accent="rose" to={linkExplorerHref("broken-internal", "Broken internal links")} />
              <StatCard label="External" value={external} accent="brand" to={linkExplorerHref("external", "External links")} />
              <StatCard label="Broken external" value={brokenExternal} sub={`${brokenExternal} broken pages`} accent="rose" to={linkExplorerHref("broken-external", "Broken external links")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Links by type" hint>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Internal</p>
                <HBars
                  rows={[
                    { label: "Dofollow", value: internalDofollow, color: "bg-gradient-to-r from-emerald-500 to-emerald-300" },
                    { label: "Nofollow", value: internalNofollow, color: "bg-gradient-to-r from-amber-500 to-amber-300" },
                  ]}
                />
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-white/50">External</p>
                <HBars
                  rows={[
                    { label: "Dofollow", value: externalDofollow, color: "bg-gradient-to-r from-emerald-500 to-emerald-300" },
                    { label: "Nofollow", value: externalNofollow, color: "bg-gradient-to-r from-amber-500 to-amber-300" },
                  ]}
                />
              </ChartCard>

              <ChartCard title="Links by destination status code" hint>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Internal</p>
                <HBars
                  rows={[
                    { label: "200", value: Math.max(0, internal - notCrawled), color: "bg-gradient-to-r from-emerald-500 to-emerald-300" },
                    { label: "Not crawled", value: notCrawled, color: "bg-gradient-to-r from-white/30 to-white/10" },
                  ]}
                />
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-white/50">External</p>
                <HBars
                  rows={[
                    { label: "Not crawled", value: external, color: "bg-gradient-to-r from-white/30 to-white/10" },
                  ]}
                />
              </ChartCard>
            </div>

            <DepthBars
              title="Internal pages by outgoing dofollow links"
              values={liveStats.outgoingBuckets.filter((item) => item.value > 0)}
            />

            <LinksDofollowInsights latestUrls={latestUrls} />
            <LinksTopIncomingInsights project={project} latestUrls={latestUrls} />
          </div>
        )
      }
    </ReportShell>
  );
}
