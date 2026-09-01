import { HelpCircle } from "lucide-react";

export default function Card({ title, hint, total, action, className = "", children }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 p-5 backdrop-blur transition-colors hover:border-white/15 ${className}`}
    >
      {/* Subtle glow on hover */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/[0.06] via-transparent to-transparent" />
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {hint && <HelpCircle className="h-3.5 w-3.5 text-white/30" />}
            {total !== undefined && (
              <span className="ml-1 text-sm font-bold text-brand-300">
                {total.toLocaleString()}
              </span>
            )}
          </div>
          {action}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
