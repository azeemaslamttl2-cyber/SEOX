import { useLocation } from "react-router-dom";
import { Search, Bell, Moon } from "lucide-react";
import ProjectSelector from "../ProjectSelector.jsx";
import UserMenu from "../UserMenu.jsx";

const titles = {
  "/content/semantic-writer": "Content Writer",
  "/content/content-writer": "Content Writer",
  "/content/ai-helper": "AI Content Helper",
  "/content/outline": "Outline Creator",
  "/content/entities-extractor": "Entities Extractor",
  "/content/entities-generator": "Entities Generator",
  "/content/ngrams": "N-Grams Extractor",
  "/content/nlp": "NLP Extractor",
  "/content/grammar": "Grammar Generator",
  "/content/unique-ngrams": "Unique N-Grams",
  "/content/skip-gram": "Skip Gram Words",
  "/content/optimization": "Content Optimization",
  "/content/watermark-remover": "ChatGPT Watermark Remover",
};

export default function ContentTopBar() {
  const { pathname } = useLocation();
  const title = titles[pathname] || "Content Creation";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <ProjectSelector />
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-white/20">›</span>
          <span className="text-white/40">Content</span>
          <span className="text-white/20">›</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            className="w-36 bg-transparent text-xs text-white/60 placeholder:text-white/25 focus:outline-none"
            placeholder="Search check points..."
          />
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.04]">
          <Moon className="h-4 w-4" />
        </button>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.04]">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
