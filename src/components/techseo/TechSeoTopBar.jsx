import { useLocation } from "react-router-dom";
import { Search, Bell, Moon } from "lucide-react";
import ProjectSelector from "../ProjectSelector.jsx";
import UserMenu from "../UserMenu.jsx";

const titles = {
  "/tech-seo/eeat": "EEAT Technical Audit",
  "/tech-seo/semantic": "Semantic Audit",
  "/tech-seo/robots": "Robots.txt Analyzer",
  "/tech-seo/crawl": "Crawl Optimization",
  "/tech-seo/speed": "Speed Optimization",
  "/tech-seo/gsc-audit": "GSC Audit",
  "/tech-seo/bing": "Bing Webmaster",
  "/tech-seo/backlinks": "Backlinks Audit",
  "/tech-seo/duplicate": "Duplicate Checker",
  "/tech-seo/plagiarism": "Plagiarism Checker",
};

export default function TechSeoTopBar() {
  const { pathname } = useLocation();
  const title = titles[pathname] || "Technical SEO";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      {/* Left: Project selector + Breadcrumb */}
      <div className="flex items-center gap-3">
        <ProjectSelector />
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-white/20">›</span>
          <span className="text-white/40">Technical SEO</span>
          <span className="text-white/20">›</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            placeholder="Search check points..."
            className="w-48 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white">
          <Moon className="h-4 w-4" />
        </button>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
