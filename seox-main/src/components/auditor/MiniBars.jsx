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
              className={`flex-1 rounded-sm bg-gradient-to-t transition-all ${
                isLow
                  ? "from-amber-500/40 to-amber-400"
                  : "from-brand-500 to-amber-300"
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
