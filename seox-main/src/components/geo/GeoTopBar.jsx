import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import NotificationButton from "../NotificationButton.jsx";
import ProjectSelector from "../ProjectSelector.jsx";

const titles = {
  "/geo/prompt-tracking": "Prompt Tracking",
  "/geo/brand-sentiment": "Brand Sentiment Analysis",
  "/geo/citation-flow": "AI Citation Flow",
  "/geo/competitor-research": "Competitor Research",
  "/geo/internal-links": "Internal Links Crawl",
  "/geo/ai-chat": "AI Chat Console",
  "/geo/llms-generator": "LLMs.txt Generator",
  "/geo/ai-model-checker": "AI Model Index Checker",
  "/geo/ai-compatibility": "AI Model Compatibility",
};

export default function GeoTopBar() {
  const { pathname } = useLocation();
  const title = titles[pathname] || "GEO";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <ProjectSelector />
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-white/20">›</span>
          <span className="text-white/40">GEO</span>
          <span className="text-white/20">›</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            placeholder="Search..."
            className="w-48 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <NotificationButton />
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600 ring-2 ring-white/10" />
      </div>
    </header>
  );
}
