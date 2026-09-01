export default function HorizontalBars({ rows }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-20 flex-shrink-0 text-white/70">{r.label}</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-white/5">
            <div
              className={`h-full rounded-md bg-gradient-to-r ${r.color} transition-all duration-700`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right font-semibold tabular-nums text-white">
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
