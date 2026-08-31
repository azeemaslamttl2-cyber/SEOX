import { useState } from "react";
import {
  RefreshCw,
  Download,
  Trash2,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ExternalLink,
  Upload,
  X,
} from "lucide-react";
import { classifyIssues, computeStats, normalizeRows } from "../../lib/backlinkCleaner.js";

function downloadRows(filename, rows) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  };
  const csv = [
    ["Domain", "URL", "DR", "Category", "Title", "Status", "Issues"],
    ...rows.map((row) => [row.domain, row.url, row.dr, row.category, row.title, row.status, row.issues]),
  ].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

export default function BacklinkCleaner() {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [viewMode, setViewMode] = useState("domain");
  const [rows, setRows] = useState([]);
  const [fileId, setFileId] = useState("No backlink file loaded");
  const stats = computeStats(rows);

  const filtered = rows.filter(
    (row) =>
      `${row.domain} ${row.url} ${row.title}`.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (category === "All Categories" || row.issues === category)
  );

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = normalizeRows(text);
    setRows(parsed);
    setFileId(`${file.name} - ${parsed.length} rows`);
    event.target.value = "";
  }

  async function handlePaste() {
    const text = await navigator.clipboard.readText();
    const parsed = normalizeRows(text);
    setRows(parsed);
    setFileId(`Clipboard import - ${parsed.length} rows`);
  }

  function clearRows() {
    setRows([]);
    setFileId("No backlink file loaded");
    setSearchTerm("");
    setCategory("All Categories");
  }

  function analyzeRows() {
    setRows((current) => current.map((row) => ({ ...row, issues: classifyIssues({ ...row, issues: "Unknown" }) })));
  }

  function excludeRow(rowId) {
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/[0.07] blur-[80px]" />
          <div className="absolute -bottom-10 right-1/4 h-48 w-48 rounded-full bg-teal-500/[0.05] blur-[60px]" />
        </div>
        <div className="relative z-10 flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
              <RefreshCw className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">Backlink Cleaner</h1>
              <p className="text-xs text-white/40">Upload competitor backlinks CSV · Advanced Analysis · AI Categorization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearRows}
              disabled={!rows.length}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              onClick={() => downloadRows("clean-backlinks.csv", rows.filter((row) => row.issues === "Clean"))}
              disabled={!stats.clean}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Export Clean ({stats.clean})
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stats Strip ─── */}
      <div className="mt-4 grid grid-cols-6 gap-2">
        <StatCard value={stats.totalLinks} label="Total Links" borderColor="border-white/[0.08]" textColor="text-white/80" />
        <StatCard value={stats.clean} label="Clean" borderColor="border-emerald-500/30" textColor="text-emerald-400" />
        <StatCard value={stats.flagged} label="Flagged" borderColor="border-rose-500/30" textColor="text-rose-400" />
        <StatCard value={stats.avgDR} label="Avg DR" borderColor="border-violet-500/30" textColor="text-violet-400" />
        <StatCard value={stats.scanned} label="Scanned" borderColor="border-blue-500/30" textColor="text-blue-400" />
        <StatCard value={stats.excluded} label="Excluded" borderColor="border-white/[0.06]" textColor="text-white/40" />
      </div>

      {/* ─── File + Actions ─── */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/30" />
          <span className="font-mono text-xs text-white/50">{fileId}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.07]">
            <Upload className="h-3.5 w-3.5" /> Upload CSV
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={handlePaste}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.07]"
          >
            <FileText className="h-3.5 w-3.5" /> Paste
          </button>
          <button
            onClick={analyzeRows}
            disabled={!rows.length}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="h-3.5 w-3.5" /> Extract Title/Meta/Status
          </button>
          <button
            onClick={analyzeRows}
            disabled={!rows.length}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
          </button>
        </div>
      </div>

      {/* ─── Filters Bar ─── */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2">
          <Search className="h-4 w-4 text-white/30" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/25 focus:outline-none"
            placeholder="Search domains, titles..."
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2">
          <span className="text-xs text-white/35">Category:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-transparent text-xs text-white/70 focus:outline-none"
          >
            <option value="All Categories">All Categories</option>
            <option value="Clean">Clean</option>
            <option value="Spammy TLD">Spammy TLD</option>
            <option value="Adult/Gambling">Adult/Gambling</option>
            <option value="Low Authority">Low Authority</option>
            <option value="HTTP Error">HTTP Error</option>
          </select>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-ink-900/80 p-0.5">
          <button
            onClick={() => setViewMode("domain")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${viewMode === "domain" ? "bg-emerald-500 text-white" : "text-white/40 hover:text-white/60"}`}
          >
            Domain
          </button>
          <button
            onClick={() => setViewMode("url")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${viewMode === "url" ? "bg-emerald-500 text-white" : "text-white/40 hover:text-white/60"}`}
          >
            Full URL
          </button>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="grid grid-cols-[0.4fr_2fr_0.6fr_0.8fr_0.8fr_0.8fr_0.8fr_0.5fr] gap-2 border-b border-white/[0.06] px-5 py-3">
          <TH label="Status" />
          <TH label="Domain" />
          <TH label="DR" />
          <TH label="Category" />
          <TH label="Title" />
          <TH label="Status" />
          <TH label="Issues" />
          <TH label="Exclude" />
        </div>

        {filtered.length ? filtered.map((row, i) => {
          const isClean = row.issues === "Clean";
          return (
            <div
              key={i}
              className={`grid grid-cols-[0.4fr_2fr_0.6fr_0.8fr_0.8fr_0.8fr_0.8fr_0.5fr] gap-2 px-5 py-3 transition hover:bg-white/[0.02] ${
                i < filtered.length - 1 ? "border-b border-white/[0.03]" : ""
              }`}
            >
              <div className="flex items-center">
                {isClean ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm text-blue-300 truncate hover:underline cursor-pointer">{viewMode === "url" ? row.url || row.domain : row.domain}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 text-white/20" />
              </div>
              <div className="flex items-center">
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  row.dr >= 70 ? "bg-emerald-500/20 text-emerald-300" : row.dr >= 40 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"
                }`}>{row.dr}</span>
              </div>
              <div className="flex items-center text-xs text-white/40">{row.category}</div>
              <div className="flex items-center text-xs text-white/40">{row.title}</div>
              <div className="flex items-center text-xs text-white/40">{row.status}</div>
              <div className="flex items-center">
                {isClean ? (
                  <span className="text-xs text-emerald-400">Clean</span>
                ) : (
                  <span className="text-xs text-amber-400">{row.issues}</span>
                )}
              </div>
              <div className="flex items-center justify-center">
                <button
                  onClick={() => excludeRow(row.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/20 hover:bg-white/[0.06] hover:text-white/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="px-5 py-14 text-center">
            <FileText className="mx-auto h-8 w-8 text-white/[0.06]" />
            <p className="mt-3 text-sm text-white/25">
              {rows.length ? "No backlinks match the current filters." : "Upload or paste a backlinks CSV to start cleaning."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label, borderColor, textColor }) {
  return (
    <div className={`rounded-xl border ${borderColor} bg-white/[0.02] py-3 text-center`}>
      <div className={`font-display text-2xl font-black ${textColor}`}>{value}</div>
      <div className="text-[10px] text-white/35">{label}</div>
    </div>
  );
}

function TH({ label }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</span>
  );
}
