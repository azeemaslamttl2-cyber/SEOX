import { AlertCircle, CheckCircle2, Database, Loader2 } from "lucide-react";

export default function BrandRadarDataForSeoStatus({ loading, error, data, className = "" }) {
  const isLive = Boolean(data?.success);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs ${className}`}>
      <div className="flex items-center gap-2 text-white/60">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-300" />
        ) : error ? (
          <AlertCircle className="h-4 w-4 text-amber-300" />
        ) : isLive ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <Database className="h-4 w-4 text-white/35" />
        )}
        <span>
          {loading
            ? "Loading DataForSEO data"
            : error
              ? "DataForSEO request failed"
              : isLive
                ? "Live DataForSEO data"
                : "No live DataForSEO data returned"}
        </span>
      </div>
      {error ? <span className="max-w-xl truncate text-amber-200/80">{error}</span> : null}
      {isLive && Number(data.cost || 0) > 0 ? (
        <span className="font-mono text-white/35">cost ${Number(data.cost || 0).toFixed(4)}</span>
      ) : null}
    </div>
  );
}
