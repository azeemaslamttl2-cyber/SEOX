import { NavLink } from "react-router-dom";
import { Wrench, LayoutGrid, Link2, Type, Globe, Hash, Eye, ArrowUpDown, Map, FileCode2, FileCode, Database, FileSpreadsheet } from "lucide-react";

const nav = [
  { label: "All Tools", to: "/seo-tools", icon: LayoutGrid, end: true },
  { label: "Ultimate URL Editor", to: "/seo-tools/url-editor", icon: Link2 },
  { label: "Universal Text Editor", to: "/seo-tools/text-editor", icon: Type },
  { label: "Domain Separator", to: "/seo-tools/domain-separator", icon: Globe },
  { label: "Word Counter", to: "/seo-tools/word-counter", icon: Hash },
  { label: "Bot Viewer", to: "/seo-tools/bot-viewer", icon: Eye },
  { label: "Bulk DA/PA Checker", to: "/seo-tools/da-pa-checker", icon: ArrowUpDown },
  { label: "Sitemap Generator", to: "/seo-tools/sitemap-generator", icon: Map },
  { label: "Robots.txt Generator", to: "/seo-tools/robots-generator", icon: FileCode2 },
  { label: "XML Sitemap Extractor", to: "/seo-tools/sitemap-extractor", icon: FileCode },
  { label: "Bulk Meta Extractor", to: "/seo-tools/meta-extractor", icon: Database },
  { label: "Bulk CSV Reporter", to: "/seo-tools/csv-reporter", icon: FileSpreadsheet },
];

export default function SeoToolsSecondaryNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
        <Wrench className="h-3.5 w-3.5" /> SEO Tools
      </h4>
      <ul className="space-y-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-300 font-semibold"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
