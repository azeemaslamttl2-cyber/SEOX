/**
 * Tiny inline bar chart (used in issue tables).
 *
 * `values` is a short array of non-negative numbers.
 */
export default function Sparkline({
  values = [],
  width = 70,
  height = 22,
  color = "#df3c27",
  empty = false,
}) {
  if (!values || values.length === 0 || empty) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const barW = width / values.length;
  const gap = Math.min(1.5, barW * 0.15);
  return (
    <svg width={width} height={height}>
      {values.map((v, i) => {
        const h = Math.max((v / max) * height, v > 0 ? 2 : 1);
        const x = i * barW;
        return (
          <rect
            key={i}
            x={x + gap / 2}
            y={height - h}
            width={Math.max(barW - gap, 1)}
            height={h}
            fill={v === 0 ? "rgba(255,255,255,0.12)" : color}
            rx="1"
          />
        );
      })}
    </svg>
  );
}
