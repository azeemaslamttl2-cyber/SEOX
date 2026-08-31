import { NavLink } from "react-router-dom";
import {
  Crosshair,
  HeartPulse,
  Quote,
  Swords,
  Link2,
  MessageSquare,
  Globe2,
  Zap,
  FileText,
  Cpu,
  ShieldCheck,
} from "lucide-react";

const nav = [
  {
    section: "GEO Intelligence",
    items: [
      { label: "Prompt Tracking", to: "/geo/prompt-tracking", icon: Crosshair },
      { label: "Brand Sentiment", to: "/geo/brand-sentiment", icon: HeartPulse },
      { label: "AI Citation Flow", to: "/geo/citation-flow", icon: Quote },
      { label: "Competitor Research", to: "/geo/competitor-research", icon: Swords },
    ],
  },
  {
    section: "Crawl & Analyze",
    items: [
      { label: "Internal Links Crawl", to: "/geo/internal-links", icon: Link2 },
      { label: "AI Chat Console", to: "/geo/ai-chat", icon: MessageSquare },
    ],
  },
  {
    section: "SemanticsX GEO",
    items: [
      { label: "LLMs.txt Generator", to: "/geo/llms-generator", icon: FileText },
      { label: "AI Model Index", to: "/geo/ai-model-checker", icon: Cpu },
      { label: "AI Compatibility", to: "/geo/ai-compatibility", icon: ShieldCheck },
    ],
  },
];

export default function GeoSecondaryNav() {
  return (
    <aside className="app-sidebar sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <nav className="space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              <Globe2 className="h-3.5 w-3.5" />
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
                          ? "bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-200"
                          : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-white/30"}`} />
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
        <div className="mx-1 mt-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Zap className="h-3.5 w-3.5" /> AI-Powered GEO
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            Optimize your visibility across AI platforms like ChatGPT, Gemini, Claude & more.
          </p>
        </div>
      </nav>
    </aside>
  );
}
