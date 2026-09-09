import { NavLink } from "react-router-dom";
import { Search, FileSearch, Wrench } from "lucide-react";

const nav = [
  {
    section: "On-Page SEO",
    items: [
      { label: "On-Page Analyzer", to: "/on-page/analyzer", icon: Search },
    ],
  },
];

export default function OnPageSecondaryNav() {
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
                            ? "bg-brand-500/15 text-brand-300 font-semibold"
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

      {/* CTA */}
      <div className="mt-8 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-4 text-center">
        <p className="text-[11px] font-bold text-brand-300">Need a full site audit?</p>
        <p className="mt-0.5 text-[10px] text-white/35">Run our comprehensive Site Auditor</p>
        <NavLink
          to="/auditor"
          className="mt-2 inline-block rounded-lg bg-brand-500/20 px-3 py-1.5 text-[11px] font-bold text-brand-300 transition hover:bg-brand-500/30"
        >
          Open Auditor
        </NavLink>
      </div>
    </aside>
  );
}
