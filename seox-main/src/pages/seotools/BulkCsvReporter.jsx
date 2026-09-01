import { useState, useRef, useCallback } from "react";
import { FileSpreadsheet, Upload, Play, Download, CheckCircle2, XCircle, Loader2, Globe, RotateCcw, ChevronDown, ChevronUp, ShieldCheck, Brain, Bot, Zap, Gauge, Copy, Search, MinusCircle, Link2 } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";
import { BULK_REPORT_TOOL_DEFS, runAllAudits } from "../../lib/bulkAudits.js";
import { csvEscape } from "../../lib/techSeoTools.js";

const CATEGORY_ICONS = {
  speed: Gauge,
  eeat: ShieldCheck,
  semantic: Brain,
  crawlOptimization: Zap,
  robots: Bot,
  duplicate: Copy,
  gsc: Search,
  bing: Globe,
  backlinks: Link2,
  plagiarism: Copy,
};
const CATEGORY_COLORS = {
  speed: "orange",
  eeat: "amber",
  semantic: "blue",
  crawlOptimization: "violet",
  robots: "rose",
  duplicate: "purple",
  gsc: "teal",
  bing: "blue",
  backlinks: "teal",
  plagiarism: "rose",
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const urls = [];
  for (const line of lines) {
    const cell = line.split(/[,;\t]/)[0].replace(/^["']|["']$/g, "").trim();
    if (!cell || /^(url|website|domain)$/i.test(cell)) continue;
    urls.push(/^https?:\/\//i.test(cell) ? cell : `https://${cell}`);
  }
  return [...new Set(urls)];
}

function statusLabel(status) {
  const labels = {
    complete: "Complete",
    error: "Error",
    queued: "Queued",
    running: "Running",
    skipped: "Skipped",
  };
  return labels[status] || "Pending";
}

function ScoreBadge({ score, status = "complete" }) {
  if (!Number.isFinite(score)) {
    const c = status === "error"
      ? "text-red-400 border-red-500/30 bg-red-500/10"
      : "text-white/45 border-white/10 bg-white/[0.04]";
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${c}`}>{statusLabel(status)}</span>;
  }
  const c = score >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : score >= 50 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-red-400 border-red-500/30 bg-red-500/10";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${c}`}>{score}/100</span>;
}

function MiniScore({ score, label, color, status }) {
  const colors = { teal: "text-teal-400", amber: "text-amber-400", blue: "text-blue-400", rose: "text-rose-400", violet: "text-violet-400", orange: "text-orange-400", purple: "text-purple-400" };
  const value = Number.isFinite(score) ? `${score}%` : status === "error" ? "!" : "--";
  return (
    <div className="text-center">
      <p className={`text-lg font-black ${colors[color] || "text-white/70"}`}>{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/30">{label}</p>
    </div>
  );
}

export default function BulkCsvReporter() {
  const [urls, setUrls] = useState([]);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [expanded, setExpanded] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);
  const abortRef = useRef(false);

  const onFile = useCallback((e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => { setUrls(parseCSV(ev.target.result)); setResults([]); setCurrentIdx(-1); };
    reader.readAsText(file);
  }, []);

  const run = useCallback(async () => {
    if (!urls.length) return;
    abortRef.current = false; setRunning(true); setResults([]); setExpanded(null);
    const out = [];
    for (let i = 0; i < urls.length; i++) {
      if (abortRef.current) break;
      setCurrentIdx(i);
      try {
        const report = await runAllAudits(urls[i]);
        out.push({ status: "ok", ...report });
      } catch (err) {
        out.push({ status: "error", url: urls[i], error: err.message, overallScore: 0, categories: [] });
      }
      setResults([...out]);
    }
    setCurrentIdx(-1); setRunning(false);
  }, [urls]);

  const stop = () => { abortRef.current = true; };
  const reset = () => { setUrls([]); setResults([]); setFileName(""); setCurrentIdx(-1); if (fileRef.current) fileRef.current.value = ""; };

  const toggleCat = (ri, ci) => { const k = `${ri}-${ci}`; setExpandedCats(p => ({ ...p, [k]: !p[k] })); };

  const exportCSV = () => {
    const toolNames = BULK_REPORT_TOOL_DEFS.map((def) => def.label);
    const rows = [
      ["URL", "Overall Score", ...toolNames, "Status"],
      ...results.map((r) => {
        if (r.status === "error") return [r.url, 0, ...toolNames.map(() => ""), `Error: ${r.error}`];
        const categoryValues = toolNames.map((name) => {
          const category = r.categories.find((cat) => cat.name === name);
          return Number.isFinite(category?.score) ? category.score : statusLabel(category?.status);
        });
        return [r.url, r.overallScore, ...categoryValues, "OK"];
      }),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "seo-bulk-report.csv"; a.click();
  };

  const doneCount = results.length;
  const okCount = results.filter(r => r.status === "ok").length;
  const errCount = results.filter(r => r.status === "error").length;
  const avgScore = okCount ? Math.round(results.filter(r => r.status === "ok").reduce((s, r) => s + r.overallScore, 0) / okCount) : 0;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <ToolHeader title="Bulk CSV Reporter" Icon={FileSpreadsheet} gradient="from-slate-800 via-emerald-800 to-teal-700" subtitle={`Upload CSV and run ${BULK_REPORT_TOOL_DEFS.length} existing SEO tool checks per website`} />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 space-y-4">
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] px-4 py-3">
          <p className="text-xs text-white/55"><span className="font-bold text-teal-300">{BULK_REPORT_TOOL_DEFS.length} actual tool checks per site:</span> {BULK_REPORT_TOOL_DEFS.map((def) => def.label).join(" / ")}</p>
        </div>

        <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 transition hover:border-teal-500/30 hover:bg-teal-500/[0.03]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 transition group-hover:bg-teal-500/20">
            <Upload className="h-6 w-6 text-teal-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white/70">{fileName || "Click to upload CSV"}</p>
            <p className="mt-1 text-[11px] text-white/30">Supports .csv files with URLs in the first column</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
        </label>

        {urls.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-semibold text-white/70">{urls.length} website{urls.length !== 1 ? "s" : ""} found</span>
            </div>
            <div className="flex gap-2">
              {!running && results.length > 0 && (
                <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white/80 transition">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              )}
              {running ? (
                <button onClick={stop} className="flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/30 transition">
                  <XCircle className="h-3.5 w-3.5" /> Stop
                </button>
              ) : (
                <button onClick={run} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-teal-600/20 hover:shadow-teal-600/30 transition">
                  <Play className="h-4 w-4" /> {results.length > 0 ? "Re-run" : "Start Analysis"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      {(running || results.length > 0) && urls.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/60">Progress</span>
            <span className="text-white/40">{doneCount}/{urls.length}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500" style={{ width: `${(doneCount / urls.length) * 100}%` }} />
          </div>
          {running && currentIdx >= 0 && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
              <span>Running existing SEO tool checks on <span className="text-teal-300 font-mono">{urls[currentIdx]}</span></span>
            </div>
          )}
          <div className="grid grid-cols-4 gap-3 mt-2">
            {[
              { label: "Analyzed", value: doneCount, color: "text-white/70" },
              { label: "Completed", value: okCount, color: "text-emerald-400" },
              { label: "Failed", value: errCount, color: "text-red-400" },
              { label: "Avg Score", value: avgScore, color: "text-teal-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white/70">Reports</h2>
            {!running && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-md transition hover:shadow-violet-600/30">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
          </div>

          {results.map((r, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden transition hover:border-white/12">
              {/* Row header */}
              <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.02]">
                <span className="flex-shrink-0">
                  {r.status === "ok" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-white/80 truncate">{r.url}</span>
                  {r.status === "error" && <span className="block text-[11px] text-red-400/70 mt-0.5">{r.error}</span>}
                </span>
                {r.status === "ok" && <ScoreBadge score={r.overallScore} />}
                {expanded === i ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
              </button>

              {/* Expanded detail */}
              {expanded === i && r.status === "ok" && (
                <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                  {/* Category score overview */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {r.categories.map((cat, ci) => (
                      <MiniScore key={ci} score={cat.score} label={cat.name.replace(" Audit", "").replace(" Optimization", "").replace(" Analyzer", "")} color={CATEGORY_COLORS[cat.key] || "teal"} status={cat.status} />
                    ))}
                  </div>

                  {/* Category details */}
                  {r.categories.map((cat, ci) => {
                    const Icon = CATEGORY_ICONS[cat.key] || Search;
                    const isOpen = expandedCats[`${i}-${ci}`];
                    const color = CATEGORY_COLORS[cat.key] || "teal";
                    const colorClasses = {
                      teal: "bg-teal-500/10 text-teal-400", amber: "bg-amber-500/10 text-amber-400",
                      blue: "bg-blue-500/10 text-blue-400", rose: "bg-rose-500/10 text-rose-400",
                      violet: "bg-violet-500/10 text-violet-400", orange: "bg-orange-500/10 text-orange-400",
                      purple: "bg-purple-500/10 text-purple-400",
                    };
                    return (
                      <div key={ci} className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
                        <button onClick={() => toggleCat(i, ci)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.02]">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${colorClasses[color]}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="flex-1 text-xs font-bold text-white/80">{cat.name}</span>
                          <span className="text-[11px] text-white/40">{cat.status === "complete" ? `${cat.passed}/${cat.total} checks` : statusLabel(cat.status)}</span>
                          <ScoreBadge score={cat.score} status={cat.status} />
                          {isOpen ? <ChevronUp className="h-3 w-3 text-white/20" /> : <ChevronDown className="h-3 w-3 text-white/20" />}
                        </button>
                        {isOpen && (
                          <div className="border-t border-white/[0.04] divide-y divide-white/[0.03]">
                            {cat.checks.map((check, ki) => (
                              <div key={ki} className="flex items-center gap-2.5 px-4 py-2">
                                {check.status === "skipped"
                                  ? <MinusCircle className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
                                  : check.pass
                                    ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                                    : <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                                }
                                <span className="flex-1 text-[11px] text-white/60">{check.name}</span>
                                {check.detail && <span className="text-[10px] text-white/30 font-mono">{check.detail}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
