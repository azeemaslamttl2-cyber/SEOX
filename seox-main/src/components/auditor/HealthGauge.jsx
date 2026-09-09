/**
 * Half-circle SVG gauge with gradient stroke and animated needle.
 * Score is laid out cleanly inside the half-circle, and the needle
 * has a tapered shape so it points unambiguously at the value.
 */
export default function HealthGauge({ score = 94, grade = "Excellent" }) {
  const clamped = Math.max(0, Math.min(100, score));
  const size = 240;
  const thickness = 22;
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const svgHeight = cy + 18; // a little extra room for the needle base

  // Semi-circle from left to right across the top half
  const startX = cx - radius;
  const endX = cx + radius;
  const path = `M ${startX} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${cy}`;

  const arcLength = Math.PI * radius;
  const filled = (clamped / 100) * arcLength;

  // 180° → 0° maps score 0 → 100, then convert to radians
  const angleDeg = 180 - (clamped / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;

  // The needle is a tapered triangle pivoted at (cx, cy)
  const needleLen = radius - thickness / 2 - 6;
  const tipX = cx + Math.cos(angleRad) * needleLen;
  const tipY = cy - Math.sin(angleRad) * needleLen;

  // perpendicular for the base width
  const baseHalf = 5;
  const perp = angleRad + Math.PI / 2;
  const bx1 = cx + Math.cos(perp) * baseHalf;
  const by1 = cy - Math.sin(perp) * baseHalf;
  const bx2 = cx - Math.cos(perp) * baseHalf;
  const by2 = cy + Math.sin(perp) * baseHalf;

  const gradeColor =
    clamped >= 90
      ? "text-emerald-400 bg-emerald-500/15"
      : clamped >= 60
      ? "text-amber-400 bg-amber-500/15"
      : "text-rose-400 bg-rose-500/15";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: svgHeight }}>
        <svg width={size} height={svgHeight} viewBox={`0 0 ${size} ${svgHeight}`}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="65%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path
            d={path}
            fill="none"
            stroke="#eef0f5"
            strokeWidth={thickness}
            strokeLinecap="round"
          />
          {/* Filled */}
          <path
            d={path}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${arcLength}`}
            filter="url(#gaugeGlow)"
            className="transition-all duration-1000"
          />

          {/* Needle (tapered triangle) */}
          <polygon
            points={`${bx1},${by1} ${bx2},${by2} ${tipX},${tipY}`}
            fill="#1b1f33"
            stroke="#ffffff"
            strokeWidth="0.5"
            className="transition-all duration-1000"
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
          {/* Pivot dot */}
          <circle cx={cx} cy={cy} r="7" fill="#1b1f33" stroke="#ffffff" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="3" fill="#ffffff" />

          {/* Score label, centered above the pivot, inside the arc */}
          <text
            x={cx}
            y={cy - 18}
            textAnchor="middle"
            className="font-display fill-white"
            style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            {clamped}
          </text>
        </svg>
      </div>

      <div
        className={`-mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wider ${gradeColor}`}
      >
        {grade}
      </div>
    </div>
  );
}
