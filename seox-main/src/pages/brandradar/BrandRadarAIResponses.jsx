import { ChevronDown, Search } from "lucide-react";
import BrandRadarDataForSeoStatus from "../../components/brandradar/BrandRadarDataForSeoStatus.jsx";
import {
  formatCompactNumber,
  useBrandRadarConfig,
  useBrandRadarSearchMentions,
} from "../../lib/brandRadarDataforseo.js";

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
      <Search className="mx-auto h-8 w-8 text-white/25" />
      <h3 className="mt-3 text-sm font-semibold text-white/70">No live AI responses returned</h3>
      <p className="mt-1 text-xs text-white/35">Try another brand, platform, location, or competitor set.</p>
    </div>
  );
}

export default function BrandRadarAIResponses() {
  const config = useBrandRadarConfig();
  const mentionsState = useBrandRadarSearchMentions(config, "google", 25);
  const responses = mentionsState.data?.results || [];

  return (
    <section className="space-y-5 pb-16">
      <BrandRadarDataForSeoStatus loading={mentionsState.loading} error={mentionsState.error} data={mentionsState.data} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">AI Responses: {config.brand}</h1>
          <p className="mt-0.5 text-xs text-white/40">
            Live DataForSEO LLM mentions search results from Google AI Overview.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/55">
          {formatCompactNumber(mentionsState.data?.total_count || responses.length)} results
          <ChevronDown className="h-3 w-3 text-white/35" />
        </div>
      </div>

      {!responses.length && !mentionsState.loading ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-semibold text-white/50">Prompt</th>
                <th className="px-3 py-3 font-semibold text-white/50">AI Volume</th>
                <th className="px-3 py-3 font-semibold text-white/50">Response</th>
                <th className="px-3 py-3 font-semibold text-white/50">Mentions</th>
                <th className="px-3 py-3 font-semibold text-white/50">Cited Domains</th>
                <th className="px-3 py-3 font-semibold text-white/50">Updated</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response, index) => {
                const domains = (response.sources || []).map((source) => source.domain).filter(Boolean);
                return (
                  <tr key={`${response.question}-${index}`} className="border-b border-white/[0.06] align-top hover:bg-white/[0.02]">
                    <td className="max-w-[260px] px-4 py-3">
                      <span className="text-brand-300">{response.question || config.brand}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-white/65">{formatCompactNumber(response.ai_search_volume)}</td>
                    <td className="max-w-[420px] px-3 py-3">
                      <p className="line-clamp-4 leading-relaxed text-white/60">{response.answer || "No answer text returned."}</p>
                    </td>
                    <td className="px-3 py-3">
                      {response.mentions?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {response.mentions.map((mention) => (
                            <span key={mention} className="rounded bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-200">
                              {mention}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-white/30">None detected</span>
                      )}
                    </td>
                    <td className="min-w-[160px] px-3 py-3">
                      {domains.length ? (
                        <div className="space-y-0.5">
                          {[...new Set(domains)].slice(0, 5).map((domain) => (
                            <div key={domain} className="truncate text-white/50">{domain}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-white/30">No citations</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-white/40">{response.updated || "Live"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
