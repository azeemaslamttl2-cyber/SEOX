import { useState } from "react";
import { BarChart3, ChevronDown, Globe, Radar, TrendingUp } from "lucide-react";
import BrandRadarDataForSeoStatus from "../../components/brandradar/BrandRadarDataForSeoStatus.jsx";
import {
  formatCompactNumber,
  formatPercent,
  useBrandRadarConfig,
  useBrandRadarKeywordVolume,
  useBrandRadarMetrics,
  useBrandRadarTopDomains,
  useBrandRadarTopPages,
} from "../../lib/brandRadarDataforseo.js";

const metricTabs = ["Mentions", "Citations", "Impressions", "AI Share of Voice"];

function EmptyState({ title = "No live DataForSEO data returned" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
      <Radar className="mx-auto h-8 w-8 text-white/25" />
      <h3 className="mt-3 text-sm font-semibold text-white/70">{title}</h3>
      <p className="mt-1 text-xs text-white/35">Try another brand, domain, competitor set, or location.</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
      <Icon className="h-4 w-4 text-brand-300" />
      <p className="mt-3 text-xs font-medium text-white/50">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-white/30">{hint}</p> : null}
    </div>
  );
}

function TabPills({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            active === tab ? "bg-brand-500/20 text-brand-200" : "text-white/50 hover:text-white/80"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function metricValue(brand, platformKey, metricTab) {
  const platform = platformKey === "all" ? brand : brand.platforms?.[platformKey] || {};
  if (metricTab === "AI Share of Voice") return platformKey === "all" ? formatPercent(brand.share_of_voice) : "-";
  if (metricTab === "Impressions") return formatCompactNumber(platform.impressions || platform.ai_search_volume || 0);
  if (metricTab === "Citations") {
    const platforms = platformKey === "all" ? Object.values(brand.platforms || {}) : [platform];
    const citations = platforms
      .flatMap((item) => item?.sources_domain || [])
      .reduce((sum, item) => sum + Number(item.mentions || 0), 0);
    return formatCompactNumber(citations);
  }
  return formatCompactNumber(platform.mentions || 0);
}

export default function BrandRadarOverview() {
  const [metricTab, setMetricTab] = useState("Mentions");
  const config = useBrandRadarConfig();
  const metricsState = useBrandRadarMetrics(config);
  const domainsState = useBrandRadarTopDomains(config);
  const pagesState = useBrandRadarTopPages(config);
  const volumeState = useBrandRadarKeywordVolume(config);

  const brands = metricsState.data?.brands || [];
  const platforms = ["all", ...(metricsState.data?.platforms || [])];
  const primaryBrand =
    brands.find((brand) => brand.name.toLowerCase() === config.brand.toLowerCase()) || brands[0];
  const primaryVolume =
    volumeState.data?.results?.find((item) => item.keyword?.toLowerCase() === config.brand.toLowerCase()) ||
    volumeState.data?.results?.[0];
  const topDomains = domainsState.data?.results?.length
    ? domainsState.data.results
    : metricsState.data?.top_source_domains || [];
  const topPages = pagesState.data?.results || [];

  return (
    <section className="space-y-5 pb-16">
      <BrandRadarDataForSeoStatus loading={metricsState.loading} error={metricsState.error} data={metricsState.data} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            Overview: <span className="gradient-text">{config.brand}</span>
          </h1>
          <p className="mt-0.5 text-xs text-white/40">
            {config.brand}{config.competitors.length ? ` vs. ${config.competitors.join(", ")}` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/55">
          DataForSEO live metrics
        </div>
      </div>

      {!brands.length && !metricsState.loading ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Radar}
              label="AI Share of Voice"
              value={primaryBrand ? formatPercent(primaryBrand.share_of_voice) : "-"}
              hint={primaryBrand?.name}
            />
            <StatCard
              icon={BarChart3}
              label="Mentions"
              value={formatCompactNumber(primaryBrand?.mentions || 0)}
              hint="Across returned platforms"
            />
            <StatCard
              icon={TrendingUp}
              label="AI Search Volume"
              value={formatCompactNumber(primaryVolume?.ai_search_volume || primaryBrand?.ai_search_volume || 0)}
              hint={primaryVolume?.keyword || config.brand}
            />
            <StatCard
              icon={Globe}
              label="Impressions"
              value={formatCompactNumber(primaryBrand?.impressions || 0)}
              hint="DataForSEO LLM mentions"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabPills tabs={metricTabs} active={metricTab} onChange={setMetricTab} />
            <span className="text-xs text-white/35">{formatCompactNumber(metricsState.data?.total_count || brands.length)} brand rows</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold text-white/50">Brand</th>
                  {platforms.map((platform) => (
                    <th key={platform} className="px-3 py-3 font-semibold text-white/50">
                      {platform === "all" ? "All platforms" : platform.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.name} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{brand.name}</td>
                    {platforms.map((platform) => (
                      <td key={platform} className="px-3 py-3">
                        <span className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-white/80">
                          {metricValue(brand, platform, metricTab)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <DataTable
          title="Top Cited Domains"
          empty="No cited domains returned."
          columns={["Domain", "Mentions", "AI Volume", "Impressions"]}
          rows={topDomains.map((domain) => [
            domain.domain,
            formatCompactNumber(domain.mentions),
            formatCompactNumber(domain.ai_search_volume),
            formatCompactNumber(domain.impressions),
          ])}
        />
        <DataTable
          title="Top Cited Pages"
          empty="No cited pages returned."
          columns={["Page", "Domain", "Mentions", "AI Volume"]}
          rows={topPages.map((page) => [
            page.title || page.url,
            page.domain,
            formatCompactNumber(page.mentions),
            formatCompactNumber(page.ai_search_volume),
          ])}
        />
      </div>
    </section>
  );
}

function DataTable({ title, columns, rows, empty }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <ChevronDown className="h-4 w-4 text-white/25" />
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10">
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold text-white/45">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, index) => (
                <tr key={index} className="border-b border-white/[0.06]">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="max-w-[260px] truncate px-4 py-3 text-white/70">
                      {cell || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-white/35">{empty}</p>
      )}
    </div>
  );
}
