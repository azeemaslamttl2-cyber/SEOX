import { useState } from "react";
import {
  Quote,
  Search,
  Globe,
  Clock,
  MapPin,
  ExternalLink,
  Hash,
  Layers,
  Target,
  Award,
} from "lucide-react";

const mockCitation = {
  keyword: "learnwirepro.com",
  analyzedAt: "3/28/2026, 8:08 AM",
  country: "United States",
  metrics: [
    { label: "Overall Citations", value: "21", sub: "Total Results", icon: Hash, color: "from-rose-500 to-orange-500" },
    { label: "Domain Diversity", value: "6", sub: "Unique Domains", icon: Layers, color: "from-emerald-500 to-cyan-500" },
    { label: "Cross-Platform", value: "17%", sub: "Platform Overlap", icon: Target, color: "from-blue-500 to-indigo-500" },
    { label: "Citation Quality", value: "29%", sub: "Diversity Score", icon: Award, color: "from-violet-500 to-purple-500" },
  ],
  platforms: [
    {
      name: "OpenAI", color: "bg-emerald-500", count: 4,
      results: [
        { title: "Learn Wire Pro – Home", desc: "Official website of Learn Wire Pro, offering courses and...", url: "learnwirepro.com", rank: "#1" },
        { title: "Learn Wire Pro – Course Library", desc: "Browse comprehensive AI and tech learning modules...", url: "learnwirepro.com/courses", rank: "#2" },
      ],
    },
    {
      name: "Gemini", color: "bg-blue-500", count: 4,
      results: [
        { title: "LearnWire Pro – LearnWire", desc: "LearnWire Pro provides tutorials, tools and resources...", url: "learnwirepro.com", rank: "#1" },
        { title: "LearnWire Pro | Facebook", desc: "LearnWire Pro community page on Facebook with reviews...", url: "facebook.com/learnwirepro", rank: "#3" },
      ],
    },
    {
      name: "Claude", color: "bg-amber-500", count: 3,
      results: [
        { title: "LearnWirePro – Professional Wire...", desc: "Official website offering comprehensive online course...", url: "learnwirepro.com", rank: "#1" },
      ],
    },
    {
      name: "Perplexity", color: "bg-violet-500", count: 10,
      results: [
        { title: "Learnwire", desc: "Get in-depth software reviews of LearnWire to boost your SE...", url: "learnwirepro.com", rank: "#1" },
        { title: "Explore LearnWire's Software Reviews", desc: "Comprehensive reviews of AI-powered software...", url: "learnwirepro.com/reviews", rank: "#2" },
      ],
    },
    {
      name: "Grok", color: "bg-rose-500", count: 0,
      results: [],
    },
  ],
  searchHistory: [
    { url: "https://learnwirepro.com", date: "3/28/2026, 8:08 AM" },
  ],
};

export default function AiCitationFlow() {
  const [keyword, setKeyword] = useState(mockCitation.keyword);
  const [country, setCountry] = useState(mockCitation.country);
  const [hasResult, setHasResult] = useState(true);

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-blue-500/[0.05] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-500/30">
              <Quote className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-white">AI Citation Flow</h1>
              <p className="text-xs text-white/40">Track how your content ranks across multiple search perspectives</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Card + Search History Side */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white/90">Keyword Citation Analysis</h2>
            </div>
            {hasResult && <span className="text-[11px] text-white/25 flex items-center gap-1"><Clock className="h-3 w-3" /> Last analyzed: {mockCitation.analyzedAt}</span>}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
              <Globe className="h-4 w-4 text-violet-400/60" />
              <input
                value={keyword} onChange={(e) => setKeyword(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                placeholder="Enter keyword to analyze citation flow (e.g., artificial intelligence, machine learning)"
              />
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40">
              <Search className="h-4 w-4" /> Search Citation Flow
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-white/35">
              <MapPin className="h-3 w-3" /> Location for ChatGPT Results (Optional)
            </div>
            <select
              value={country} onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5 text-sm text-white/70 focus:outline-none appearance-none"
            >
              <option value="">Select a country (default: global results)</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
            </select>
            <p className="mt-1 text-[11px] text-white/25">Choose a specific country to get location-based ChatGPT search results</p>
          </div>
        </div>

        {/* Search History Sidebar */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-white/50 mb-3">
            <Clock className="h-3.5 w-3.5" /> Search history
          </div>
          {mockCitation.searchHistory.length > 0 ? (
            <div className="space-y-2">
              {mockCitation.searchHistory.map((h, i) => (
                <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
                  <div className="text-[12px] font-semibold text-violet-300 truncate">{h.url}</div>
                  <div className="text-[10px] text-white/30">{h.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-white/25">No search history yet. Run a search to see past runs here.</p>
          )}
        </div>
      </div>

      {hasResult && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {mockCitation.metrics.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                  <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10 blur-2xl" style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${m.color} shadow-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-white">{m.value}</div>
                      <div className="text-[10px] text-white/30">{m.sub}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-white/50">{m.label}</div>
                </div>
              );
            })}
          </div>

          {/* Search Results Comparison */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <h2 className="font-display text-lg font-bold text-white/90 mb-4">Search Results Comparison</h2>
            <div className="grid gap-4 lg:grid-cols-5">
              {mockCitation.platforms.map((plat, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-ink-900/40 overflow-hidden">
                  {/* Platform header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${plat.color}`} />
                      <span className="text-[12px] font-bold text-white/80">{plat.name}</span>
                    </div>
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-white/40">{plat.count} Results</span>
                  </div>
                  {/* Results */}
                  <div className="p-2 space-y-2">
                    {plat.results.length > 0 ? plat.results.map((r, ri) => (
                      <div key={ri} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
                        <div className="text-[11px] font-semibold text-white/75 line-clamp-2">{r.title}</div>
                        <p className="mt-0.5 text-[10px] text-white/35 line-clamp-2">{r.desc}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span className="truncate">{r.url}</span>
                          <span className="ml-auto text-white/25">{r.rank}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="py-4 text-center text-[11px] text-white/20">No results</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
