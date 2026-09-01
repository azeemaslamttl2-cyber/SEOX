import { useState } from "react";
import {
  HeartPulse,
  Globe,
  Search,
  Clock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
} from "lucide-react";

const sentimentData = {
  url: "https://learnwirepro.com",
  brand: "learnwirepro",
  analyzedAt: "3/28/2026, 8:06:25 AM",
  platforms: [
    { name: "ChatGPT", visibility: "Medium", sentiment: "Neutral", trust: "Medium", authority: "Medium", recommendation: "Soft", visColor: "amber", sentColor: "slate", trustColor: "amber", authColor: "amber", recColor: "emerald" },
    { name: "Gemini", visibility: "Medium", sentiment: "Positive", trust: "Medium", authority: "Medium", recommendation: "Soft", visColor: "amber", sentColor: "emerald", trustColor: "amber", authColor: "amber", recColor: "emerald" },
    { name: "Claude", visibility: "Low", sentiment: "Neutral", trust: "Unknown", authority: "Unknown", recommendation: "None", visColor: "rose", sentColor: "slate", trustColor: "slate", authColor: "slate", recColor: "slate" },
    { name: "Perplexity", visibility: "Low", sentiment: "Neutral", trust: "Unknown", authority: "Weak", recommendation: "None", visColor: "rose", sentColor: "slate", trustColor: "slate", authColor: "amber", recColor: "slate" },
    { name: "Grok", visibility: "Low", sentiment: "Neutral", trust: "Unknown", authority: "Weak", recommendation: "None", visColor: "rose", sentColor: "slate", trustColor: "slate", authColor: "amber", recColor: "slate" },
  ],
  recommendations: [
    "Prioritize Gathering Customer Reviews: Actively solicit reviews from users who have engaged with LearnWirePro's content or services. Focus on platforms like Trustpilot, Google Reviews, and industry-specific review sites to build trust and provide social proof.",
    "Create In-Depth Case Studies: Develop detailed case studies showcasing how specific AI tools reviewed on your site have helped users. This demonstrates expertise and builds authority.",
    "Increase Cross-Platform Presence: Actively engage on platforms where AI models source information — publish consistent content across Medium, LinkedIn, and Reddit.",
    "Build Authoritative Backlinks: Focus on earning backlinks from established tech review sites, AI research blogs, and industry publications to improve domain authority.",
    "Optimize for AI Model Citation: Structure your content with clear headings, FAQs, and schema markup so AI models can easily extract and cite your reviews.",
  ],
};

const colorMap = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20",
  amber: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20",
  rose: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20",
  slate: "bg-white/[0.06] text-white/40 ring-1 ring-white/10",
};

function Badge({ label, color }) {
  return <span className={`inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-bold ${colorMap[color]}`}>{label}</span>;
}

export default function BrandSentiment() {
  const [url, setUrl] = useState(sentimentData.url);
  const [hasResult, setHasResult] = useState(true);

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-pink-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-violet-500/[0.05] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 ring-1 ring-pink-500/30">
              <HeartPulse className="h-5 w-5 text-pink-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-white">Brand Sentiment Analysis</h1>
              <p className="text-xs text-white/40">Analyze your brand's sentiment across all major AI platforms (ChatGPT, Gemini, Claude, Perplexity, Grok)</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-ink-900/60 p-5">
            <p className="text-[11px] text-white/35">Project or Website URL</p>
            {hasResult && <p className="text-[11px] text-white/25 mt-0.5">Last analyzed: {sentimentData.analyzedAt}</p>}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
                <Globe className="h-4 w-4 text-pink-400/60" />
                <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                  placeholder="https://example.com"
                />
              </div>
              <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition hover:shadow-pink-500/40">
                <Search className="h-4 w-4" /> Analyze Brand Sentiment
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/25">No saved projects found. Enter a website URL to analyze brand sentiment directly.</p>
          </div>
        </div>
      </div>

      {hasResult && (
        <>
          {/* Results Table */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <div className="mb-1">
              <h2 className="font-display text-lg font-bold text-white/90">
                Sentiment Analysis Results for <span className="text-pink-300">{sentimentData.brand}</span>
              </h2>
              <p className="text-[11px] text-white/30 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Analyzed on {sentimentData.analyzedAt}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Platform</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Visibility</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Sentiment</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Trust</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Authority</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Recommendation</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sentimentData.platforms.map((p, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-3 text-[13px] font-semibold text-white/80">{p.name}</td>
                      <td className="py-3 text-center"><Badge label={p.visibility} color={p.visColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.sentiment} color={p.sentColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.trust} color={p.trustColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.authority} color={p.authColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.recommendation} color={p.recColor} /></td>
                      <td className="py-3 text-center">
                        <button className="text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
                          View Details <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-lg font-bold text-white/90">Step-by-Step Improvement Recommendations</h2>
            </div>
            <p className="text-[12px] text-white/35 mb-4">Actionable steps to improve your brand's sentiment, visibility, trust, and authority.</p>

            <div className="space-y-3">
              {sentimentData.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-4 transition hover:bg-white/[0.02]">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[12px] font-bold text-emerald-300">
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed text-white/65">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
