import { ExternalLink, HelpCircle } from "lucide-react";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import IssueTable from "../../../components/auditor/IssueTable.jsx";
import { ChartCard } from "../../../components/auditor/ReportShell.jsx";
import {
  canonicalSegments,
  classifyContentType,
  htmlRows,
  linkStats,
  safeSegments,
} from "./liveReportData.js";

const brandBar = "bg-gradient-to-r from-brand-500/80 to-amber-400";
const emeraldBar = "bg-gradient-to-r from-emerald-500 to-emerald-300";

function hostFor(project) {
  try {
    return new URL(project.fullUrl || `https://${project.domain}`).hostname;
  } catch {
    return project.domain || "www.aismartseo.com";
  }
}

function originFor(project) {
  try {
    return new URL(project.fullUrl || `https://${project.domain}`).origin;
  } catch {
    return `https://${hostFor(project)}`;
  }
}

function InfoTitle({ children }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
      {children}
      <HelpCircle className="h-3.5 w-3.5 text-white/30" />
    </span>
  );
}

function SimpleHistogram({ title, buckets, max = Math.max(...buckets.map((item) => item.value), 1), color = brandBar }) {
  return (
    <ChartCard title={title} hint>
      <div className="relative h-56 border-b border-white/10">
        <div className="absolute inset-x-0 bottom-0 top-2 grid grid-rows-4">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-white/[0.06]" />
          ))}
        </div>
        <div className="relative flex h-full items-end gap-1 px-2 pb-5">
          {buckets.map((bucket) => (
            <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t-sm ${color}`}
                style={{ height: `${Math.max(8, (bucket.value / max) * 100)}%` }}
                title={`${bucket.label}: ${bucket.value}`}
              />
              <span className="absolute bottom-0 text-[10px] text-white/45">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

function RankedBars({ title, rows, project, external = false }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ChartCard title={title} hint>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_70px_minmax(160px,2fr)] items-center gap-3 text-sm">
              <a href={row.href || "#"} className="text-brand-300 hover:underline">
                <span className="break-all">{row.label}</span>
                {external && <ExternalLink className="ml-1 inline h-3 w-3" />}
              </a>
              <span className="text-right font-semibold tabular-nums text-white">{row.value.toLocaleString()}</span>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
                <div className={`h-full rounded-full ${brandBar}`} style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <NoData />
      )}
    </ChartCard>
  );
}

export function DiscoverySourceInsights({ project, totalInternal = 0, latestUrls = [] }) {
  const host = hostFor(project);
  const contentTypes = new Map();
  const subdomains = new Map();
  latestUrls.forEach((row) => {
    const type = row.contentType || classifyContentType(row.contentType, row.url);
    contentTypes.set(type, (contentTypes.get(type) || 0) + 1);
    try {
      const hostname = new URL(row.url).hostname;
      subdomains.set(hostname, (subdomains.get(hostname) || 0) + 1);
    } catch {
      // Ignore malformed URLs in summary widgets.
    }
  });
  const sitemapRows = latestUrls.filter((row) => /sitemap/i.test(row.url || "") || /xml/i.test(row.contentType || ""));
  return (
    <div className="space-y-4">
      <ChartCard title="Discoverable URLs by crawl source" hint>
        <div className="space-y-3">
          <MetricRow label="Discovered during crawl" value={latestUrls.length || totalInternal} />
          <MetricRow label="Sitemap/robots XML URLs crawled" value={sitemapRows.length} />
        </div>
      </ChartCard>

      <ChartCard title="Content types" hint>
        <div className="space-y-3">
          {Array.from(contentTypes.entries()).length ? (
            Array.from(contentTypes.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, value]) => <MetricRow key={label} label={label} value={value} />)
          ) : (
            <NoData />
          )}
        </div>
      </ChartCard>

      <ChartCard title="Top subdomains" hint>
        <div className="space-y-3">
          {Array.from(subdomains.entries()).length ? (
            Array.from(subdomains.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, value]) => <MetricRow key={label} label={label} value={value} href={`https://${label}`} />)
          ) : (
            <MetricRow label={host} value={totalInternal} href={`https://${host}`} />
          )}
        </div>
      </ChartCard>
    </div>
  );
}

export function IndexabilityDonutInsights({ indexable, nonIndexable, latestUrls = [] }) {
  const pages = htmlRows(latestUrls);
  const followIndex = pages.filter((row) => {
    const robots = `${row.robotsMeta || ""} ${row.audit?.robotsMeta || ""}`.toLowerCase();
    return !robots.includes("noindex") && !robots.includes("nofollow");
  }).length;
  const noindex = pages.filter((row) => `${row.robotsMeta || ""} ${row.audit?.robotsMeta || ""}`.toLowerCase().includes("noindex")).length;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Robots directives distribution" hint>
        <DonutChart
          segments={safeSegments([
            { label: "Follow, Index", value: latestUrls.length ? followIndex : indexable, color: "#34d399" },
            { label: "Follow, Noindex", value: latestUrls.length ? noindex : nonIndexable, color: "#fbbf24" },
          ].filter((item) => item.value > 0))}
          size={180}
        />
      </ChartCard>
      <ChartCard title="Canonical tag distribution" hint>
        <DonutChart
          segments={safeSegments(canonicalSegments(latestUrls))}
          size={180}
        />
      </ChartCard>
    </div>
  );
}

export function LinksDofollowInsights({ latestUrls = [] }) {
  const stats = linkStats(latestUrls);
  const incomingCounts = new Map();
  stats.rows.filter((row) => row.internal && !row.nofollow).forEach((row) => {
    incomingCounts.set(row.target, (incomingCounts.get(row.target) || 0) + 1);
  });
  const buckets = [
    { label: "0", value: htmlRows(latestUrls).filter((row) => !incomingCounts.get(row.url)).length },
    { label: "1-5", value: Array.from(incomingCounts.values()).filter((count) => count >= 1 && count <= 5).length },
    { label: "6-10", value: Array.from(incomingCounts.values()).filter((count) => count >= 6 && count <= 10).length },
    { label: "11-20", value: Array.from(incomingCounts.values()).filter((count) => count >= 11 && count <= 20).length },
    { label: "21-50", value: Array.from(incomingCounts.values()).filter((count) => count >= 21 && count <= 50).length },
    { label: "51+", value: Array.from(incomingCounts.values()).filter((count) => count >= 51).length },
  ];
  return (
    <div className="space-y-4">
      <SimpleHistogram title="Internal pages by incoming dofollow links" buckets={buckets} />
      <ChartCard title="Non-HTML URLs by incoming dofollow links" hint>
        <NoData />
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankedBars
          title="Top internal anchors"
          rows={stats.internalAnchorRows}
        />
        <RankedBars
          title="Top external anchors"
          rows={stats.externalAnchorRows}
        />
      </div>
    </div>
  );
}

export function LinksTopIncomingInsights({ project, latestUrls = [] }) {
  const stats = linkStats(latestUrls);
  return (
    <div className="space-y-4">
      <RankedBars title="Top pages by incoming links" rows={stats.pageRows} external />
      <RankedBars title="Top domains by incoming links" rows={stats.domainRows} external />
    </div>
  );
}

export function RedirectIncomingInsights({ project, latestUrls = [] }) {
  const redirects = (latestUrls || []).filter((row) => Number(row.status) >= 300 && Number(row.status) < 400);
  const incomingCounts = new Map();
  const rows = linkStats(latestUrls).rows;
  rows.forEach((row) => {
    if (Number(row.targetStatus) >= 300 && Number(row.targetStatus) < 400) {
      incomingCounts.set(row.target, (incomingCounts.get(row.target) || 0) + 1);
    }
  });
  const buckets = [
    { label: "0", value: redirects.filter((row) => !incomingCounts.get(row.url)).length },
    { label: "1-5", value: redirects.filter((row) => (incomingCounts.get(row.url) || 0) >= 1 && (incomingCounts.get(row.url) || 0) <= 5).length },
    { label: "6-10", value: redirects.filter((row) => (incomingCounts.get(row.url) || 0) >= 6 && (incomingCounts.get(row.url) || 0) <= 10).length },
    { label: "11+", value: redirects.filter((row) => (incomingCounts.get(row.url) || 0) >= 11).length },
  ];
  const redirectRows = redirects
    .map((row) => ({ label: row.url, href: row.url, value: incomingCounts.get(row.url) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  return (
    <div className="space-y-4">
      <SimpleHistogram
        title="Internal redirects by incoming links"
        buckets={buckets}
      />
      <SimpleHistogram
        title="Internal redirect chains by length"
        buckets={redirects.length ? [{ label: "1", value: redirects.length }] : []}
      />
      <RankedBars
        title="Top internal redirects by incoming links"
        rows={redirectRows}
        external
      />
    </div>
  );
}

export function TrackedIssuesPanel({ rows, groups }) {
  const actual = rows.filter((row) => (row.crawled || 0) > 0).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 text-xs">
        <FilterChip label="Actual" count={actual} />
        <FilterChip label="New" count={rows.filter((row) => row.isNew).length} />
        <FilterChip label="All tracked" count={rows.length} active />
        <FilterChip label="Turned off" count={0} />
        <button className="ml-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/70">Importance</button>
      </div>
      {groups?.some((group) => group.label) ? (
        groups.map((group) => (
          <div key={group.label}>
            <div className="border-b border-white/[0.06] bg-white/[0.025] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/45">
              {group.label}
            </div>
            <IssueTable rows={group.rows} sparkColor="#f97316" />
          </div>
        ))
      ) : (
        <IssueTable rows={rows} sparkColor="#f97316" />
      )}
    </div>
  );
}

export function issueGroupsForCategory(category) {
  if (!category) return [];
  if (category.subgroups) {
    return category.subgroups.map((group) => ({
      label: group.label,
      rows: group.items || [],
    }));
  }
  return [{ label: "", rows: category.items || [] }];
}

export function issueRowsForGroups(groups) {
  return groups.flatMap((group) => group.rows || []);
}

function FilterChip({ label, count, active = false }) {
  return (
    <span className={`rounded-md border px-2.5 py-1.5 font-semibold ${active ? "border-brand-500/40 bg-brand-500/20 text-brand-100" : "border-white/10 bg-white/[0.03] text-white/70"}`}>
      {label} <span className="text-white/45">{count}</span>
    </span>
  );
}

function MetricRow({ label, value, href }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_70px_minmax(120px,2fr)] items-center gap-4 text-sm">
      {href ? (
        <a href={href} className="text-brand-300 hover:underline"><span className="break-all">{label}</span><ExternalLink className="ml-1 inline h-3 w-3" /></a>
      ) : (
        <span className="break-all text-white/80">{label}</span>
      )}
      <span className="text-right font-semibold tabular-nums text-white">{value.toLocaleString()}</span>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
        <div className={`h-full rounded-full ${emeraldBar}`} style={{ width: "100%" }} />
      </div>
    </div>
  );
}

function NoData() {
  return (
    <div className="flex h-36 items-center justify-center">
      <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/60">NO DATA</span>
    </div>
  );
}
