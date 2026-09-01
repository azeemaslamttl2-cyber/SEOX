import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radar,
  Search,
  Globe,
  TrendingUp,
  Users,
  Plus,
  FileText,
  FolderOpen,
} from "lucide-react";
import {
  buildBrandRadarSearch,
  normalizeBrandInput,
  readStoredBrandRadarConfig,
  saveBrandRadarConfig,
} from "../../lib/brandRadarDataforseo.js";

const features = [
  {
    icon: Radar,
    title: "AI Share of Voice",
    desc: "Measure how often AI mentions your brand compared to competitors across ChatGPT, Gemini, Perplexity, Copilot & Grok.",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.12)",
  },
  {
    icon: TrendingUp,
    title: "Mentions & Citations",
    desc: "Track every brand mention and citation across AI platforms with real-time trend analysis.",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
  },
  {
    icon: Users,
    title: "Competitor Benchmarking",
    desc: "Compare your brand visibility against up to 5 competitors across all major AI engines.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
  },
  {
    icon: Globe,
    title: "Web & Video Visibility",
    desc: "Monitor your brand's presence across web search, YouTube, TikTok, and Reddit.",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.12)",
  },
];

export default function BrandRadar() {
  const [url, setUrl] = useState(() => {
    const stored = readStoredBrandRadarConfig();
    return stored.domain || stored.brand || "";
  });
  const [competitors, setCompetitors] = useState(() => readStoredBrandRadarConfig().competitors.join(", "));
  const navigate = useNavigate();

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (url.trim()) {
      const parsed = normalizeBrandInput(url);
      const config = {
        brand: parsed.name || url.trim(),
        domain: parsed.domain,
        competitors: competitors.split(",").map((item) => item.trim()).filter(Boolean),
      };
      saveBrandRadarConfig(config);
      navigate(`/brand-radar/overview?${buildBrandRadarSearch(config)}`);
    }
  };

  return (
    <section className="pb-16">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/[0.08] via-ink-800 to-ink-900 p-8 sm:p-12 text-center">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 animate-float-slow rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 animate-float rounded-full bg-amber-400/15 blur-3xl" />

        <div className="relative">
          {/* Badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
            <Radar className="h-3.5 w-3.5" />
            Brand Intelligence Platform
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Brand Radar <span className="gradient-text">2.0</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/55 sm:text-base">
            Explore what people and AI say about any brand, topic or niche.
            Track your visibility across every AI platform in real time.
          </p>

          {/* Input bar */}
          <form onSubmit={handleAnalyze} className="mx-auto mt-8 max-w-2xl">
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. nike.com"
                className="h-14 w-full rounded-xl border border-white/15 bg-ink-800/80 pl-12 pr-36 text-sm text-white placeholder:text-white/30 backdrop-blur-md transition focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-brand-glow transition-all hover:scale-[1.02] hover:shadow-[0_12px_36px_-8px_rgba(249,115,22,0.6)]"
              >
                <Search className="h-4 w-4" />
                Analyze
              </button>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800/70 px-4 py-3">
                <Users className="h-4 w-4 text-white/30" />
                <input
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none"
                  placeholder="Competitors, comma separated"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-white/40">
              or{" "}
              <button
                type="button"
                className="text-brand-300 hover:underline"
                onClick={() => navigate(`/brand-radar/overview?${buildBrandRadarSearch(readStoredBrandRadarConfig())}`)}
              >
                add your brand and competitors manually
              </button>
            </p>
          </form>

        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-all duration-300 hover:border-brand-500/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(249,115,22,0.15)]"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: f.bg }}
            >
              <f.icon className="h-5 w-5" style={{ color: f.color }} />
            </span>
            <h3 className="mt-4 font-display text-sm font-bold text-white">{f.title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* My Reports section */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <FileText className="h-5 w-5 text-brand-400" />
          <h3 className="font-display text-sm font-bold">My Reports</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <FolderOpen className="h-7 w-7 text-white/20" />
          </div>
          <p className="mt-4 text-sm font-medium text-white/50">Add your first report</p>
          <p className="mt-1 text-xs text-white/35">
            Save your setup and revisit whenever you need latest results.
          </p>
          <button
            onClick={() => navigate(`/brand-radar/overview?${buildBrandRadarSearch(readStoredBrandRadarConfig())}`)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-xs font-semibold text-brand-300 transition-all hover:bg-brand-500/20 hover:scale-[1.02]"
          >
            <Plus className="h-3.5 w-3.5" />
            Report
          </button>
        </div>
      </div>
    </section>
  );
}
