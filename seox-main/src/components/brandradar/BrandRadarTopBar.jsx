import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../Avatar.jsx";
import NotificationButton from "../NotificationButton.jsx";
import ProjectSelector from "../ProjectSelector.jsx";

const titles = {
  "/brand-radar": "Brand Radar",
  "/brand-radar/overview": "Overview",
  "/brand-radar/ai-visibility": "AI Visibility",
  "/brand-radar/ai-responses": "AI Responses",
  "/brand-radar/topics": "Topics",
  "/brand-radar/cited-pages": "Cited Pages",
  "/brand-radar/youtube": "YouTube Visibility",
  "/brand-radar/tiktok": "TikTok Visibility",
  "/brand-radar/reddit": "Reddit Visibility",
  "/brand-radar/serp": "SERP Visibility",
  "/brand-radar/search-demand": "Search Demand",
  "/brand-radar/queries": "Search Queries",
  "/brand-radar/web-visibility": "Web Visibility",
  "/brand-radar/web-pages": "Web Pages",
  "/brand-radar/custom-prompts": "Custom Prompts",
  "/brand-radar/reports": "Saved Reports",
};

export default function BrandRadarTopBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = titles[pathname] || "Brand Radar";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      {/* Left: Project selector + Breadcrumb */}
      <div className="flex items-center gap-3">
        <ProjectSelector />
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-white/20">›</span>
          <span className="text-white/40">Brand Radar</span>
          <span className="text-white/20">›</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            placeholder="Search brands..."
            className="w-48 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <NotificationButton />
        {user ? (
          <Avatar user={user} size={32} />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 ring-2 ring-white/10" />
        )}
      </div>
    </header>
  );
}
