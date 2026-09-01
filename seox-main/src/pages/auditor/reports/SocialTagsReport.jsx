import { useMemo } from "react";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import ReportShell, { ChartCard, StatCard } from "../../../components/auditor/ReportShell.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { issueGroupsForCategory, issueRowsForGroups, TrackedIssuesPanel } from "./ReportInsights.jsx";
import { htmlRows } from "./liveReportData.js";

const OG_TAGS = ["og:title", "og:type", "og:image", "og:url", "og:description", "og:site_name", "og:locale", "og:updated_time"];
const OG_REQUIRED = new Set(["og:title", "og:type", "og:image", "og:url"]);
const TWITTER_TAGS = ["twitter:card", "twitter:site", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"];
const TWITTER_REQUIRED = new Set(["twitter:card", "twitter:title", "twitter:description", "twitter:image"]);

function hasTag(tags, key) {
  return Boolean(String(tags?.[key] || "").trim());
}

function tagRows(pages, keys, requiredKeys, sourceKey) {
  return keys.map((key) => {
    const set = pages.filter((row) => hasTag(row.audit?.[sourceKey] || {}, key)).length;
    const missing = Math.max(0, pages.length - set);
    return {
      label: key,
      set,
      missingOptional: requiredKeys.has(key) ? 0 : missing,
      missingRequired: requiredKeys.has(key) ? missing : 0,
    };
  });
}

export default function SocialTagsReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const socialStats = useMemo(() => {
    const pages = htmlRows(latestUrls).filter((row) => row.status >= 200 && row.status < 300 && !/\bnoindex\b/i.test(`${row.robotsMeta || ""} ${row.audit?.robotsMeta || ""}`));
    const ogRows = tagRows(pages, OG_TAGS, OG_REQUIRED, "ogTags");
    const twitterRows = tagRows(pages, TWITTER_TAGS, TWITTER_REQUIRED, "twitterTags");
    const ogComplete = pages.filter((row) => [...OG_REQUIRED].every((tag) => hasTag(row.audit?.ogTags || {}, tag))).length;
    const twitterComplete = pages.filter((row) => [...TWITTER_REQUIRED].every((tag) => hasTag(row.audit?.twitterTags || {}, tag))).length;
    const missingAll = pages.filter((row) => !Object.keys(row.audit?.ogTags || {}).length && !Object.keys(row.audit?.twitterTags || {}).length).length;
    const ogTypeCounts = pages.reduce((acc, row) => {
      const type = row.audit?.ogTags?.["og:type"] || "not set";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const twitterCardCounts = pages.reduce((acc, row) => {
      const type = row.audit?.twitterTags?.["twitter:card"] || "not set";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    return {
      pages,
      ogRows,
      twitterRows,
      ogComplete,
      twitterComplete,
      missingAll,
      ogTypeSegments: Object.entries(ogTypeCounts).map(([label, value], index) => ({
        label,
        value,
        color: ["#f97316", "#fbbf24", "#34d399", "#60a5fa"][index % 4],
      })),
      twitterCardSegments: Object.entries(twitterCardCounts).map(([label, value], index) => ({
        label,
        value,
        color: ["#f97316", "#fbbf24", "#34d399", "#60a5fa"][index % 4],
      })),
    };
  }, [latestUrls]);
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "Social tags"));
  const issueRows = issueRowsForGroups(issueGroups);

  return (
    <ReportShell title="Social tags of indexable pages">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Indexable pages" value={socialStats.pages.length} accent="brand" />
              <StatCard label="Incomplete Open Graph tags" value={Math.max(0, socialStats.pages.length - socialStats.ogComplete)} accent="amber" />
              <StatCard label="Incomplete X (Twitter) card" value={Math.max(0, socialStats.pages.length - socialStats.twitterComplete)} accent="amber" />
              <StatCard label="Pages missing all social tags" value={socialStats.missingAll} accent="rose" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Basic Open Graph tags implementation status" hint>
                <DonutChart
                  segments={[
                    { label: "Complete", value: socialStats.ogComplete, color: "#34d399" },
                    { label: "Incomplete", value: Math.max(0, socialStats.pages.length - socialStats.ogComplete), color: "#fbbf24" },
                  ]}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="og:type distribution" hint>
                <DonutChart
                  segments={socialStats.ogTypeSegments}
                  size={170}
                />
              </ChartCard>
            </div>

            <ChartCard title="Open Graph tags distribution" hint>
              <TagDistribution rows={socialStats.ogRows} />
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Basic X (Twitter) Card tags implementation status" hint>
                <DonutChart
                  segments={[
                    { label: "Complete", value: socialStats.twitterComplete, color: "#34d399" },
                    { label: "Incomplete", value: Math.max(0, socialStats.pages.length - socialStats.twitterComplete), color: "#fbbf24" },
                  ]}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="X (Twitter) card types distribution" hint>
                <DonutChart
                  segments={socialStats.twitterCardSegments}
                  size={170}
                />
              </ChartCard>
            </div>

            <ChartCard title='Pages with "summary with large image" X (Twitter) card' hint>
              <TagDistribution rows={socialStats.twitterRows} />
            </ChartCard>
          </div>
        )
      }
    </ReportShell>
  );
}

function TagDistribution({ rows }) {
  return (
    <div>
      <div className="space-y-2">
        {rows.map((row) => {
          const total = row.set + row.missingOptional + row.missingRequired || 1;
          const setPct = (row.set / total) * 100;
          const optPct = (row.missingOptional / total) * 100;
          const reqPct = (row.missingRequired / total) * 100;
          return (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-32 truncate text-xs text-white/65">{row.label}</span>
              <div className="relative flex h-6 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
                {setPct > 0 && <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${setPct}%` }} />}
                {optPct > 0 && <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${optPct}%` }} />}
                {reqPct > 0 && <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${reqPct}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ml-[140px] mt-2 flex justify-between text-[10px] text-white/30">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-white/65"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Set</span>
        <span className="flex items-center gap-1.5 text-white/65"><span className="h-2 w-2 rounded-full bg-amber-400" /> Missing optional</span>
        <span className="flex items-center gap-1.5 text-white/65"><span className="h-2 w-2 rounded-full bg-rose-400" /> Missing required</span>
      </div>
    </div>
  );
}
