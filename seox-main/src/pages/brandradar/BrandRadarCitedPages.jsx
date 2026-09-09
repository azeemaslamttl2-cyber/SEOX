import { ChevronDown, FileText, Search } from "lucide-react";
import BrandRadarDataForSeoStatus from "../../components/brandradar/BrandRadarDataForSeoStatus.jsx";
import {
  formatCompactNumber,
  useBrandRadarConfig,
  useBrandRadarTopPages,
} from "../../lib/brandRadarDataforseo.js";

export default function BrandRadarCitedPages() {
  const config = useBrandRadarConfig();
  const pagesState = useBrandRadarTopPages(config, "google", 50);
  const pages = pagesState.data?.results || [];

  return (
    <section className="space-y-5 pb-16">
      <BrandRadarDataForSeoStatus loading={pagesState.loading} error={pagesState.error} data={pagesState.data} />

      <div className="radar-page-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="radar-page-title flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <h1 className="font-display">Cited Pages: <span className="radar-brand">{config.brand}</span></h1>
              <p className="radar-page-description">Live DataForSEO LLM mentions top pages.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/55">
            {formatCompactNumber(pagesState.data?.total_count || pages.length)} results
            <ChevronDown className="h-3 w-3 text-white/35" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
        <Search className="h-3.5 w-3.5 text-white/30" />
        <input
          placeholder="Filter pages"
          className="w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>

      {!pages.length && !pagesState.loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-white/25" />
          <h3 className="mt-3 text-sm font-semibold text-white/70">No live cited pages returned</h3>
          <p className="mt-1 text-xs text-white/35">Try another brand, platform, or location.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-semibold text-white/50">Page</th>
                <th className="px-3 py-3 font-semibold text-white/50">Domain</th>
                <th className="px-3 py-3 text-right font-semibold text-white/50">Mentions</th>
                <th className="px-3 py-3 text-right font-semibold text-white/50">AI Volume</th>
                <th className="px-3 py-3 text-right font-semibold text-white/50">Impressions</th>
                <th className="px-3 py-3 font-semibold text-white/50">Platform</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page, index) => (
                <tr key={`${page.url}-${index}`} className="border-b border-white/[0.06] align-top hover:bg-white/[0.02]">
                  <td className="max-w-[360px] px-4 py-3">
                    <p className="truncate font-medium text-white">{page.title || page.url || page.domain}</p>
                    <p className="mt-1 truncate text-[10px] text-white/35">{page.url}</p>
                  </td>
                  <td className="px-3 py-3 text-brand-300">{page.domain || "-"}</td>
                  <td className="px-3 py-3 text-right font-mono text-white/70">{formatCompactNumber(page.mentions)}</td>
                  <td className="px-3 py-3 text-right font-mono text-white/60">{formatCompactNumber(page.ai_search_volume)}</td>
                  <td className="px-3 py-3 text-right font-mono text-white/60">{formatCompactNumber(page.impressions)}</td>
                  <td className="px-3 py-3 text-white/50">
                    {page.platform?.length ? page.platform.map((item) => item.key).join(", ") : pagesState.data?.platform || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
