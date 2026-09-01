import { useMemo, useState } from "react";
import {
  Link2,
  Download,
  Upload,
  Filter,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { downloadTextFile, formatNumber } from "../../lib/techSeoTools.js";

const ADULT_GAMBLING_KEYWORDS = ["casino", "poker", "gambling", "bet", "slots", "adult", "xxx", "porn", "sex", "escort", "dating", "lottery", "betting", "blackjack", "roulette"];
const SPAMMY_TLDS = [".xyz", ".info", ".online", ".site", ".top", ".club", ".work", ".click", ".link", ".space", ".pro", ".icu", ".buzz", ".monster", ".bond", ".homes", ".shop", ".store", ".live", ".life", ".fun", ".biz"];
const FOREIGN_TLD_LANGUAGES = {
  ".ru": "Russian",
  ".cn": "Chinese",
  ".jp": "Japanese",
  ".kr": "Korean",
  ".br": "Portuguese",
  ".de": "German",
  ".fr": "French",
  ".it": "Italian",
  ".es": "Spanish",
  ".pl": "Polish",
  ".tr": "Turkish",
  ".in": "Indian",
  ".pk": "Pakistani",
  ".ir": "Persian",
};

const DEFAULT_CHECKS = {
  foreign: true,
  spammy_tld: true,
  adult_gambling: true,
  low_quality: true,
  irrelevant: true,
};

function parseCSVLine(line, delimiter = ",") {
  if (delimiter === "\t") return line.split("\t").map((value) => value.trim().replace(/^["']|["']$/g, ""));
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function extractDomainFromUrl(value) {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return String(value || "").replace(/^(https?:\/\/)?(www\.)?/i, "").split(/[/?#]/)[0];
  }
}

function extractTld(domain) {
  const parts = String(domain || "").split(".").filter(Boolean);
  if (parts.length < 2) return "";
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if (["co", "com", "org", "net", "edu", "gov"].includes(secondLast) && parts.length > 2) return `.${secondLast}.${last}`;
  return `.${last}`;
}

function parseBacklinkText(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { results: [], format: "domain" };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseCSVLine(lines[0], delimiter).map((header) => header.trim().replace(/['"]/g, "").toLowerCase());
  const domainIndex = headers.findIndex((header) => header === "domain" || header.includes("referring domain"));
  const sourceUrlIndex = headers.findIndex((header) => header === "source url" || header === "source_url" || header === "source page title and url");
  const urlIndex = headers.findIndex((header) => (header.includes("url") || header.includes("link") || header.includes("backlink")) && header !== "target url");
  const scoreIndex = headers.findIndex((header) => header === "dr" || header.includes("ascore") || header.includes("da") || header.includes("domain rating") || header.includes("domain authority") || header.includes("authority score"));
  const countryIndex = headers.findIndex((header) => header.includes("country"));
  const linksIndex = headers.findIndex((header) => header === "backlinks" || header.includes("links to target") || header.includes("ref domains") || header === "ext. links" || header === "external links");
  const trafficIndex = headers.findIndex((header) => header === "traffic");
  const format = sourceUrlIndex !== -1 ? "url" : "domain";

  const results = [];
  const seen = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCSVLine(lines[i], delimiter);
    const sourceUrl = sourceUrlIndex !== -1 ? values[sourceUrlIndex]?.trim().replace(/['"]/g, "") : "";
    const rawDomain = domainIndex !== -1 ? values[domainIndex]?.trim().replace(/['"]/g, "") : "";
    const rawUrl = sourceUrl || (urlIndex !== -1 ? values[urlIndex]?.trim().replace(/['"]/g, "") : "");
    const domain = rawDomain || extractDomainFromUrl(rawUrl);
    if (!domain || domain.length < 3 || seen.has(`${domain}-${rawUrl}`)) continue;
    seen.add(`${domain}-${rawUrl}`);
    results.push({
      id: i,
      domain,
      url: rawUrl || `https://${domain}`,
      sourceUrl: sourceUrl || "",
      tld: extractTld(domain),
      dr: scoreIndex !== -1 ? parseInt(String(values[scoreIndex] || "").replace(/[^\d]/g, ""), 10) || 0 : 0,
      country: countryIndex !== -1 ? String(values[countryIndex] || "").trim().toUpperCase() : "",
      backlinks: linksIndex !== -1 ? parseInt(String(values[linksIndex] || "").replace(/[^\d]/g, ""), 10) || 0 : 0,
      traffic: trafficIndex !== -1 ? parseInt(String(values[trafficIndex] || "").replace(/[^\d]/g, ""), 10) || 0 : 0,
    });
  }
  return { results, format };
}

function analyzeBacklink(link, keywords, checks = DEFAULT_CHECKS) {
  const flags = [];
  const domain = link.domain.toLowerCase();
  const tld = link.tld.toLowerCase();

  if (checks.foreign) {
    const matchedTld = Object.keys(FOREIGN_TLD_LANGUAGES).find((item) => tld === item || tld.endsWith(item));
    if (matchedTld) flags.push({ type: "foreign", severity: "high", message: `Foreign (${FOREIGN_TLD_LANGUAGES[matchedTld]})` });
  }
  if (checks.spammy_tld && SPAMMY_TLDS.some((item) => tld === item || tld.endsWith(item))) {
    flags.push({ type: "spammy_tld", severity: "critical", message: `Spammy TLD (${tld})` });
  }
  if (checks.adult_gambling && ADULT_GAMBLING_KEYWORDS.some((keyword) => domain.includes(keyword))) {
    flags.push({ type: "adult_gambling", severity: "medium", message: "Adult/gambling content" });
  }
  if (checks.low_quality && link.dr <= 5) {
    flags.push({ type: "low_quality", severity: "info", message: `Low quality (AS/DR: ${link.dr})` });
  }
  if (checks.irrelevant && keywords.length > 0) {
    const relevant = keywords.some((keyword) => domain.includes(keyword));
    if (!relevant) flags.push({ type: "irrelevant", severity: "low", message: "Irrelevant niche" });
  }
  return { ...link, flags };
}

function seedRows(data) {
  return data.domains.map((row, index) => analyzeBacklink({
    id: index + 1,
    domain: row.domain,
    url: `https://${row.domain}`,
    sourceUrl: "",
    tld: row.tld,
    dr: row.as,
    country: row.country === "—" ? "" : row.country,
    backlinks: row.links,
    traffic: 0,
  }, data.nicheKeywords.toLowerCase().split(",").map((item) => item.trim()).filter(Boolean)));
}

export default function BacklinksAudit() {
  const { displayUrl } = useSelectedProjectDomain();
  const [backlinks, setBacklinks] = useState([]);
  const [fileName, setFileName] = useState("No file loaded");
  const [filter, setFilter] = useState("all");
  const [csvFormat, setCsvFormat] = useState("domain");
  const [nicheKeywords, setNicheKeywords] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [enabledChecks, setEnabledChecks] = useState(DEFAULT_CHECKS);

  const keywords = useMemo(() => nicheKeywords.toLowerCase().split(",").map((item) => item.trim()).filter(Boolean), [nicheKeywords]);
  const analyzedBacklinks = useMemo(() => backlinks.map((link) => analyzeBacklink(link, keywords, enabledChecks)), [backlinks, keywords, enabledChecks]);
  const visibleBacklinks = analyzedBacklinks.filter((link) => {
    if (filter === "all") return true;
    if (filter === "clean") return link.flags.length === 0;
    return link.flags.some((flag) => flag.type === filter || flag.severity === filter);
  });
  const stats = useMemo(() => ({
    total: analyzedBacklinks.length,
    spammy: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "spammy_tld")).length,
    foreign: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "foreign")).length,
    adult: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "adult_gambling")).length,
    irrelevant: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "irrelevant")).length,
    low: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "low_quality")).length,
    clean: analyzedBacklinks.filter((link) => link.flags.length === 0).length,
  }), [analyzedBacklinks]);

  function loadText(text, nextName = "Pasted CSV") {
    const parsed = parseBacklinkText(text);
    setCsvFormat(parsed.format);
    setBacklinks(parsed.results);
    setFileName(nextName);
  }

  function handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => loadText(event.target.result, file.name);
    reader.readAsText(file);
  }

  function exportDisavow() {
    const flagged = analyzedBacklinks.filter((link) => link.flags.length > 0);
    const lines = flagged.map((link) => {
      if (csvFormat === "url" && link.sourceUrl) return link.sourceUrl;
      return `domain:${link.domain}`;
    });
    const content = [
      "# Google Disavow File",
      "# Generated by AI Smart Seo Backlinks Audit",
      `# Flagged links: ${flagged.length}`,
      `# Date: ${new Date().toISOString().split("T")[0]}`,
      "",
      ...lines,
    ].join("\n");
    downloadTextFile("disavow.txt", content);
  }

  function clearAll() {
    setBacklinks([]);
    setPasteInput("");
    setFileName("No file loaded");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 ring-1 ring-rose-500/30">
            <Link2 className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-white">Backlinks Audit</h1>
            <p className="text-xs text-white/40">Upload Semrush, Ahrefs, or simple backlink CSV/TSV files and generate disavow candidates.</p>
          </div>
        </div>
        <button onClick={exportDisavow} className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-rose-400">
          <Download className="h-3.5 w-3.5" /> Export Disavow (.txt)
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2">
        <StatPill value={formatNumber(stats.total)} label="Total Links" color="text-blue-400" />
        <StatPill value={stats.spammy} label="Spammy TLDs" color="text-amber-400" />
        <StatPill value={stats.foreign} label="Foreign Lang." color="text-rose-400" />
        <StatPill value={stats.adult} label="Adult/Gambling" color="text-violet-400" />
        <StatPill value={stats.irrelevant} label="Irrelevant" color="text-white/50" />
        <StatPill value={stats.low} label="Low Quality" color="text-orange-400" />
        <StatPill value={stats.clean} label="Clean" color="text-emerald-400" />
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-[10px] font-bold text-white">
            <Upload className="h-3 w-3" /> Upload CSV/TSV
            <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0])} />
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5">
            <span className="text-[10px] text-white/35">File:</span>
            <span className="max-w-[260px] truncate text-[11px] text-white/60">{fileName}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5">
            <span className="text-[10px] text-white/35">Target:</span>
            <span className="max-w-[260px] truncate text-[11px] text-white/60">{displayUrl}</span>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">{csvFormat.toUpperCase()} Format</span>
          <FilterSelect value={filter} onChange={setFilter} />
          <button onClick={clearAll} className="flex items-center gap-1 text-[10px] text-rose-300 hover:underline">
            <RefreshCw className="h-3 w-3" /> Clear All
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div>
            <label className="text-[11px] text-white/40">Update niche keywords (comma-separated)</label>
            <input
              value={nicheKeywords}
              onChange={(e) => setNicheKeywords(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none"
              placeholder="SEO, marketing, web design"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40">Paste CSV/TSV export</label>
            <div className="mt-1 flex gap-2">
              <textarea value={pasteInput} onChange={(e) => setPasteInput(e.target.value)} rows={2} className="flex-1 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none" placeholder="Domain,DR,Backlinks,Country..." />
              <button onClick={() => loadText(pasteInput)} className="rounded-lg bg-brand-500 px-3 text-xs font-bold text-white">Analyze</button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(enabledChecks).map(([key, value]) => (
            <label key={key} className="flex items-center gap-1.5 text-[10px] text-white/45">
              <input type="checkbox" checked={value} onChange={(e) => setEnabledChecks((prev) => ({ ...prev, [key]: e.target.checked }))} className="h-3 w-3 accent-brand-500" />
              {key.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Filter className="h-4 w-4 text-white/30" />
        <span className="text-sm font-bold text-white/70">Audit Checks</span>
        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">{visibleBacklinks.length} shown</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="grid grid-cols-[2fr_0.5fr_0.6fr_0.5fr_1.1fr_0.6fr] gap-3 border-b border-white/[0.06] px-5 py-3">
          <TableHead label="Domain" />
          <TableHead label="AS/DR" />
          <TableHead label="Country" />
          <TableHead label="Links" />
          <TableHead label="Issues" />
          <TableHead label="Actions" align="right" />
        </div>
        {visibleBacklinks.length ? visibleBacklinks.map((row, i) => (
          <div key={`${row.domain}-${i}`} className={`grid grid-cols-[2fr_0.5fr_0.6fr_0.5fr_1.1fr_0.6fr] gap-3 px-5 py-3 transition hover:bg-white/[0.02] ${i < visibleBacklinks.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-white/40">{row.domain.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/85">{row.domain}</div>
                  <div className="truncate text-[10px] text-white/30">{row.tld} {row.traffic ? `- ${formatNumber(row.traffic)} traffic` : ""}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center text-sm font-bold text-white/80">{row.dr}</div>
            <div className="flex items-center text-xs text-white/50">{row.country || "-"}</div>
            <div className="flex items-center text-xs text-white/70">{formatNumber(row.backlinks)}</div>
            <div className="flex flex-wrap items-center gap-1">
              {row.flags.length === 0 ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Clean</span>
              ) : row.flags.slice(0, 3).map((flag) => (
                <span key={`${flag.type}-${flag.message}`} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${flag.severity === "critical" ? "bg-rose-500/20 text-rose-300" : flag.severity === "high" ? "bg-orange-500/20 text-orange-300" : "bg-amber-500/15 text-amber-300"}`}>
                  {flag.message}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-end">
              <a href={row.sourceUrl || row.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/50 hover:bg-white/[0.06]">
                <ExternalLink className="h-3 w-3" /> Visit
              </a>
            </div>
          </div>
        )) : (
          <div className="px-5 py-10 text-center text-sm text-white/30">Upload or paste a backlink export to begin.</div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5">
      <Filter className="h-3 w-3 text-white/30" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-[11px] text-white/60 focus:outline-none">
        <option value="all">All Backlinks</option>
        <option value="clean">Clean</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="spammy_tld">Spammy TLD</option>
        <option value="foreign">Foreign</option>
        <option value="adult_gambling">Adult/Gambling</option>
        <option value="low_quality">Low Quality</option>
        <option value="irrelevant">Irrelevant</option>
      </select>
      <ChevronDown className="h-3 w-3 text-white/30" />
    </div>
  );
}

function StatPill({ value, label, color }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-center">
      <div className={`font-display text-xl font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-white/35">{label}</div>
    </div>
  );
}

function TableHead({ label, align = "left" }) {
  return <span className={`text-[10px] font-bold uppercase tracking-wider text-white/30 ${align === "right" ? "text-right" : ""}`}>{label}</span>;
}
