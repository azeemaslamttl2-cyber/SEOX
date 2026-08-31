import { NavLink } from "react-router-dom";
import {
  ShieldCheck,
  Bot,
  Zap,
  Gauge,
  Wrench,
  BarChart3,
  Link2,
  Copy,
  FileSearch,
  Brain,
} from "lucide-react";

const nav = [
  {
    section: "Technical SEO",
    items: [
      { label: "EEAT Audit", to: "/tech-seo/eeat", icon: ShieldCheck },
      { label: "Semantic Audit", to: "/tech-seo/semantic", icon: Brain },
      { label: "Robots.txt Analyzer", to: "/tech-seo/robots", icon: Bot },
      { label: "Crawl Optimization", to: "/tech-seo/crawl", icon: Zap },
      { label: "Speed Optimization", to: "/tech-seo/speed", icon: Gauge },
    ],
  },
  {
    section: "Search Console",
    items: [
      { label: "GSC Audit", to: "/tech-seo/gsc-audit", icon: BarChart3 },
      { label: "Bing Webmaster", to: "/tech-seo/bing", icon: BarChart3 },
    ],
  },
  {
    section: "Content & Links",
    items: [
      { label: "Backlinks Audit", to: "/tech-seo/backlinks", icon: Link2 },
      { label: "Duplicate Checker", to: "/tech-seo/duplicate", icon: Copy },
      { label: "Plagiarism Checker", to: "/tech-seo/plagiarism", icon: FileSearch },
    ],
  },
];

export default function TechSeoSecondaryNav() {
  return (
    <aside className="app-sidebar sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <nav className="space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              <Wrench className="h-3.5 w-3.5" />
              {section.section}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
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
                        <item.icon className={`h-4 w-4 ${isActive ? "text-brand-400" : "text-white/30"}`} />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* CTA */}
        <div className="mx-1 mt-6 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-violet-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
            <Zap className="h-3.5 w-3.5" /> Full-site audit
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            Run a comprehensive crawl-based audit across your entire domain.
          </p>
          <NavLink
            to="/auditor"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-200 hover:underline"
          >
            Open Site Auditor →
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}
