import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Brain,
  Bot,
  Zap,
  Gauge,
  BarChart3,
  Link2,
  Copy,
  FileSearch,
  Search,
  PenTool,
  Lightbulb,
  Globe2,
  Wrench,
  Boxes,
  Sparkles,
  TrendingUp,
  BookOpen,
  ListChecks,
  Hash,
  Wand2,
  Diff,
  Eraser,
  ExternalLink,
  FolderSearch,
  Compass,
  MessageSquare,
  Users,
  Network,
  CreditCard,
} from "lucide-react";

const nav = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Technical SEO",
    items: [
      { label: "E-E-A-T Audit", to: "/tech-seo/eeat", icon: ShieldCheck },
      { label: "Semantic Audit", to: "/tech-seo/semantic", icon: Brain },
      { label: "Speed Optimization", to: "/tech-seo/speed", icon: Gauge },
      { label: "Robots.txt Analyzer", to: "/tech-seo/robots", icon: Bot },
      { label: "Crawl Optimization", to: "/tech-seo/crawl", icon: Zap },
      { label: "Backlinks Audit", to: "/tech-seo/backlinks", icon: Link2 },
      { label: "Duplicate Checker", to: "/tech-seo/duplicate", icon: Copy },
      { label: "Plagiarism Checker", to: "/tech-seo/plagiarism", icon: FileSearch },
    ],
  },
  {
    section: "Search Console",
    items: [
      { label: "GSC Insights", to: "/gsc", icon: BarChart3 },
      { label: "GSC Audit", to: "/tech-seo/gsc-audit", icon: BarChart3 },
      { label: "Bing Webmaster", to: "/tech-seo/bing", icon: Globe2 },
    ],
  },
  {
    section: "On-Page SEO",
    items: [
      { label: "On-Page Analyzer", to: "/on-page/analyzer", icon: FileSearch },
    ],
  },
  {
    section: "Off-Page SEO",
    items: [
      { label: "Expired Domains", to: "/off-page/expired-domains", icon: ExternalLink },
      { label: "Backlink Cleaner", to: "/off-page/backlink-cleaner", icon: Eraser },
      { label: "Backlink Indexer", to: "/off-page/backlink-indexer", icon: FolderSearch },
      { label: "Backlink Directory", to: "/off-page/backlink-directory", icon: Boxes },
    ],
  },
  {
    section: "Keywords",
    items: [
      { label: "Keyword Research", to: "/keywords/research", icon: Search },
      { label: "Suggest Keywords", to: "/keywords/suggest", icon: Lightbulb },
      { label: "Ubersuggest", to: "/keywords/ubersuggest", icon: Sparkles },
      { label: "Low Hanging", to: "/keywords/low-hanging", icon: TrendingUp },
      { label: "Lost Keywords", to: "/keywords/lost", icon: Search },
      { label: "Cannibalization", to: "/keywords/cannibalization", icon: Diff },
    ],
  },
  {
    section: "Content",
    items: [
      { label: "Outline Creator", to: "/content/outline", icon: BookOpen },
      { label: "Content Optimization", to: "/content/optimization", icon: PenTool },
      { label: "Entities Extractor", to: "/content/entities-extractor", icon: Hash },
      { label: "NLP Extractor", to: "/content/nlp", icon: Wand2 },
    ],
  },
  {
    section: "SEO Tools",
    items: [
      { label: "Tools Hub", to: "/seo-tools", icon: Wrench },
      { label: "Sitemap Generator", to: "/seo-tools/sitemap-generator", icon: ListChecks },
      { label: "Robots Generator", to: "/seo-tools/robots-generator", icon: Bot },
      { label: "DA/PA Checker", to: "/seo-tools/da-pa-checker", icon: BarChart3 },
    ],
  },
  {
    section: "GEO",
    items: [
      { label: "Prompt Tracking", to: "/geo/prompt-tracking", icon: Compass },
      { label: "Brand Sentiment", to: "/geo/brand-sentiment", icon: Users },
      { label: "AI Citation Flow", to: "/geo/citation-flow", icon: Network },
      { label: "AI Chat Console", to: "/geo/ai-chat", icon: MessageSquare },
    ],
  },
  {
    section: "Settings",
    items: [
      { label: "Stripe", to: "/settings/stripe", icon: CreditCard },
    ],
  },
];

export default function DashboardSidebar() {
  return (
    <aside className="app-sidebar sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block no-scrollbar">
      <nav className="space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              {section.section}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/dashboard"}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                        isActive
                          ? "bg-gradient-to-r from-brand-500/15 to-transparent text-brand-200"
                          : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-brand-400" : "text-white/30"}`} />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

      </nav>
    </aside>
  );
}
