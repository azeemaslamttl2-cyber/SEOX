import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Search,
  Download,
  Globe,
  StopCircle,
  BarChart3,
  ArrowUpDown,
} from "lucide-react";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import {
  analyzeDuplicatePages,
  csvEscape,
  discoverInternalPages,
  downloadTextFile,
  fetchDuplicatePages,
  formatNumber,
  normalizeToolUrl,
} from "../../lib/techSeoTools.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const EMPTY_DUPLICATE_SUMMARY = {
  uniquePercent: 0,
  duplicatePercent: 0,
  commonPercent: 0,
  pagesScanned: 0,
  totalWords: 0,
  pagesWithDups: 0,
  cleanPages: 0,
  avgPageSizeKb: 0,
  avgWordsPerPage: 0,
};

const EMPTY_DUPLICATE_RESULT = {
  status: "idle",
  summary: EMPTY_DUPLICATE_SUMMARY,
  duplicatePages: [],
  skippedPages: [],
  discoveredUrls: [],
  maxPages: 0,
  error: "",
  scannedAt: "",
};

function DonutChart({ unique, duplicate, common, size = 140 }) {
  const total = Math.max(1, unique + duplicate + common);
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const seg1 = (unique / total) * circ;
  const seg2 = (common / total) * circ;
  const seg3 = (duplicate / total) * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#10b981" strokeWidth="14" strokeDasharray={`${seg1} ${circ - seg1}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray={`${seg2} ${circ - seg2}`} strokeDashoffset={-seg1} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f43f5e" strokeWidth="14" strokeDasharray={`${seg3} ${circ - seg3}`} strokeDashoffset={-(seg1 + seg2)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-black text-white">{unique}%</span>
        <span className="text-[10px] text-white/40">Unique</span>
      </div>
    </div>
  );
}

function CompArc({ value, percentile, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = parseInt(percentile, 10) || 50;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e5ee" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-black text-white">{value}</span>
    </div>
  );
}

function comparisonFromSummary(summary) {
  return [
    { metric: "Average Page Size", value: `${summary.avgPageSizeKb || 0}Kb`, percentile: summary.avgPageSizeKb <= 149 ? "70th" : "35th", desc: "Lower page size usually makes crawling and rendering easier." },
    { metric: "Words per Page", value: formatNumber(summary.avgWordsPerPage || 0), percentile: summary.avgWordsPerPage >= 872 ? "60th" : "35th", desc: "Thin pages are more likely to share duplicate boilerplate." },
    { metric: "Duplicate Content", value: `${summary.duplicatePercent}%`, percentile: summary.duplicatePercent <= 16 ? "80th" : "30th", desc: "Exact repeated sentences found across crawled pages." },
    { metric: "Common Content", value: `${summary.commonPercent}%`, percentile: summary.commonPercent <= 29 ? "70th" : "30th", desc: "Repeated common blocks such as templates, excerpts, or product copy." },
  ];
}

export default function DuplicateChecker() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result: savedResult, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "duplicate",
    project,
    projectUrl,
    emptyResult: EMPTY_DUPLICATE_RESULT,
  });
  const [maxPages, setMaxPages] = useState(50);
  const [tab, setTab] = useState("summary");
  const [summary, setSummary] = useState(EMPTY_DUPLICATE_SUMMARY);
  const [duplicatePages, setDuplicatePages] = useState([]);
  const [skippedPages, setSkippedPages] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, currentUrl: "" });
  const [error, setError] = useState("");

  const isWorking = phase === "discovering" || phase === "crawling" || phase === "analyzing";
  const comparison = useMemo(() => comparisonFromSummary(summary), [summary]);

  useEffect(() => {
    setSummary(EMPTY_DUPLICATE_SUMMARY);
    setDuplicatePages([]);
    setSkippedPages([]);
    setTab("summary");
    setPhase("idle");
    setProgress({ current: 0, total: 0, currentUrl: "" });
    setError("");
  }, [projectUrl]);

  useEffect(() => {
    if (savedResult.status === "idle") return;
    setSummary({ ...EMPTY_DUPLICATE_SUMMARY, ...(savedResult.summary || {}) });
    setDuplicatePages(Array.isArray(savedResult.duplicatePages) ? savedResult.duplicatePages : []);
    setSkippedPages(Array.isArray(savedResult.skippedPages) ? savedResult.skippedPages : []);
    setTab("summary");
    setPhase(savedResult.status === "completed" ? "done" : "idle");
    setError(savedResult.status === "failed" ? savedResult.error || "Could not scan duplicate content." : "");
  }, [savedResult]);

  async function runScan() {
    setError("");
    setPhase("discovering");
    let pagesToScan = [];
    let skipped = [];
    try {
      if (!hasProject) throw new Error("Select a website in the nav before running this audit.");
      const target = normalizeToolUrl(projectUrl);
      pagesToScan = await discoverInternalPages(target, Number(maxPages) || 20, setProgress);
      setPhase("crawling");
      const crawlResult = await fetchDuplicatePages(pagesToScan, setProgress);
      const { pages } = crawlResult;
      skipped = Array.isArray(crawlResult.skipped) ? crawlResult.skipped : [];
      setSkippedPages(skipped);
      if (pages.length < 2) {
        throw new Error("Need at least two crawlable pages to compare duplicate content.");
      }
      setPhase("analyzing");
      const analyzed = analyzeDuplicatePages(pages);
      setSummary(analyzed.summary);
      setDuplicatePages(analyzed.results);
      setTab("summary");
      await saveResult({
        status: "completed",
        summary: analyzed.summary,
        duplicatePages: analyzed.results,
        skippedPages: skipped,
        discoveredUrls: pagesToScan,
        maxPages: Number(maxPages) || 20,
        error: "",
        scannedAt: new Date().toISOString(),
      });
      setPhase("done");
    } catch (err) {
      const message = err?.message || "Could not scan duplicate content.";
      try {
        await saveResult({
          status: "failed",
          summary: EMPTY_DUPLICATE_SUMMARY,
          duplicatePages: [],
          skippedPages: skipped,
          discoveredUrls: pagesToScan,
          maxPages: Number(maxPages) || 20,
          error: message,
          scannedAt: new Date().toISOString(),
        });
      } catch (saveError) {
        setError(saveError?.message || message);
        setPhase("idle");
        return;
      }
      setError(message);
      setPhase("idle");
    }
  }

  function downloadReport() {
    const rows = [
      ["Duplicate Content Report", projectUrl],
      ["Pages scanned", summary.pagesScanned],
      ["Total words", summary.totalWords],
      ["Unique percent", summary.uniquePercent],
      ["Duplicate percent", summary.duplicatePercent],
      ["Common percent", summary.commonPercent],
      [],
      ["URL", "Title", "Match Words", "Match %", "Match Pages", "Words"],
      ...duplicatePages.map((row) => [row.url, row.title, row.matchWords, row.matchPercent, row.matchPages, row.wordCount || row.words]),
    ];
    downloadTextFile(
      `duplicate-content-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex justify-center">
        <div className="duplicate-hero-title rounded-full px-6 py-2.5 shadow-lg">
          <div className="flex items-center gap-2 text-white">
            <Copy className="h-5 w-5" />
            <span className="font-display text-lg font-bold">Content Duplicate Checker</span>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-white/40">
        Crawl your site and detect repeated sentences, paragraphs, and common text blocks across internal pages.
      </p>

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
            <Globe className="h-4 w-4 text-violet-400/60" />
            <input value={displayUrl} readOnly onKeyDown={(e) => e.key === "Enter" && runScan()} className="flex-1 cursor-not-allowed bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none" placeholder="Select a website in the nav" />
          </div>
          <label className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2">
            <span className="text-[11px] text-white/40">Max Pages:</span>
            <input type="number" min="2" max="100" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} className="w-16 bg-transparent text-sm font-bold text-white/70 focus:outline-none" />
          </label>
          <button onClick={runScan} disabled={isWorking || !hasProject} className="duplicate-primary-button flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-60">
            <Search className={`h-4 w-4 ${isWorking ? "animate-pulse" : ""}`} /> {isWorking ? "Scanning..." : "Scan Site"}
          </button>
        </div>
        {isWorking && (
          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-violet-200">
              <span className="capitalize">{phase} {progress.total ? `${progress.current}/${progress.total}` : ""}</span>
              <StopCircle className="h-3.5 w-3.5 text-violet-300" />
            </div>
            <p className="mt-1 truncate text-[11px] text-white/35">{progress.currentUrl || "Preparing crawl..."}</p>
          </div>
        )}
        {(error || persistenceError) && <p className="mt-3 text-xs font-semibold text-rose-300">{error || persistenceError}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>Summary</TabButton>
          <TabButton active={tab === "duplicate"} onClick={() => setTab("duplicate")}>Duplicate Content ({summary.pagesWithDups})</TabButton>
          <TabButton active={tab === "skipped"} onClick={() => setTab("skipped")}>Skipped Pages ({skippedPages.length})</TabButton>
        </div>
        <button onClick={downloadReport} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/[0.06]">
          <Download className="h-3.5 w-3.5" /> Download Report
        </button>
      </div>

      {tab === "summary" && (
        <>
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-400" />
              <span className="font-display text-base font-bold">Your Duplicate Content</span>
            </div>
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
              <DonutChart unique={summary.uniquePercent} duplicate={summary.duplicatePercent} common={summary.commonPercent} />
              <div className="flex flex-col gap-2">
                <LegendItem color="bg-rose-500" label="Duplicate Content" value={`${summary.duplicatePercent}%`} />
                <LegendItem color="bg-amber-500" label="Common Content" value={`${summary.commonPercent}%`} />
                <LegendItem color="bg-emerald-500" label="Unique Content" value={`${summary.uniquePercent}%`} />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
                <StatBox value={summary.pagesScanned} label="Pages Scanned" color="text-emerald-400" />
                <StatBox value={formatNumber(summary.totalWords)} label="Total Words" color="text-violet-400" />
                <StatBox value={summary.pagesWithDups} label="Pages with Dups" color="text-rose-400" />
                <StatBox value={summary.cleanPages} label="Clean Pages" color="text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h3 className="font-display text-base font-bold">Comparison Benchmarks</h3>
            <p className="mt-1 text-xs text-white/35">These indicators compare your crawl against practical duplicate-content benchmarks.</p>
            <div className="mt-5 space-y-4">
              {comparison.map((item, i) => (
                <div key={i} className="flex items-center gap-5 rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                  <CompArc value={item.value} percentile={item.percentile} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white/85">{item.metric}</div>
                    <div className="mt-0.5 text-[11px] text-white/35">{item.desc}</div>
                    <span className="mt-1 inline-block rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">{item.percentile} percentile</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "duplicate" && (
        <div className="mt-5">
          <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2.5">
            <span className="text-xs text-violet-300">Duplicate rows are sorted by the highest repeated text percentage.</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_0.8fr] gap-2 border-b border-white/[0.06] px-5 py-3">
              <TableHead label="URL" />
              <TableHead label="Title" />
              <TableHead label="Match Words" />
              <TableHead label="Match %" />
              <TableHead label="Match Pages" />
              <TableHead label="Words" />
            </div>
            {duplicatePages.map((row, i) => (
              <div key={`${row.url}-${i}`} className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_0.8fr] gap-2 px-5 py-3 transition hover:bg-white/[0.02] ${i < duplicatePages.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <span className="truncate text-xs text-violet-300">{row.url}</span>
                <span className="truncate text-xs text-white/60">{row.title}</span>
                <span className="text-xs font-bold text-white/70">{formatNumber(row.matchWords)}</span>
                <div className="flex items-center gap-2">
                  <MatchBar percent={row.matchPercent} />
                  <span className="text-xs font-bold text-white/70">{row.matchPercent}%</span>
                </div>
                <span className="text-xs text-white/50">{row.matchPages}</span>
                <span className="text-xs text-white/50">{formatNumber(row.wordCount || row.words || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "skipped" && (
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          {skippedPages.length ? skippedPages.map((page, i) => (
            <div key={`${page.url}-${i}`} className="flex items-center justify-between border-b border-white/[0.04] py-2 last:border-b-0">
              <span className="truncate text-xs text-white/60">{page.url}</span>
              <span className="text-xs text-amber-300">{page.reason}</span>
            </div>
          )) : <p className="py-10 text-center text-sm text-white/30">No pages were skipped during the latest scan.</p>}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`duplicate-tab rounded-xl border px-4 py-2 text-sm font-bold transition ${active ? "duplicate-tab-active" : "duplicate-tab-inactive"}`}>
      {children}
    </button>
  );
}

function LegendItem({ color, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${color}`} />
      <span className="text-xs text-white/60">{label}:</span>
      <span className="text-xs font-bold text-white/80">{value}</span>
    </div>
  );
}

function StatBox({ value, label, color }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
      <div className={`font-display text-xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-white/35">{label}</div>
    </div>
  );
}

function TableHead({ label }) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
      {label} <ArrowUpDown className="h-2.5 w-2.5" />
    </div>
  );
}

function MatchBar({ percent }) {
  let color = "bg-emerald-400";
  if (percent > 70) color = "bg-rose-500";
  else if (percent > 40) color = "bg-amber-500";
  return (
    <div className="h-2 w-12 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}
