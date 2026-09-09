/**
 * Larger bar chart used below the Health Score (showing daily trend).
 */
export default function MiniBars({ values, labels, height = 80 }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  return (
    <div>
      <div
        className="flex items-end gap-[2px]"
        style={{ height }}
      >
        {values.map((v, i) => {
          const ratio = (v - min + 1) / (max - min + 1);
          const h = Math.max(ratio * height, 6);
          // Color shifts with value
          const isLow = v < max * 0.85;
          return (
            <div
              key={i}
              className={`mini-bar flex-1 rounded-sm transition-all ${
                isLow ? "mini-bar-low" : "mini-bar-high"
              }`}
              style={{ height: h }}
              title={`${v}`}
            />
          );
        })}
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[10px] text-white/40">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
