import { useState } from "react";
import {
  FileText,
  Globe,
  Plus,
  Layers,
  Trash2,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  ListTree,
} from "lucide-react";
import { extractOutlineFromUrls } from "../../lib/contentTools.js";
import { improveOutlineWithDeepSeek } from "../../lib/deepseekContent.js";

/* ── Hero Gauge component matching EeatAudit HeroGauge style ── */
function HeroGauge({ count, loading }) {
  return (
    <div className="flex flex-col items-center gap-2 lg:pr-4">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-2xl" />
        <svg width="128" height="128" className="-rotate-90 relative z-10">
          <circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
          />
          <circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={2 * Math.PI * 54 * (1 - Math.min(count, 30) / 30)}
            style={{
              filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))",
              transition: "stroke-dashoffset 0.5s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-black text-white">
            {loading ? "..." : count}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300">
            Headings
          </span>
        </div>
      </div>
      <span className="eeat-rating rounded-full bg-brand-500/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-300">
        {loading ? "Extracting..." : count > 0 ? "Outline Ready" : "Standby"}
      </span>
    </div>
  );
}

/* ── Metric tile for the metric strip ── */
function MetricTile({ value, label, sub, accent, dotColor }) {
  return (
    <div className="relative px-5 py-4 text-center border-r border-white/[0.04] last:border-r-0">
      <div className="flex items-center justify-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          {label}
        </span>
      </div>
      <div className={`mt-1 font-display text-2xl font-black ${accent}`}>
        {value}
      </div>
      <div className="text-[10px] text-white/25">{sub}</div>
    </div>
  );
}

export default function OutlineCreator() {
  const [urls, setUrls] = useState([""]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function addUrl() {
    setUrls([...urls, ""]);
  }

  function updateUrl(i, val) {
    const copy = [...urls];
    copy[i] = val;
    setUrls(copy);
  }

  function removeUrl(i) {
    setUrls(urls.filter((_, idx) => idx !== i));
  }

  async function handleExtract() {
    if (!urls.some((u) => u.trim())) return;
    setLoading(true);
    setError("");
    try {
      const cleanUrls = urls.map((item) => item.trim()).filter(Boolean);
      const outline = await extractOutlineFromUrls(cleanUrls);
      if (!outline.length) {
        setResults([]);
        setError("No headings were found on the supplied URL(s).");
        return;
      }
      try {
        setResults(await improveOutlineWithDeepSeek({ urls: cleanUrls, outline }));
      } catch (err) {
        setResults(outline);
        setError(err.message || "DeepSeek could not improve the outline. Showing extracted headings.");
      }
    } catch (err) {
      setResults([]);
      setError(err.message || "Could not extract outlines from those URLs.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!results || !results.length) return;
    const text = results
      .map((item) => {
        const prefix =
          item.tag === "h1"
            ? "# "
            : item.tag === "h2"
            ? "## "
            : item.tag === "h3"
            ? "### "
            : "#### ";
        return `${prefix}${item.text}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const validUrlCount = urls.filter((u) => u.trim()).length;
  const headingsCount = results ? results.length : 0;
  const h1Count = results ? results.filter((r) => r.tag === "h1").length : 0;
  const subHeadingsCount = results ? results.filter((r) => r.tag !== "h1").length : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ─────────── HERO: Split layout matching EeatAudit ─────────── */}
      <div className="eeat-hero relative overflow-hidden rounded-3xl border border-brand-600 bg-brand-500">
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-amber-500/[0.05] blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:p-8">
          {/* Left column */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/30">
                <FileText className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight text-white">
                  Outline Creator
                </h1>
                <p className="text-xs text-white/40">
                  Extract & combine article outlines using DeepSeek AI
                </p>
              </div>
            </div>

            {/* Quick URL input bar inside Hero */}
            <div className="mt-5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/70 bg-white px-4 py-2.5">
                <Globe className="h-4 w-4 text-brand-400/60" />
                <input
                  value={urls[0] || ""}
                  onChange={(e) => updateUrl(0, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && urls.some((u) => u.trim())) handleExtract();
                  }}
                  className="flex-1 bg-transparent text-sm text-college-blue placeholder:text-college-blue/60 focus:outline-none"
                  placeholder="https://example.com/article-to-extract"
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={loading || !urls.some((u) => u.trim())}
                className="ui-button eeat-analyze-button rounded-xl"
              >
                <Layers className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Extracting..." : "Extract + Combine"}
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
                {error}
              </p>
            )}

            {/* Actions row */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={addUrl}
                className="ui-button eeat-secondary-button"
              >
                <Plus className="h-3 w-3" /> Add URL Field
              </button>
              {results && results.length > 0 && (
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="ui-button eeat-secondary-button"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied!" : "Copy Outline"}
                </button>
              )}
            </div>
          </div>

          {/* Right column — Hero Gauge */}
          <HeroGauge count={headingsCount} loading={loading} />
        </div>
      </div>

      {/* ─────────── Metric Strip ─────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <MetricTile
          value={validUrlCount}
          label="Source URLs"
          sub={`of ${urls.length} inputs`}
          accent="text-brand-300"
          dotColor="bg-brand-400"
        />
        <MetricTile
          value={headingsCount}
          label="Headings"
          sub="total extracted"
          accent="text-emerald-400"
          dotColor="bg-emerald-400"
        />
        <MetricTile
          value={h1Count}
          label="H1 Titles"
          sub="main headings"
          accent="text-sky-400"
          dotColor="bg-sky-400"
        />
        <MetricTile
          value={subHeadingsCount}
          label="Sub-Headings"
          sub="H2, H3, & H4 tags"
          accent="text-violet-400"
          dotColor="bg-violet-400"
        />
      </div>

      {/* ─────────── Source URLs Input Panel ─────────── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01]">
        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <Globe className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white/90">
                Source Webpages
              </div>
              <div className="text-[11px] text-white/40">
                Provide article URLs to crawl and combine into a master outline
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={addUrl}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/[0.08] hover:text-white transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add URL
          </button>
        </div>

        <div className="p-5 space-y-3">
          {urls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/30 transition">
                <span className="text-[10px] font-bold uppercase text-white/30 tracking-wider">
                  URL {i + 1}
                </span>
                <Globe className="h-4 w-4 text-brand-400/60" />
                <input
                  value={url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && urls.some((u) => u.trim())) handleExtract();
                  }}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                  placeholder="https://example.com/article"
                />
              </div>
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrl(i)}
                  className="rounded-xl p-2.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Remove URL"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleExtract}
              disabled={loading || !urls.some((u) => u.trim())}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:shadow-brand-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Extracting & Enhancing..." : "Extract + AI Combine Outline"}
            </button>

            {results && results.length > 0 && (
              <span className="text-xs text-white/40 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" /> Output ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─────────── Extracted Outline Results ─────────── */}
      {results && results.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01]">
          {/* Section header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] px-5 py-4 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <ListTree className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-white/90 flex items-center gap-2">
                  Extracted Outline
                  <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-black text-brand-300 ring-1 ring-brand-500/30">
                    {results.length} Headings
                  </span>
                </div>
                <div className="text-[11px] text-white/40">
                  Hierarchical structure built from source webpages
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/[0.08] hover:text-white transition"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied Markdown!" : "Copy Outline"}
            </button>
          </div>

          {/* List items */}
          <div className="divide-y divide-white/[0.03]">
            {results.map((item, i) => {
              const isH1 = item.tag === "h1";
              const isH2 = item.tag === "h2";
              const isH3 = item.tag === "h3";

              return (
                <div
                  key={i}
                  className={`group flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-white/[0.02] ${
                    isH1
                      ? "pl-5 bg-brand-500/[0.02]"
                      : isH2
                      ? "pl-9"
                      : isH3
                      ? "pl-14"
                      : "pl-20"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        isH1
                          ? "bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30"
                          : isH2
                          ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/20"
                          : isH3
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20"
                          : "bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/20"
                      }`}
                    >
                      {item.tag}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
                    <span
                      className={`text-sm min-w-0 ${
                        isH1
                          ? "font-bold text-white"
                          : isH2
                          ? "font-semibold text-white/90"
                          : "text-white/70"
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.01] py-16 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
            <FileText className="h-8 w-8 text-brand-400/40" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white/60">
            No outlines extracted yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-white/35">
            Add target article URLs above and click{" "}
            <span className="text-white/60 font-semibold">
              Extract + AI Combine
            </span>{" "}
            to generate a unified structure.
          </p>
        </div>
      )}
    </div>
  );
}

