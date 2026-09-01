import { NavLink } from "react-router-dom";
import {
  Search,
  Sparkles,
  Lightbulb,
  ArrowUpRight,
  Cherry,
  TrendingDown,
  Tag,
  Copy,
} from "lucide-react";

const nav = [
  {
    section: "Keyword Research",
    items: [
      { label: "Keyword Research", to: "/keywords/research", icon: Search },
      { label: "Suggest Keywords", to: "/keywords/suggest", icon: Sparkles },
      { label: "Ubersuggest", to: "/keywords/ubersuggest", icon: Lightbulb },
      { label: "New Keywords", to: "/keywords/new", icon: ArrowUpRight },
      { label: "Low Hanging Keywords", to: "/keywords/low-hanging", icon: Cherry },
      { label: "Lost Keywords", to: "/keywords/lost", icon: TrendingDown },
      { label: "Branded Keywords", to: "/keywords/branded", icon: Tag },
      { label: "SERP Checker", to: "/keywords/serp-checker", icon: Search },
      { label: "Keyword Cannibalization", to: "/keywords/cannibalization", icon: Copy },
    ],
  },
];

export default function KeywordSecondaryNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <nav className="space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              <Search className="h-3.5 w-3.5" />
              {section.section}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                          isActive
                            ? "bg-blue-500/15 text-blue-300 font-semibold"
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
          </div>
        ))}
      </nav>
    </aside>
  );
}
