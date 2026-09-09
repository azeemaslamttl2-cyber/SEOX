import { NavLink } from "react-router-dom";
import {
  Radar,
  Eye,
  MessageSquare,
  Hash,
  Quote,
  Video,
  BarChart3,
  Search,
  Globe,
  FileText,
  Bookmark,
  Crosshair,
} from "lucide-react";

const nav = [
  {
    section: "Brand Intelligence",
    items: [
      { label: "Overview", to: "/brand-radar/overview", icon: Radar },
      { label: "AI Visibility", to: "/brand-radar/ai-visibility", icon: Eye },
      { label: "AI Responses", to: "/brand-radar/ai-responses", icon: MessageSquare },
      { label: "Topics", to: "/brand-radar/topics", icon: Hash },
      { label: "Cited Pages", to: "/brand-radar/cited-pages", icon: Quote },
    ],
  },
];

export default function BrandRadarSecondaryNav() {
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
