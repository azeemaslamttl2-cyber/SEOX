import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, HelpCircle } from "lucide-react";

export default function ReportShell({ title, tabs = ["Overview", "Issues"], children }) {
  const [tab, setTab] = useState(tabs[0]);
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          {title}
          <button className="flex items-center gap-1 text-xs font-normal text-white/40 hover:text-white/70">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </h1>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.08]">
          <Download className="h-3.5 w-3.5" /> Print to PDF
        </button>
      </div>

      <div className="border-b border-white/10">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-sm font-medium transition ${
                tab === t ? "text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand-400 to-amber-400" />
              )}
            </button>
          ))}
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
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 p-4 backdrop-blur transition hover:border-white/15 ${
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
    <div className={`rounded-2xl border border-white/10 bg-ink-800/60 p-5 backdrop-blur ${className}`}>
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
                className={`h-full rounded-md transition-all ${v.color || "bg-gradient-to-r from-brand-500 to-amber-400"}`}
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
              className={`h-full rounded-full ${r.color || "bg-gradient-to-r from-brand-500 to-amber-400"}`}
              style={{ width: `${(r.value / m) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
