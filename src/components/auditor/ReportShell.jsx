import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Braces,
  Copy,
  Download,
  ExternalLink,
  FileBarChart,
  FileText,
  Gauge,
  HelpCircle,
  Image as ImageIcon,
  Languages,
  Link2,
  Map as MapIcon,
  Palette,
  Search,
  Share2,
  Shuffle,
  Type,
} from "lucide-react";

/* Each report gets an icon that matches what it actually reports on.
   Keyed by title so the 15 report pages need no changes; a page can
   still override by passing an `icon` prop. */
const REPORT_ICONS = {
  "Internal pages": FileText,
  "External pages": ExternalLink,
  Indexability: Search,
  Links: Link2,
  Redirects: Shuffle,
  Content: Type,
  "Social tags of indexable pages": Share2,
  Duplicates: Copy,
  Localization: Languages,
  Performance: Gauge,
  Images: ImageIcon,
  JavaScript: Braces,
  CSS: Palette,
  Sitemaps: MapIcon,
  Other: Boxes,
};

export default function ReportShell({ title, icon, tabs = ["Overview", "Issues"], children }) {
  const Icon = icon || REPORT_ICONS[title] || FileBarChart;
  const [tab, setTab] = useState(tabs[0]);
  return (
    <div className="space-y-5">
      <div className="auditor-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="auditor-title flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <div>
              <h1 className="font-display">{title}</h1>
              <p className="auditor-description">
                Report data for the active crawl. Switch tabs to review issues.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" className="auditor-help-button" title={`About ${title}`}>
              <HelpCircle className="h-3.5 w-3.5" /> How to use
            </button>
            <button type="button" onClick={() => window.print()} className="ui-button auditor-print-button">
              <Download className="h-4 w-4" /> Print to PDF
            </button>
          </div>
        </div>

        <div className="auditor-hero-tabs">
          <div className="admin-tabs radar-tabs">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`admin-tab ${tab === t ? "active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {typeof children === "function" ? children(tab) : children}
    </div>
  );
}

export function StatCard({ label, value, change, sub, accent = "brand", to }) {
  const colorMap = {
    brand: "text-brand-300",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    sky: "text-sky-400",
  };
  const CardTag = to ? Link : "div";
  return (
    <CardTag
      {...(to ? { to } : {})}
      className={`auditor-card group relative overflow-hidden p-4 ${
        to ? "block cursor-pointer hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-brand-400/50" : ""
      }`}
    >
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {label}
        <HelpCircle className="h-3 w-3 text-white/25" />
      </div>
      <div className={`mt-2 font-display text-3xl font-bold tabular-nums ${colorMap[accent]}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {change != null && change !== 0 && (
        <div className={`mt-1 text-xs font-semibold ${change < 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {change < 0 ? "▼" : "▲"} {Math.abs(change).toLocaleString()}
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-white/45">{sub}</div>}
    </CardTag>
  );
}

export function ChartCard({ title, hint, children, className = "" }) {
  return (
    <div className={`auditor-card ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {hint && <HelpCircle className="h-3.5 w-3.5 text-white/30" />}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function DepthBars({ title = "Distribution by depth level", values = [] }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <ChartCard title={title} hint>
      <div className="space-y-2">
        {values.map((v) => (
          <div key={v.depth} className="flex items-center gap-3 text-sm">
            <span className="w-12 text-right text-xs text-white/50">depth {v.depth}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
              <div
                className={`h-full rounded-md transition-all ${v.color || "auditor-bar"}`}
                style={{ width: `${(v.value / max) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right font-semibold tabular-nums text-white">
              {v.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function HBars({ rows, max }) {
  const m = Math.max(max || 0, ...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-white/65">{r.label}</span>
            <span className="font-semibold tabular-nums text-white">{r.value.toLocaleString()}</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className={`h-full rounded-full ${r.color || "auditor-bar"}`}
              style={{ width: `${(r.value / m) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
