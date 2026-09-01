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
    color: "#df3c27",
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
      {/* ─── Page header ─── */}
      <div className="radar-hero">
        <div className="radar-title flex items-center gap-3">
          <Radar className="h-5 w-5" />
          <div>
            <h1 className="font-display">
              Brand Radar <span className="radar-version">2.0</span>
            </h1>
            <p className="radar-description">
              Explore what people and AI say about any brand, topic or niche. Track your visibility across every AI platform in real time.
            </p>
          </div>
        </div>

        {/* Analyse form */}
        <form onSubmit={handleAnalyze} className="radar-form">
          <div className="radar-field">
            <Globe className="h-4 w-4" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. nike.com"
            />
          </div>
          <div className="radar-field">
            <Users className="h-4 w-4" />
            <input
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="Competitors, comma separated"
            />
          </div>
          <button type="submit" className="ui-button ui-button-primary radar-analyze-button">
            <Search className="h-4 w-4" />
            Analyze
          </button>
        </form>

        <p className="radar-manual">
          or{" "}
          <button
            type="button"
            onClick={() => navigate(`/brand-radar/overview?${buildBrandRadarSearch(readStoredBrandRadarConfig())}`)}
          >
            add your brand and competitors manually
          </button>
        </p>
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
