import { useMemo } from "react";
import { ChevronDown, Tags } from "lucide-react";
import BrandRadarDataForSeoStatus from "../../components/brandradar/BrandRadarDataForSeoStatus.jsx";
import {
  formatCompactNumber,
  useBrandRadarConfig,
  useBrandRadarSearchMentions,
} from "../../lib/brandRadarDataforseo.js";

const stopWords = new Set([
  "about",
  "after",
  "are",
  "best",
  "can",
  "does",
  "for",
  "from",
  "how",
  "is",
  "near",
  "of",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

function topicFromText(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word))
    .slice(0, 4);
  return words.join(" ") || "No topic";
}

function buildTopics(items, brandColumns) {
  const grouped = new Map();
  items.forEach((item) => {
    const topic = topicFromText(item.question || item.answer);
    const row = grouped.get(topic) || {
      topic,
      responses: 0,
      volume: 0,
      brands: Object.fromEntries(brandColumns.map((brand) => [brand, 0])),
      prompts: [],
    };
    row.responses += 1;
    row.volume += Number(item.ai_search_volume || 0);
    row.prompts.push(item);
    brandColumns.forEach((brand) => {
      if ((item.mentions || []).some((mention) => mention.toLowerCase() === brand.toLowerCase())) {
        row.brands[brand] += 1;
      }
    });
    grouped.set(topic, row);
  });

  return Array.from(grouped.values()).sort((a, b) => b.volume - a.volume || b.responses - a.responses);
}

export default function BrandRadarTopics() {
  const config = useBrandRadarConfig();
  const mentionsState = useBrandRadarSearchMentions(config, "google", 50);
  const brandColumns = [config.brand, ...config.competitors].filter(Boolean).slice(0, 4);
  const topics = useMemo(
    () => buildTopics(mentionsState.data?.results || [], brandColumns),
    [mentionsState.data?.results, brandColumns.join("|")]
  );

  return (
    <section className="space-y-5 pb-16">
      <BrandRadarDataForSeoStatus loading={mentionsState.loading} error={mentionsState.error} data={mentionsState.data} />

      <div className="radar-page-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="radar-page-title flex items-center gap-3">
            <Tags className="h-5 w-5" />
            <div>
              <h1 className="font-display">Topics: <span className="radar-brand">{config.brand}</span></h1>
              <p className="radar-page-description">Live topic groups derived from DataForSEO AI responses.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/55">
            {formatCompactNumber(mentionsState.data?.total_count || topics.length)} results
            <ChevronDown className="h-3 w-3 text-white/35" />
          </div>
        </div>
      </div>

      {!topics.length && !mentionsState.loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <Tags className="mx-auto h-8 w-8 text-white/25" />
          <h3 className="mt-3 text-sm font-semibold text-white/70">No live topics returned</h3>
          <p className="mt-1 text-xs text-white/35">Try another brand or broaden the DataForSEO query.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 font-semibold text-white/50">Topic</th>
                <th className="px-3 py-3 text-right font-semibold text-white/50">AI Responses</th>
                <th className="px-3 py-3 text-right font-semibold text-white/50">AI Volume</th>
                {brandColumns.map((brand) => (
                  <th key={brand} className="px-3 py-3 text-right font-semibold text-white/50">{brand}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.topic} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <p className="font-medium text-brand-300">{topic.topic}</p>
                    <p className="mt-1 max-w-xl truncate text-[10px] text-white/35">
                      {topic.prompts[0]?.question || topic.prompts[0]?.answer || ""}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-white/70">{formatCompactNumber(topic.responses)}</td>
                  <td className="px-3 py-3 text-right font-mono text-white/60">{formatCompactNumber(topic.volume)}</td>
                  {brandColumns.map((brand) => (
                    <td key={brand} className="px-3 py-3 text-right font-mono text-white/60">
                      {topic.brands[brand] ? formatCompactNumber(topic.brands[brand]) : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
