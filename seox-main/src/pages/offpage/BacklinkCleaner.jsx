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

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function getCell(row, headers, names) {
  const lowered = names.map((name) => name.toLowerCase());
  const index = headers.findIndex((header) => lowered.includes(header.toLowerCase()));
  return index >= 0 ? row[index] : "";
}

function domainFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./i, "").toLowerCase();
  }
}

function classifyIssues(row) {
  if (row.issues && row.issues !== "Unknown") return row.issues;
  const haystack = `${row.domain} ${row.url} ${row.title} ${row.category}`.toLowerCase();
  const tld = row.domain.split(".").pop();
  if (["xyz", "top", "click", "link", "quest", "rest"].includes(tld)) return "Spammy TLD";
  if (/\b(casino|gambling|betting|poker|adult|porn|escort)\b/.test(haystack)) return "Adult/Gambling";
  if (row.dr > 0 && row.dr < 20) return "Low Authority";
  if (row.status && !/^2\d\d$|^live$/i.test(String(row.status))) return "HTTP Error";
  return "Clean";
}

function normalizeRows(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const first = parseCsvLine(lines[0]);
  const looksHeader = first.some((cell) => /domain|url|title|dr|authority|status|issue|category/i.test(cell));
  const headers = looksHeader ? first.map((cell) => cell.trim()) : [];
  const dataLines = looksHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const cells = parseCsvLine(line);
    const url = getCell(cells, headers, ["url", "backlink", "source url", "referring page"]) || cells[0] || "";
    const domain = domainFromValue(getCell(cells, headers, ["domain", "referring domain"]) || url);
    const drValue = getCell(cells, headers, ["dr", "domain rating", "da", "authority"]) || cells[2] || "";
    const row = {
      id: `${domain || "row"}-${index}`,
      domain: domain || "unknown-domain",
      url,
      dr: Number.parseInt(String(drValue).replace(/[^\d]/g, ""), 10) || 0,
      category: getCell(cells, headers, ["category", "type", "niche"]) || "Uncategorized",
      title: getCell(cells, headers, ["title", "page title", "anchor"]) || "Not extracted",
      status: getCell(cells, headers, ["status", "http status"]) || "Unknown",
      issues: getCell(cells, headers, ["issues", "issue", "risk"]) || "Unknown",
    };
    return { ...row, issues: classifyIssues(row) };
  }).filter((row) => row.domain && row.domain !== "unknown-domain");
}

function computeStats(rows) {
  const clean = rows.filter((row) => row.issues === "Clean").length;
  const flagged = rows.length - clean;
  const avgDr = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.dr, 0) / rows.length) : 0;
  return {
    totalLinks: rows.length,
    clean,
    flagged,
    avgDR: avgDr,
    scanned: rows.length,
    excluded: 0,
  };
}

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
