import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bot,
  Code,
  FileCode,
  FileText,
  Grid3X3,
  Image,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import IconRail from "../components/auditor/IconRail.jsx";
import ProjectSelector from "../components/ProjectSelector.jsx";

const groups = {
  schema: {
    label: "Schema SEO",
    accent: "cyan",
    icon: Code,
    sections: [
      {
        label: "Structured Data",
        items: [
          {
            label: "Schema Generator",
            to: "/schema-seo",
            icon: FileCode,
            end: true,
            activeWhen: (pathname) =>
              pathname === "/schema-seo" ||
              (pathname.startsWith("/schema-seo/") && !pathname.startsWith("/schema-seo/competitor-schema")),
          },
          { label: "Competitor Schema", to: "/schema-seo/competitor-schema", icon: Search },
        ],
      },
    ],
  },
  semantic: {
    label: "Semantic SEO",
    accent: "violet",
    icon: Sparkles,
    sections: [
      {
        label: "Knowledge Base",
        items: [
          { label: "Resources", to: "/semantic-seo/resources", icon: FileText },
          { label: "AI Agents", to: "/semantic-seo/ai-agents", icon: Bot },
        ],
      },
    ],
  },
  local: {
    label: "Local SEO",
    accent: "teal",
    icon: MapPin,
    sections: [
      {
        label: "Local Visibility",
        items: [
          { label: "Image Geo Tagger", to: "/local-seo/image-geo-tagger", icon: Image },
          { label: "Rank Grid Pro", to: "/local-seo/rank-grid-pro", icon: Grid3X3 },
        ],
      },
    ],
  },
};

const accentClasses = {
  cyan: {
    active: "bg-cyan-500/15 text-cyan-200",
    icon: "text-cyan-400",
    glow: "bg-cyan-500/[0.06]",
    card: "border-cyan-500/25 from-cyan-500/10 to-blue-500/5 text-cyan-300",
  },
  teal: {
    active: "bg-teal-500/15 text-teal-200",
    icon: "text-teal-400",
    glow: "bg-teal-500/[0.06]",
    card: "border-teal-500/25 from-teal-500/10 to-emerald-500/5 text-teal-300",
  },
  violet: {
    active: "bg-violet-500/15 text-violet-200",
    icon: "text-violet-400",
    glow: "bg-violet-500/[0.06]",
    card: "border-violet-500/25 from-violet-500/10 to-fuchsia-500/5 text-violet-300",
  },
};

function getTitle(config, pathname) {
  const items = config.sections.flatMap((section) => section.items);
  const exact = items.find((item) => item.to === pathname);
  if (exact) return exact.label;
  const nested = items.find((item) => pathname.startsWith(`${item.to}/`));
  return nested?.label || config.label;
}

export default function FeatureGroupLayout({ group }) {
  const { pathname } = useLocation();
  const config = groups[group] || groups.semantic;
  const accent = accentClasses[config.accent];
  const GroupIcon = config.icon;
  const title = getTitle(config, pathname);

  return (
    <div className="app-shell relative flex h-screen overflow-hidden bg-ink-900 text-white">
      <IconRail />

      <aside className="app-sidebar sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block no-scrollbar">
        <nav className="space-y-5">
          {config.sections.map((section) => (
            <div key={section.label}>
              <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
                <GroupIcon className="h-3.5 w-3.5" />
                {section.label}
              </h4>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => {
                          const active = isActive || item.activeWhen?.(pathname);
                          return `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                            active ? accent.active : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"
                          }`;
                        }}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`h-4 w-4 ${isActive || item.activeWhen?.(pathname) ? accent.icon : "text-white/30"}`} />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className={`mx-1 mt-6 rounded-2xl border bg-gradient-to-br p-3 ${accent.card}`}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <GroupIcon className="h-3.5 w-3.5" />
              {config.label}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              Imported from SemanticsX and available alongside the PGC workflow.
            </p>
          </div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-topbar sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <ProjectSelector />
            <div className="hidden items-center gap-2 text-sm lg:flex">
              <span className="text-white/20">&gt;</span>
              <span className="text-white/40">{config.label}</span>
              <span className="text-white/20">&gt;</span>
              <span className="font-semibold text-white">{title}</span>
            </div>
          </div>
        </header>

        <main className="app-main min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
