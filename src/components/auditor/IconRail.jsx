import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
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
];

export default function IconRail() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const visibleTools = tools.filter((tool) => tool.to !== "/admin" || isAdmin);

  // The rail scrolls, and a scroll container clips anything positioned
  // outside it — so the label is rendered into document.body and placed
  // from the icon's viewport rect instead of being nested inside it.
  const [tip, setTip] = useState(null);
  const showTip = useCallback((event, label, soon) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ label, soon, top: rect.top + rect.height / 2, left: rect.right + 10 });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  return (
    <aside className="app-sidebar app-icon-rail sticky top-0 flex h-screen w-[68px] flex-col items-center border-r border-white/10 bg-ink-900/95 py-4">
      <Link
        to="/"
        aria-label="Back to PGC"
        onMouseEnter={(event) => showTip(event, "Back to PGC")}
        onMouseLeave={hideTip}
        onFocus={(event) => showTip(event, "Back to PGC")}
        onBlur={hideTip}
        className="app-rail-logo mb-5 flex items-center justify-center"
      >
        <Logo variant="white" className="h-11 w-auto" />
      </Link>

      <nav onScroll={hideTip} className="app-rail-nav flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto no-scrollbar">
        {visibleTools.map((t) => {
          const active = pathname.startsWith(t.to) && (t.to === "/dashboard" || t.to === "/admin" || t.to === "/brand-radar" || t.to === "/auditor" || t.to === "/gsc" || t.to === "/tech-seo" || t.to === "/on-page" || t.to === "/off-page" || t.to === "/keywords" || t.to === "/content" || t.to === "/semantic-seo" || t.to === "/schema-seo" || t.to === "/local-seo" || t.to === "/seo-tools" || t.to === "/geo");
          return (
            <Link
              key={t.label}
              to={t.to}
              aria-label={t.label + (t.soon ? " (coming soon)" : "")}
              onMouseEnter={(event) => showTip(event, t.label, t.soon)}
              onMouseLeave={hideTip}
              onFocus={(event) => showTip(event, t.label, t.soon)}
              onBlur={hideTip}
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
            </Link>
          );
        })}
      </nav>

      <div className="app-rail-footer mt-auto">
        <Link
          to="/settings/stripe"
          aria-label="Settings"
          onMouseEnter={(event) => showTip(event, "Settings")}
          onMouseLeave={hideTip}
          onFocus={(event) => showTip(event, "Settings")}
          onBlur={hideTip}
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

      {tip &&
        createPortal(
          <div
            role="tooltip"
            className="app-rail-tooltip"
            style={{ top: tip.top, left: tip.left }}
          >
            {tip.label}
            {tip.soon && <span className="app-rail-tooltip-soon">soon</span>}
          </div>,
          document.body
        )}
    </aside>
  );
}
