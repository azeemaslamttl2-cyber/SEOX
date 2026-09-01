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
  "/tech-seo/w3c": "W3C Validation",
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#eededd] bg-white/90 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <ProjectSelector />
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-[#b8b3cf]">›</span>
          <span className="text-[#5a5789]">Technical SEO</span>
          <span className="text-[#b8b3cf]">›</span>
          <span className="font-semibold text-[#2d2b6f]">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-[#edd9d6] bg-[#f9f5f5] px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-[#7c7aa2]" />
          <input
            placeholder="Search check points..."
            className="w-48 bg-transparent text-xs text-[#2d2b6f] placeholder:text-[#8c88b3] focus:outline-none"
          />
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a5789] transition hover:bg-[#f6efef] hover:text-[#2d2b6f]">
          <Moon className="h-4 w-4" />
        </button>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#5a5789] transition hover:bg-[#f6efef] hover:text-[#2d2b6f]">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ea5b4a]" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
