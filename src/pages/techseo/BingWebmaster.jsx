import { useEffect, useState } from "react";
import {
  BarChart3,
  Key,
  HelpCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";
import { csvEscape, downloadTextFile, formatNumber } from "../../lib/techSeoTools.js";
import { getSessionToken } from "../../lib/authSession.js";

const API_KEY_STEPS = [
  "Go to Bing Webmaster Tools",
  "Click on Settings (gear icon) in the sidebar",
  'Select "API Access" and click "Generate" to create your API key',
  "Copy the key and paste it above",
];

const BING_KEY_STORAGE = "bing_webmaster_api_key";
const EMPTY_BING_RESULT = {
  metrics: { clicks: "0", impressions: "0", ctr: "0.00%", position: "0.00" },
  topQueries: [],
  topPages: [],
};

function normalizeBingSite(site) {
  if (!site) return "";
  if (typeof site === "string") return site;
  return (
    site.Url ||
    site.url ||
    site.SiteUrl ||
    site.siteUrl ||
    normalizeBingSite(site.site) ||
    normalizeBingSite(site.Site) ||
    ""
  );
}

function bingSitesFromPayload(payload) {
  const value = payload?.d ?? payload?.sites ?? payload?.results ?? [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.sites)) return value.sites;
  return [];
}

function hostFromSite(siteUrl) {
  try {
    const value = String(siteUrl || "").trim();
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(siteUrl || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function canonicalBingSiteUrl(siteUrl) {
  const value = String(siteUrl || "").trim();
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.replace(/\/+$/, "").toLowerCase();
  }
}

function isValidBingApiKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.length < 20) return false;
  if (/\s/.test(trimmed)) return false;
  if (/abc123/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

function findMatchingBingSite(sites, projectUrl, projectDomain) {
  const domain = hostFromSite(projectDomain || projectUrl);
  if (!domain) return "";
  const origin = projectUrl ? canonicalBingSiteUrl(projectUrl) : "";
  const match = sites.find((site) => {
    const siteUrl = normalizeBingSite(site);
    return hostFromSite(siteUrl) === domain || canonicalBingSiteUrl(siteUrl) === origin;
  });
  return normalizeBingSite(match) || "";
}

function aggregateRows(rows, keyName) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[keyName] || row[keyName.toLowerCase()] || row.Query || row.query || row.Url || row.url || "";
    if (!key) return;
    const existing = map.get(key) || { key, clicks: 0, impressions: 0 };
    existing.clicks += row.Clicks || row.clicks || 0;
    existing.impressions += row.Impressions || row.impressions || 0;
    map.set(key, existing);
  });
  return Array.from(map.values()).map((row) => ({
    ...row,
    ctr: row.impressions ? (row.clicks / row.impressions) * 100 : 0,
  }));
}

function keywordsForPage(pageUrl, queries) {
  try {
    const words = new URL(pageUrl).pathname.toLowerCase().split(/[-_/]/).filter((word) => word.length > 2);
    const matched = queries.filter((query) => words.some((word) => query.key.toLowerCase().includes(word))).slice(0, 5).map((query) => query.key);
    return matched.length ? matched : queries.slice(0, 3).map((query) => query.key);
  } catch {
    return queries.slice(0, 3).map((query) => query.key);
  }
}

function buildBingData(selectedSite, rawQueries, rawPages) {
  const queries = aggregateRows(rawQueries, "Query").sort((a, b) => b.clicks - a.clicks);
  const pages = aggregateRows(rawPages, "Url").sort((a, b) => b.clicks - a.clicks);
  const totals = queries.reduce((acc, row) => {
    acc.clicks += row.clicks;
    acc.impressions += row.impressions;
    return acc;
  }, { clicks: 0, impressions: 0 });
  totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;

  const withKeywords = (items) => items.map((page) => ({ ...page, topQueries: keywordsForPage(page.key, queries) }));
  return {
    selectedSite,
    totals,
    topQueries: queries,
    topPages: withKeywords(pages.slice(0, 10)),
    highPotentialPages: withKeywords(pages.filter((page) => page.impressions >= 100 && page.ctr < 2).sort((a, b) => b.impressions - a.impressions)),
    penalizedPages: withKeywords(pages.filter((page) => page.impressions >= 50 && page.clicks >= 1 && page.ctr < 1 && page.ctr > 0).sort((a, b) => b.impressions - a.impressions)),
    deadPages: withKeywords(pages.filter((page) => page.impressions >= 10 && page.clicks === 0).sort((a, b) => b.impressions - a.impressions)),
    rankedPages: withKeywords(pages.filter((page) => page.clicks >= 5).sort((a, b) => b.clicks - a.clicks)),
  };
}

export default function BingWebmaster() {
  const authContext = useAuth();
  const { projectUrl, projectDomain, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result: savedBingResult, saveResult: saveBingResult, persistenceError } = useTechSeoToolResult({
    toolKey: "bing",
    project: authContext?.project || null,
    projectUrl,
    emptyResult: EMPTY_BING_RESULT,
  });
  const [apiKey, setApiKey] = useState(() => {
    try {
      const envKey =
        (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BING_WEBMASTER_API_KEY) ||
        (typeof process !== "undefined" && process.env && process.env.VITE_BING_WEBMASTER_API_KEY) ||
        "";
      return sessionStorage.getItem(BING_KEY_STORAGE) || envKey || "";
    } catch {
      return (typeof process !== "undefined" && process.env && process.env.VITE_BING_WEBMASTER_API_KEY) || "";
    }
  });
  const [showKey, setShowKey] = useState(false);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState({ queries: true, pages: true, high: false, penalized: false, dead: false, ranked: false });

  useEffect(() => {
    setSelectedSite("");
    setPerformanceData(null);
    setError("");
  }, [projectUrl]);

  // Load saved Bing result when available
  useEffect(() => {
    if (savedBingResult && savedBingResult.totals) {
      setPerformanceData(savedBingResult);
    }
  }, [savedBingResult]);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function bingApi(action, params = {}) {
    const trimmedKey = apiKey.trim();
    if (!isValidBingApiKey(trimmedKey)) {
      throw new Error("Please enter a valid Bing Webmaster API key.");
    }

    const url = new URL("/api/webmaster-api", window.location.origin);
    url.searchParams.set("service", "bing");
    url.searchParams.set("action", action);
    url.searchParams.set("apikey", trimmedKey);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const token = getSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(url.toString(), { headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `Bing API returned HTTP ${response.status}`);
    return payload;
  }

  async function fetchSites() {
    if (!apiKey.trim()) {
      setError("Enter your Bing Webmaster API key first.");
      return;
    }
    if (!isValidBingApiKey(apiKey)) {
      setError("Please enter a valid Bing Webmaster API key.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      sessionStorage.setItem(BING_KEY_STORAGE, apiKey.trim());
      const payload = await bingApi("getSites");
      const list = bingSitesFromPayload(payload);
      setSites(list);
      const matchedSite = findMatchingBingSite(list, projectUrl, projectDomain);
      if (matchedSite) setSelectedSite(matchedSite);
      if (!list.length) setError("Connected, but Bing returned no verified sites for this API key.");
      if (list.length && !matchedSite) setError(`Connected, but no verified Bing site matched ${displayUrl}.`);
    } catch (err) {
      setError(err?.message || "Could not connect to Bing Webmaster.");
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    const site = selectedSite || findMatchingBingSite(sites, projectUrl, projectDomain);
    if (!apiKey.trim()) {
      setError("Enter your Bing Webmaster API key first.");
      return;
    }
    if (!isValidBingApiKey(apiKey)) {
      setError("Please enter a valid Bing Webmaster API key.");
      return;
    }
    if (!hasProject) {
      setError("Select a website in the nav before running this audit.");
      return;
    }
    if (!site) {
      setError(`Connect Bing with a verified site matching ${displayUrl}.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [statsData, pagesData] = await Promise.all([
        bingApi("getStats", { siteUrl: site }),
        bingApi("getPageStats", { siteUrl: site }).catch(() => ({ d: [], pages: [] })),
      ]);
      const next = buildBingData(site, statsData.d || statsData.queries || [], pagesData.d || pagesData.pages || []);
      setPerformanceData(next);
      
      // Persist the Bing result to project_data
      try {
        await saveBingResult(next);
      } catch (saveErr) {
        console.warn("Failed to save Bing result:", saveErr?.message);
        // Don't break the UI if saving fails - just log the warning
      }
    } catch (err) {
      setError(err?.message || "Could not fetch Bing performance data.");
    } finally {
      setLoading(false);
    }
  }

  function clearConnection() {
    sessionStorage.removeItem(BING_KEY_STORAGE);
    setApiKey("");
    setSites([]);
    setSelectedSite("");
    setPerformanceData(null);
  }

  function downloadReport() {
    if (!performanceData) return;
    const rows = [
      ["Bing Webmaster Report", performanceData.selectedSite],
      ["Clicks", performanceData.totals.clicks],
      ["Impressions", performanceData.totals.impressions],
      ["CTR", `${performanceData.totals.ctr.toFixed(2)}%`],
      [],
      ["Top Queries"],
      ["Query", "Clicks", "Impressions", "CTR"],
      ...performanceData.topQueries.map((row) => [row.key, row.clicks, row.impressions, `${row.ctr.toFixed(2)}%`]),
      [],
      ["Top Pages"],
      ["Page", "Clicks", "Impressions", "CTR"],
      ...performanceData.topPages.map((row) => [row.key, row.clicks, row.impressions, `${row.ctr.toFixed(2)}%`]),
    ];
    downloadTextFile(
      `bing-webmaster-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/30">
          <BarChart3 className="h-6 w-6 text-brand-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black text-white">Bing Webmaster Audit</h1>
            <HelpCircle className="h-4 w-4 text-white/25" />
          </div>
          <p className="text-sm text-white/40">Connect Bing Webmaster Tools to analyze query, page, and CTR opportunities.</p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-white/[0.06] bg-ink-800 p-6">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-3">
            <Key className="h-4 w-4 text-brand-400/70" />
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Bing Webmaster API key"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
            />
            <button onClick={() => setShowKey(!showKey)} className="text-white/30 hover:text-white/60">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="truncate rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white/70">
            {selectedSite || displayUrl}
          </div>
          <button onClick={fetchSites} disabled={loading} className="bing-primary-button rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition disabled:opacity-60">
            {loading ? "Connecting..." : "Connect Bing"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            API key path: <span className="text-brand-300">Bing Webmaster Tools - Settings - API Access</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={analyze} disabled={loading} className="bing-primary-button flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Analyze Site
            </button>
            <button onClick={downloadReport} disabled={!performanceData} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold text-white/70 disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> Download CSV
            </button>
            <button onClick={clearConnection} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45 hover:bg-white/[0.04]">Clear</button>
          </div>
        </div>

        {(error || persistenceError) && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> {error || persistenceError}</p>}

        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <h3 className="text-sm font-bold text-white/70">How to get your API key:</h3>
          <ol className="mt-3 space-y-2.5">
            {API_KEY_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-300">{i + 1}</span>
                <span className="text-sm text-white/55">
                  {step.includes("Bing Webmaster Tools") ? (
                    <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">
                      Go to Bing Webmaster Tools <ExternalLink className="inline h-3 w-3" />
                    </a>
                  ) : step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {performanceData && (
        <>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <Metric value={formatNumber(performanceData.totals.clicks)} label="Clicks" />
            <Metric value={formatNumber(performanceData.totals.impressions)} label="Impressions" />
            <Metric value={`${performanceData.totals.ctr.toFixed(2)}%`} label="CTR" />
          </div>

          <ReportSection title="Top Queries" subtitle="Aggregated by query keyword" open={openSections.queries} toggle={() => toggleSection("queries")}>
            <Rows rows={performanceData.topQueries.slice(0, 15)} label="Query" />
          </ReportSection>
          <ReportSection title="Top Pages" subtitle="Aggregated by URL" open={openSections.pages} toggle={() => toggleSection("pages")}>
            <Rows rows={performanceData.topPages} label="Page" />
          </ReportSection>
          <ReportSection title="High Potential Pages" subtitle="High impressions with CTR below 2%" open={openSections.high} toggle={() => toggleSection("high")}>
            <Rows rows={performanceData.highPotentialPages.slice(0, 15)} label="Page" />
          </ReportSection>
          <ReportSection title="Penalized Pages" subtitle="Very low CTR pages that still receive impressions" open={openSections.penalized} toggle={() => toggleSection("penalized")}>
            <Rows rows={performanceData.penalizedPages.slice(0, 15)} label="Page" />
          </ReportSection>
          <ReportSection title="Dead Pages" subtitle="Impressions but zero clicks" open={openSections.dead} toggle={() => toggleSection("dead")}>
            <Rows rows={performanceData.deadPages.slice(0, 15)} label="Page" />
          </ReportSection>
          <ReportSection title="Ranked Pages" subtitle="Pages with meaningful Bing traffic" open={openSections.ranked} toggle={() => toggleSection("ranked")}>
            <Rows rows={performanceData.rankedPages.slice(0, 15)} label="Page" />
          </ReportSection>
        </>
      )}
    </div>
  );
}

function Metric({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
      <div className="font-display text-3xl font-black text-white">{value}</div>
      <div className="text-xs text-white/35">{label}</div>
    </div>
  );
}

function ReportSection({ title, subtitle, open, toggle, children }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <button onClick={toggle} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]">
        <div>
          <div className="text-sm font-bold text-white/85">{title}</div>
          <div className="text-[11px] text-white/35">{subtitle}</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
      </button>
      {open && <div className="border-t border-white/[0.04] px-5 py-4">{children}</div>}
    </div>
  );
}

function Rows({ rows, label }) {
  if (!rows.length) return <p className="text-xs text-white/30">No rows found for this group.</p>;
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={`${row.key}-${i}`} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {row.ctr >= 2 ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                <span className="truncate text-sm font-semibold text-white/85">{row.key}</span>
              </div>
              {row.topQueries?.length > 0 && <p className="mt-1 truncate text-[11px] text-emerald-300/70">Queries: {row.topQueries.join(", ")}</p>}
            </div>
            <div className="grid grid-cols-3 gap-4 text-right text-xs">
              <span><b className="text-white">{formatNumber(row.clicks)}</b><br /><span className="text-white/35">Clicks</span></span>
              <span><b className="text-white">{formatNumber(row.impressions)}</b><br /><span className="text-white/35">Imp.</span></span>
              <span><b className="text-white">{row.ctr.toFixed(2)}%</b><br /><span className="text-white/35">CTR</span></span>
            </div>
          </div>
          <div className="sr-only">{label}</div>
        </div>
      ))}
    </div>
  );
}
