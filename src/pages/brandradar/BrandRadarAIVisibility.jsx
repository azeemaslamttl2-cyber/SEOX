import { useState } from "react";
import { BarChart3, Info, Radar } from "lucide-react";
import BrandRadarDataForSeoStatus from "../../components/brandradar/BrandRadarDataForSeoStatus.jsx";
import {
  formatCompactNumber,
  formatPercent,
  useBrandRadarConfig,
  useBrandRadarMetrics,
} from "../../lib/brandRadarDataforseo.js";

const metricTabs = ["Mentions", "Citations", "Impressions", "AI Share of Voice"];

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

function citationsFor(platformMetrics) {
  return (platformMetrics?.sources_domain || []).reduce((sum, item) => sum + Number(item.mentions || 0), 0);
}

function rawMetric(brand, platformKey, metricTab) {
  const platform = platformKey === "all" ? brand : brand.platforms?.[platformKey] || {};
  if (metricTab === "AI Share of Voice") return platformKey === "all" ? Number(brand.share_of_voice || 0) : 0;
  if (metricTab === "Impressions") return Number(platform.impressions || platform.ai_search_volume || 0);
  if (metricTab === "Citations") {
    const platforms = platformKey === "all" ? Object.values(brand.platforms || {}) : [platform];
    return platforms.reduce((sum, item) => sum + citationsFor(item), 0);
  }
  return Number(platform.mentions || 0);
}

function displayMetric(value, metricTab) {
  if (metricTab === "AI Share of Voice") return value ? formatPercent(value) : "-";
  return formatCompactNumber(value);
}

export default function BrandRadarAIVisibility() {
  const [metricTab, setMetricTab] = useState("Mentions");
  const config = useBrandRadarConfig();
  const metricsState = useBrandRadarMetrics(config);
  const brands = metricsState.data?.brands || [];
  const platforms = ["all", ...(metricsState.data?.platforms || [])];
  const maxValue = Math.max(
    1,
    ...brands.flatMap((brand) => platforms.map((platform) => rawMetric(brand, platform, metricTab)))
  );

  return (
    <section className="space-y-5 pb-16">
      <BrandRadarDataForSeoStatus loading={metricsState.loading} error={metricsState.error} data={metricsState.data} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            AI Visibility: <span className="gradient-text">{config.brand}</span>
          </h1>
          <p className="mt-0.5 text-xs text-white/40">
            DataForSEO LLM Mentions comparison{config.competitors.length ? ` for ${config.brand} vs. ${config.competitors.join(", ")}` : ""}
          </p>
        </div>
        <TabPills tabs={metricTabs} active={metricTab} onChange={setMetricTab} />
      </div>

      {!brands.length && !metricsState.loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <Radar className="mx-auto h-8 w-8 text-white/25" />
          <h3 className="mt-3 text-sm font-semibold text-white/70">No live visibility data returned</h3>
          <p className="mt-1 text-xs text-white/35">Adjust the Brand Radar setup and run the report again.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {brands.map((brand) => (
              <div key={brand.name} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
                <BarChart3 className="h-4 w-4 text-brand-300" />
                <p className="mt-3 text-sm font-semibold text-white">{brand.name}</p>
                <p className="mt-2 font-display text-3xl font-bold text-white">
                  {displayMetric(rawMetric(brand, "all", metricTab), metricTab)}
                </p>
                <p className="mt-1 text-[11px] text-white/35">{metricTab} across returned platforms</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold text-white/50">Brand</th>
                  {platforms.map((platform) => (
                    <th key={platform} className="px-4 py-3 text-center font-semibold text-white/50">
                      {platform === "all" ? "All platforms" : platform.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brands.map((brand, index) => {
                  const color = ["#df3c27", "#4197cb", "#6abf4b", "#2d2b6f", "#c76c61"][index % 5];
                  return (
                    <tr key={brand.name} className="border-b border-white/[0.06]">
                      <td className="px-4 py-3 font-medium text-white">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        {brand.name}
                      </td>
                      {platforms.map((platform) => {
                        const value = rawMetric(brand, platform, metricTab);
                        const intensity = metricTab === "AI Share of Voice" ? Math.min(1, value / 100) : Math.min(1, value / maxValue);
                        return (
                          <td key={platform} className="px-4 py-3 text-center">
                            <span
                              className="inline-flex min-w-20 justify-center rounded-md px-2 py-1 font-mono text-white"
                              style={{ background: `${color}${Math.round(Math.max(0.12, intensity) * 180).toString(16).padStart(2, "0")}` }}
                            >
                              {displayMetric(value, metricTab)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30" />
            <span>Heat intensity is computed from live DataForSEO values returned for this report.</span>
          </div>
        </>
      )}
    </section>
  );
}
