import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function ToolHeader({ title, subtitle, gradient, Icon }) {
  return (
    <>
      <Link
        to="/seo-tools"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/55 hover:text-white/80 transition"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Tools
      </Link>

      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-5`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent)]" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-black text-white">{title}</h1>
            {subtitle && <p className="text-xs text-white/60">{subtitle}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
