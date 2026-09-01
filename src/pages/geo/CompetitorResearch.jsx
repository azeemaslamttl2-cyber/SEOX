import { useState } from "react";
import {
  Swords,
  Globe,
  Search,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";

const platformColors = {
  OpenAI: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300", header: "bg-gradient-to-r from-emerald-500/20 to-emerald-500/5" },
  Gemini: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-300", header: "bg-gradient-to-r from-blue-500/20 to-blue-500/5" },
  Claude: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-300", header: "bg-gradient-to-r from-amber-500/20 to-amber-500/5" },
  Perplexity: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300", header: "bg-gradient-to-r from-violet-500/20 to-violet-500/5" },
  Grok: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-300", header: "bg-gradient-to-r from-rose-500/20 to-rose-500/5" },
};

const mockCompetitors = {
  project: "https://learnwirepro.com",
  competitors: [
    "https://daveswift.com/",
    "https://www.andrewmurrayhq.com/",
  ],
  results: [
    {
      domain: "learnwirepro.com",
      platforms: [
        { name: "OpenAI", keywords: 8, top10: 3, visibility: "12%", avgPos: 4.2 },
        { name: "Gemini", keywords: 5, top10: 2, visibility: "8%", avgPos: 5.1 },
        { name: "Claude", keywords: 3, top10: 1, visibility: "5%", avgPos: 6.3 },
        { name: "Perplexity", keywords: 12, top10: 5, visibility: "18%", avgPos: 3.8 },
        { name: "Grok", keywords: 2, top10: 0, visibility: "2%", avgPos: 8.5 },
      ],
    },
    {
      domain: "daveswift.com",
      platforms: [
        { name: "OpenAI", keywords: 6, top10: 2, visibility: "9%", avgPos: 5.0 },
        { name: "Gemini", keywords: 4, top10: 1, visibility: "6%", avgPos: 5.8 },
        { name: "Claude", keywords: 2, top10: 0, visibility: "3%", avgPos: 7.1 },
        { name: "Perplexity", keywords: 8, top10: 3, visibility: "12%", avgPos: 4.5 },
        { name: "Grok", keywords: 1, top10: 0, visibility: "1%", avgPos: 9.0 },
      ],
    },
    {
      domain: "andrewmurrayhq.com",
      platforms: [
        { name: "OpenAI", keywords: 4, top10: 1, visibility: "6%", avgPos: 6.2 },
        { name: "Gemini", keywords: 3, top10: 1, visibility: "5%", avgPos: 6.0 },
        { name: "Claude", keywords: 1, top10: 0, visibility: "2%", avgPos: 8.0 },
        { name: "Perplexity", keywords: 6, top10: 2, visibility: "9%", avgPos: 5.2 },
        { name: "Grok", keywords: 1, top10: 0, visibility: "1%", avgPos: 9.5 },
      ],
    },
  ],
};

export default function CompetitorResearch() {
  const [projectUrl, setProjectUrl] = useState(mockCompetitors.project);
  const [competitors, setCompetitors] = useState(mockCompetitors.competitors);
  const [hasResult, setHasResult] = useState(true);

  const addCompetitor = () => {
    if (competitors.length < 5) setCompetitors([...competitors, ""]);
  };
  const removeCompetitor = (idx) => {
    setCompetitors(competitors.filter((_, i) => i !== idx));
  };
  const updateCompetitor = (idx, val) => {
    const updated = [...competitors];
    updated[idx] = val;
    setCompetitors(updated);
  };

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-orange-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-amber-500/[0.05] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 ring-1 ring-orange-500/30">
              <Swords className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-white">Competitor Research</h1>
              <p className="text-xs text-white/40">Compare your project against competitors across AI platforms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project & Competitors Form */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-bold text-white/90">Project & Competitors</h2>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5 mb-4">
          <Globe className="h-4 w-4 text-orange-400/60" />
          <input
            value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
            placeholder="https://your-website.com"
          />
        </div>
        <p className="text-[11px] text-white/25 mb-4">No saved projects found. Enter your website URL manually to compare it against competitors.</p>

        <div className="mb-4">
          <h3 className="text-[12px] font-semibold text-white/60">Competitor URLs</h3>
          <p className="text-[11px] text-white/25">Add up to 5 competitor websites to compare against your project.</p>
        </div>

        <div className="space-y-2 mb-4">
          {competitors.map((comp, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
                <Globe className="h-4 w-4 text-white/20" />
                <input
                  value={comp} onChange={(e) => updateCompetitor(i, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                  placeholder="https://competitor.com"
                />
              </div>
              <button onClick={() => removeCompetitor(i)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addCompetitor} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400 hover:text-emerald-300">
            <Plus className="h-3.5 w-3.5" /> Add another competitor
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40">
            <Sparkles className="h-4 w-4" /> Analyze Competitors
          </button>
        </div>
      </div>

      {hasResult && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <h2 className="font-display text-lg font-bold text-white/90 mb-1">OpenAI vs Gemini vs Claude vs Perplexity vs Grok</h2>
          <p className="text-[12px] text-white/30 mb-5">Comparison of AI platform visibility for each domain</p>

          <div className="space-y-6">
            {mockCompetitors.results.map((result, ri) => (
              <div key={ri}>
                <h3 className="text-sm font-bold text-white/70 mb-3">{result.domain}</h3>
                <div className="grid grid-cols-5 gap-2">
                  {result.platforms.map((plat, pi) => {
                    const c = platformColors[plat.name];
                    return (
                      <div key={pi} className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
                        <div className={`text-[11px] font-bold ${c.text} mb-2`}>{plat.name}</div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-white/50">
                            <span>Keywords:</span><span className="font-semibold text-white/70">{plat.keywords}</span>
                          </div>
                          <div className="flex justify-between text-white/50">
                            <span>Top 10:</span><span className="font-semibold text-white/70">{plat.top10}</span>
                          </div>
                          <div className="flex justify-between text-white/50">
                            <span>Visibility:</span><span className="font-semibold text-white/70">{plat.visibility}</span>
                          </div>
                          <div className="flex justify-between text-white/50">
                            <span>Avg Pos:</span><span className="font-semibold text-white/70">{plat.avgPos}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
