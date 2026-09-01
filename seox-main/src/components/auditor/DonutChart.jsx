/**
 * Animated SVG donut chart.
 *
 * Props:
 *   segments: [{ label, value, color }]
 *   size: pixel diameter
 *   thickness: stroke width
 */
export default function DonutChart({ segments, size = 150, thickness = 18, center }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={thickness}
          />
          {/* Segments */}
          {segments.map((seg, i) => {
            const length = (seg.value / total) * circumference;
            const dasharray = `${length} ${circumference}`;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                className="origin-center transition-all duration-700"
              />
            );
            offset += length;
            return el;
          })}
        </svg>
        {center !== undefined && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-display text-2xl font-bold tabular-nums">
              {center.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-2 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 truncate text-white/70">{s.label}</span>
            <span className="font-semibold tabular-nums text-white">
              {s.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
