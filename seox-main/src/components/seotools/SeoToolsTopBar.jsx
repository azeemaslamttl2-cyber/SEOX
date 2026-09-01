import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import NotificationButton from "../NotificationButton.jsx";
import ProjectSelector from "../ProjectSelector.jsx";

const titles = {
  "/seo-tools": "SEO Tools",
  "/seo-tools/url-editor": "Ultimate URL Editor",
  "/seo-tools/text-editor": "Universal Text Editor",
  "/seo-tools/domain-separator": "Domain Separator",
  "/seo-tools/word-counter": "Word Counter",
  "/seo-tools/bot-viewer": "Bot Viewer",
  "/seo-tools/da-pa-checker": "Bulk DA/PA Checker",
  "/seo-tools/sitemap-generator": "Sitemap Generator",
  "/seo-tools/robots-generator": "Robots.txt Generator",
  "/seo-tools/sitemap-extractor": "XML Sitemap Extractor",
  "/seo-tools/meta-extractor": "Bulk Meta Extractor",
};

export default function SeoToolsTopBar() {
  const { pathname } = useLocation();
  const title = titles[pathname] || "SEO Tools";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <ProjectSelector />
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-white/20">›</span>
          <span className="text-white/40">SEO Tools</span>
          <span className="text-white/20">›</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input className="w-36 bg-transparent text-xs text-white/60 placeholder:text-white/25 focus:outline-none" placeholder="Search tools..." />
        </div>
        <NotificationButton />
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500" />
      </div>
    </header>
  );
}
