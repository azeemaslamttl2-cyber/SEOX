import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Radar,
  ShieldCheck,
  Lightbulb,
  Wrench,
  FileSearch,
  Link2,
  Search,
  PenTool,
  Boxes,
  Code,
  Globe2,
  MapPin,
  Settings,
  Shield,
  Sparkles,
  Youtube,
} from "lucide-react";
import Logo from "../Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const tools = [
  { Icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { Icon: Shield, label: "Admin Panel", to: "/admin" },
  { Icon: Radar, label: "Brand Radar", to: "/brand-radar" },
  { Icon: ShieldCheck, label: "Site Audit", to: "/auditor", active: true },
  { Icon: Lightbulb, label: "GSC Insights", to: "/gsc" },
  { Icon: Wrench, label: "Technical SEO", to: "/tech-seo" },
  { Icon: FileSearch, label: "On-Page SEO", to: "/on-page" },
  { Icon: Link2, label: "Off-Page SEO", to: "/off-page" },
  { Icon: Search, label: "Keyword Research", to: "/keywords" },
  { Icon: PenTool, label: "Content Creation", to: "/content" },
  { Icon: Sparkles, label: "Semantic SEO", to: "/semantic-seo" },
  { Icon: Code, label: "Schema SEO", to: "/schema-seo" },
  { Icon: MapPin, label: "Local SEO", to: "/local-seo" },
  { Icon: Boxes, label: "SEO Tools", to: "/seo-tools" },
  { Icon: Globe2, label: "GEO", to: "/geo" },
  { Icon: Youtube, label: "YouTube SEO", to: "/youtube" },
];

export default function IconRail() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const visibleTools = tools.filter((tool) => tool.to !== "/admin" || isAdmin);

  return (
    <aside className="sticky top-0 flex h-screen w-[68px] flex-col items-center border-r border-white/10 bg-ink-900/95 py-4">
      <Link to="/" title="Back to AI Smart Seo" className="mb-5 flex items-center justify-center">
        <Logo className="h-8 w-8" />
      </Link>

      <nav className="flex flex-col items-center gap-1.5">
        {visibleTools.map((t) => {
          const active = pathname.startsWith(t.to);
          return (
            <Link
              key={t.label}
              to={t.to}
              title={t.label + (t.soon ? " (coming soon)" : "")}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
                active
                  ? "bg-brand-500/15 text-brand-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.3)]"
                  : "text-white/50 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-x-3 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-400 to-brand-600 shadow-brand-glow" />
              )}
              <t.Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-ink-700 px-2.5 py-1 text-xs font-medium shadow-lg group-hover:block">
                {t.label}
                {t.soon && <span className="ml-1.5 text-[10px] text-white/40">soon</span>}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Link
          to="/settings/stripe"
          title="Settings"
          className={`group relative flex h-12 w-12 items-center justify-center rounded-xl transition ${
            pathname.startsWith("/settings")
              ? "bg-brand-500/15 text-brand-300 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.3)]"
              : "text-white/50 hover:bg-white/[0.04] hover:text-white"
          }`}
        >
          {pathname.startsWith("/settings") && (
            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-x-3 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-400 to-brand-600 shadow-brand-glow" />
          )}
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </aside>
  );
}
