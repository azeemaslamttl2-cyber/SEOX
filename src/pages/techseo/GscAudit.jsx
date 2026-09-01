import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Globe,
  Download,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
  Target,
  AlertTriangle,
  Zap,
  Skull,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";
import { restoreGscSession } from "../../lib/gscSession.js";
import { csvEscape, downloadTextFile, formatNumber } from "../../lib/techSeoTools.js";

const RANGE_OPTIONS = [7, 28, 90];
const EMPTY_GSC_AUDIT_DATA = {
  signedIn: false,
  sitesAvailable: 0,
  selectedSite: "",
  dateRange: "Last 28 days",
  dateLabel: "No live data loaded",
  metrics: {
    clicks: "0",
    impressions: "0",
    ctr: "0.00%",
    position: "0.00",
  },
  chartData: [],
  topQueries: [],
  topPages: [],
  quickWins: [],
  highPotentialPages: [],
  penalizedPages: [],
  rankedPages: [],
  deadPages: [],
  indexingIssues: [],
};

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

// Results are persisted and may predate fields added to this screen. Normalize
// them before render so an incomplete cached or database result cannot crash it.
function normalizeGscAuditData(value, projectUrl = "") {
  const source = asRecord(value);
  return {
    ...EMPTY_GSC_AUDIT_DATA,
    ...source,
    selectedSite: typeof source.selectedSite === "string" ? source.selectedSite : projectUrl,
    dateLabel: typeof source.dateLabel === "string" ? source.dateLabel : EMPTY_GSC_AUDIT_DATA.dateLabel,
    metrics: { ...EMPTY_GSC_AUDIT_DATA.metrics, ...asRecord(source.metrics) },
    chartData: asArray(source.chartData),
    topQueries: asArray(source.topQueries),
    topPages: asArray(source.topPages),
    quickWins: asArray(source.quickWins),
    highPotentialPages: asArray(source.highPotentialPages),
    penalizedPages: asArray(source.penalizedPages),
    rankedPages: asArray(source.rankedPages),
    deadPages: asArray(source.deadPages),
    indexingIssues: asArray(source.indexingIssues),
  };
}

function getUserId(user) {
  return user?.uid || user?.id || "";
}

function getDateWindow(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Number(days || 28));
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - Number(days || 28));
  return { start, end, prevStart, prevEnd };
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatDateLabel(start, end) {
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function normalizePageKey(rawUrl, siteUrl) {
  if (!rawUrl) return "";
  if (siteUrl?.startsWith("sc-domain:")) {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "") || "/"}`.toLowerCase();
    } catch {
      return rawUrl.toLowerCase();
    }
  }
  return String(rawUrl).replace(/\/$/, "").toLowerCase();
}

function hostFromAnySite(siteUrl) {
  if (!siteUrl) return "";
  if (String(siteUrl).startsWith("sc-domain:")) return String(siteUrl).replace("sc-domain:", "").replace(/^www\./i, "").toLowerCase();
  try {
    return new URL(siteUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(siteUrl).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function findMatchingSiteForProject(sites, projectUrl, projectDomain) {
  const domain = String(projectDomain || hostFromAnySite(projectUrl)).toLowerCase();
  if (!domain) return "";
  let projectOrigin = "";
  try {
    projectOrigin = projectUrl ? new URL(projectUrl).origin.replace(/\/$/, "").toLowerCase() : "";
  } catch {
    // A malformed project URL simply cannot be matched to a URL-prefix property.
  }
  const match = sites.find((site) => {
    const siteUrl = site?.siteUrl || site?.url || site;
    const siteHost = hostFromAnySite(siteUrl);
    if (siteHost === domain) return true;
    if (String(siteUrl).startsWith("sc-domain:")) return siteHost === domain;
    return String(siteUrl || "").replace(/\/$/, "").toLowerCase() === projectOrigin;
  });
  return match?.siteUrl || match?.url || match || "";
}

async function gscRequest(token, siteUrl, body) {
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `GSC API returned HTTP ${response.status}`);
  }
  return payload.rows || [];
}

function buildPageQueryMap(rows, siteUrl) {
  const map = new Map();
  rows.forEach((row) => {
    const page = row.keys?.[0];
    const query = row.keys?.[1];
    const key = normalizePageKey(page, siteUrl);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, url: page, clicks: 0, impressions: 0, queries: new Map() });
    }
    const entry = map.get(key);
    entry.clicks += row.clicks || 0;
    entry.impressions += row.impressions || 0;
    if (query) {
      const existing = entry.queries.get(query) || { query, clicks: 0, impressions: 0 };
      existing.clicks += row.clicks || 0;
      existing.impressions += row.impressions || 0;
      entry.queries.set(query, existing);
    }
  });
  map.forEach((entry) => {
    entry.topQueries = Array.from(entry.queries.values()).sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((item) => item.query);
    delete entry.queries;
  });
  return map;
}

function buildGscResult({ selectedSite, rangeDays, dailyRows, queryRows, pageRows, pageQueryRows, prevPageQueryRows }) {
  const { start, end } = getDateWindow(rangeDays);
  const totals = dailyRows.reduce((acc, row) => {
    acc.clicks += row.clicks || 0;
    acc.impressions += row.impressions || 0;
    acc.position += row.position || 0;
    acc.count += 1;
    return acc;
  }, { clicks: 0, impressions: 0, position: 0, count: 0 });
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const position = totals.count ? totals.position / totals.count : 0;

  const uniquePages = new Map();
  pageRows.forEach((row) => {
    const rawUrl = row.keys?.[0];
    const key = normalizePageKey(rawUrl, selectedSite);
    if (!key) return;
    const entry = uniquePages.get(key) || { key, url: rawUrl, clicks: 0, impressions: 0, positionTotal: 0, count: 0 };
    entry.clicks += row.clicks || 0;
    entry.impressions += row.impressions || 0;
    entry.positionTotal += row.position || 0;
    entry.count += 1;
    uniquePages.set(key, entry);
  });

  const pageQueryMap = buildPageQueryMap(pageQueryRows, selectedSite);
  const currentPageMap = buildPageQueryMap(pageQueryRows, selectedSite);
  const previousPageMap = buildPageQueryMap(prevPageQueryRows, selectedSite);

  const pages = Array.from(uniquePages.values()).map((page) => ({
    ...page,
    ctr: page.impressions ? (page.clicks / page.impressions) * 100 : 0,
    position: page.count ? page.positionTotal / page.count : 0,
    topQueries: pageQueryMap.get(page.key)?.topQueries || [],
  }));

  const quickWins = queryRows
    .filter((row) => row.position >= 5 && row.position < 20)
    .sort((a, b) => a.position - b.position)
    .slice(0, 50)
    .map((row) => ({ query: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: (row.ctr || 0) * 100, position: row.position || 0 }));

  const highPotentialPages = pages.filter((page) => page.impressions >= 100 && page.ctr < 2).sort((a, b) => b.impressions - a.impressions);
  const deadPages = pages.filter((page) => page.impressions >= 10 && page.clicks === 0).sort((a, b) => b.impressions - a.impressions);

  const penalizedPages = [];
  const rankedPages = [];
  currentPageMap.forEach((current, key) => {
    const previous = previousPageMap.get(key);
    const previousClicks = previous?.clicks || 0;
    if (previousClicks > 10) {
      const change = current.clicks - previousClicks;
      const changePercent = (change / previousClicks) * 100;
      if (changePercent < -30) {
        penalizedPages.push({ ...current, prevClicks: previousClicks, change, changePercent });
      }
    }
    if (current.clicks > 10) {
      const change = current.clicks - previousClicks;
      const changePercent = previousClicks ? (change / previousClicks) * 100 : 100;
      if (change > 5 && (changePercent > 30 || !previousClicks)) {
        rankedPages.push({ ...current, prevClicks: previousClicks, change, changePercent });
      }
    }
  });

  const chartData = dailyRows.map((row, index) => ({ day: row.keys?.[0] || index + 1, clicks: row.clicks || 0, impressions: row.impressions || 0 }));

  return {
    signedIn: true,
    selectedSite,
    sitesAvailable: 0,
    dateRange: `Last ${rangeDays} days`,
    dateLabel: formatDateLabel(start, end),
    metrics: {
      clicks: formatNumber(totals.clicks),
      impressions: formatNumber(totals.impressions),
      ctr: `${ctr.toFixed(2)}%`,
      position: position.toFixed(2),
    },
    chartData,
    topQueries: queryRows.slice(0, 10).map((row) => ({ query: row.keys?.[0] || "", clicks: row.clicks || 0, impressions: row.impressions || 0 })),
    topPages: pages.sort((a, b) => b.clicks - a.clicks).slice(0, 10).map((page) => ({ page: page.url, clicks: page.clicks, impressions: page.impressions })),
    quickWins,
    highPotentialPages,
    penalizedPages: penalizedPages.sort((a, b) => a.change - b.change),
    rankedPages: rankedPages.sort((a, b) => b.change - a.change),
    deadPages,
    indexingIssues: [],
  };
}

export default function GscAudit() {
  const { user } = useAuth();
  const { project, projectUrl, projectDomain, hasProject, displayUrl } = useSelectedProjectDomain();
  const userId = getUserId(user);
  const { result: savedGscResult, saveResult: saveGscResult, persistenceError } = useTechSeoToolResult({
    toolKey: "gsc",
    project,
    projectUrl,
    emptyResult: EMPTY_GSC_AUDIT_DATA,
  });
  const [data, setData] = useState(() => normalizeGscAuditData(null, projectUrl));
  const d = normalizeGscAuditData(data, projectUrl);
  const [token, setToken] = useState("");
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [dateRange, setDateRange] = useState("28");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openPerf, setOpenPerf] = useState(true);
  const [openQuickWins, setOpenQuickWins] = useState(false);
  const [openHighPotential, setOpenHighPotential] = useState(false);
  const [openPenalized, setOpenPenalized] = useState(false);
  const [openRanked, setOpenRanked] = useState(false);
  const [openDead, setOpenDead] = useState(false);
  const [openIndexing, setOpenIndexing] = useState(true);
  const didAutoFetch = useRef(false);
  const hasFetchedLive = useRef(false);

  useEffect(() => {
    didAutoFetch.current = false;
    hasFetchedLive.current = false;
    setSelectedSite("");
    setData(normalizeGscAuditData(null, projectUrl));
    setError("");
  }, [projectUrl]);

  // Load saved GSC result when component mounts or when project changes
  useEffect(() => {
    if (savedGscResult && savedGscResult.metrics && Object.keys(savedGscResult).length > 1) {
      setData(normalizeGscAuditData(savedGscResult, projectUrl));
      hasFetchedLive.current = true;
    }
  }, [savedGscResult]);

  const maxClicks = Math.max(1, ...d.chartData.map((p) => p.clicks || 0));
  const maxImpressions = Math.max(1, ...d.chartData.map((p) => p.impressions || 0));
  const chartW = 700;
  const chartH = 180;

  const clicksPath = useMemo(() => linePath(d.chartData, "clicks", maxClicks, chartW, chartH), [d.chartData, maxClicks]);
  const impressionsPath = useMemo(() => linePath(d.chartData, "impressions", maxImpressions, chartW, chartH), [d.chartData, maxImpressions]);

  const fetchSites = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return null;
    if (!silent) setLoading(true);
    if (!silent) setError("");

    try {
      const session = await restoreGscSession({
        userId,
        preferServer: Boolean(userId),
      });

      if (!session?.connected || !session.accessToken) {
        setToken("");
        setSites([]);
        setSelectedSite("");
        return null;
      }

      setToken(session.accessToken);
      const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || `GSC sites API returned HTTP ${response.status}`);
      const list = payload?.siteEntry || [];
      setSites(list);
      const siteUrl = findMatchingSiteForProject(list, projectUrl, projectDomain);
      if (siteUrl) setSelectedSite(siteUrl);
      setData((prev) => ({ ...prev, sitesAvailable: list.length, selectedSite: siteUrl || prev.selectedSite }));
      if (!siteUrl && list.length && projectUrl && !silent) {
        setError(`No Google Search Console property matched ${displayUrl}.`);
      }
      return { accessToken: session.accessToken, siteUrl };
    } catch (err) {
      if (!silent) setError(err?.message || "Could not fetch GSC sites.");
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [displayUrl, projectDomain, projectUrl, userId]);

  useEffect(() => {
    fetchSites({ silent: true });
  }, [fetchSites]);

  // Auto-fetch on mount once session + sites are ready
  useEffect(() => {
    if (didAutoFetch.current) return;
    if (!token || !selectedSite) return;
    didAutoFetch.current = true;
    analyze();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedSite]);

  // Re-fetch when date range or selected site changes (after initial load)
  useEffect(() => {
    if (!hasFetchedLive.current) return;
    if (!token || !selectedSite) return;
    analyze();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedSite]);

  async function analyze() {
    let accessToken = token.trim();
    let site = selectedSite || findMatchingSiteForProject(sites, projectUrl, projectDomain);

    if (!hasProject) {
      setError("Select a website in the nav before running this audit.");
      return;
    }

    if (!accessToken || !site) {
      const connected = await fetchSites({ silent: false });
      accessToken = connected?.accessToken || accessToken;
      site = connected?.siteUrl || site;
    }

    if (!accessToken) {
      setError("Connect Google Search Console from GSC Insights before running this audit.");
      return;
    }
    if (!site) {
      setError(`No Google Search Console property matched ${displayUrl}.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { start, end, prevStart, prevEnd } = getDateWindow(dateRange);
      const baseBody = {
        startDate: formatDate(start),
        endDate: formatDate(end),
      };
      const [dailyRows, queryRows, pageRows, pageQueryRows, prevPageQueryRows] = await Promise.all([
        gscRequest(accessToken, site, { ...baseBody, dimensions: ["date"], rowLimit: 1000 }),
        gscRequest(accessToken, site, { ...baseBody, dimensions: ["query"], rowLimit: 500 }),
        gscRequest(accessToken, site, { ...baseBody, dimensions: ["page"], rowLimit: 1000 }),
        gscRequest(accessToken, site, { ...baseBody, dimensions: ["page", "query"], rowLimit: 500 }),
        gscRequest(accessToken, site, { startDate: formatDate(prevStart), endDate: formatDate(prevEnd), dimensions: ["page", "query"], rowLimit: 500 }),
      ]);
      const next = buildGscResult({ selectedSite: site, rangeDays: dateRange, dailyRows, queryRows, pageRows, pageQueryRows, prevPageQueryRows });
      next.sitesAvailable = sites.length || d.sitesAvailable;
      setData(next);
      
      // Persist the GSC result to project_data
      try {
        await saveGscResult(next);
      } catch (saveErr) {
        console.warn("Failed to save GSC result:", saveErr?.message);
        // Don't break the UI if saving fails - just log the warning
      }
      
      hasFetchedLive.current = true;
    } catch (err) {
      setError(err?.message || "Could not fetch GSC analytics.");
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    const rows = [
      ["GSC Audit", d.selectedSite],
      ["Date range", d.dateLabel],
      ["Clicks", d.metrics.clicks],
      ["Impressions", d.metrics.impressions],
      ["CTR", d.metrics.ctr],
      ["Position", d.metrics.position],
      [],
      ["Top Queries"],
      ["Query", "Clicks", "Impressions"],
      ...d.topQueries.map((row) => [row.query, row.clicks, row.impressions || ""]),
      [],
      ["Top Pages"],
      ["Page", "Clicks", "Impressions"],
      ...d.topPages.map((row) => [row.page, row.clicks, row.impressions || ""]),
      [],
      ["Quick Wins"],
      ["Query", "Clicks", "Impressions", "Position"],
      ...(Array.isArray(d.quickWins) ? d.quickWins.map((row) => [row.query, row.clicks, row.impressions, row.position?.toFixed?.(1) || row.position]) : []),
    ];
    downloadTextFile(
      `gsc-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="gsc-audit-title-row flex justify-start">
        <div className="gsc-audit-title rounded-xl bg-brand-500 px-6 py-2.5 shadow-lg shadow-brand-500/20">
          <div className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5" />
            <span className="font-display text-lg font-bold">GSC Audit</span>
          </div>
        </div>
      </div>
      <p className="gsc-audit-description mt-3 text-left text-sm text-white/45">
        Analyze Search Console performance, page opportunities, and traffic movement from live GSC data.
      </p>

      <div className="gsc-audit-controls mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="gsc-audit-site max-w-[260px] truncate rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs text-white/70">
              {selectedSite || displayUrl}
            </span>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="gsc-audit-range rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs text-white/70 focus:outline-none">
              {RANGE_OPTIONS.map((days) => <option key={days} value={days}>Last {days} days</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadReport} className="ui-button gsc-audit-download">
              <Download className="h-3.5 w-3.5" /> Download Report
            </button>
          </div>
        </div>
        {loading && <p className="mt-3 text-xs text-white/40 animate-pulse">Fetching live data from Google Search Console…</p>}
        {(error || persistenceError) && <p className="mt-3 text-xs font-semibold text-rose-300">{error || persistenceError}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="gsc-audit-status flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-bold text-emerald-300">
          <Calendar className="h-3.5 w-3.5" /> {d.dateLabel}
        </span>
        <span className="gsc-audit-current-site flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-xs text-white/60">
          <Globe className="h-3.5 w-3.5" /> {selectedSite || d.selectedSite}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl">
        <MetricCard value={d.metrics.clicks} label="Total Clicks" color="metric-clicks" />
        <MetricCard value={d.metrics.impressions} label="Total Impressions" color="metric-impressions" />
        <MetricCard value={d.metrics.ctr} label="Average CTR" color="metric-ctr" />
        <MetricCard value={d.metrics.position} label="Average Position" color="metric-position" />
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-white/50"><span className="h-2 w-2 rounded-full bg-blue-400" /> Clicks</span>
          <span className="flex items-center gap-1.5 text-xs text-white/50"><span className="h-2 w-2 rounded-full bg-violet-400" /> Impressions</span>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: 500 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={0} y1={f * chartH} x2={chartW} y2={f * chartH} stroke="#eef0f5" />)}
            <path d={impressionsPath} fill="none" stroke="#a78bfa" strokeWidth="2" opacity="0.7" />
            <path d={clicksPath} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
          </svg>
        </div>
      </div>

      <CollapsibleSection icon={<BarChart3 className="h-5 w-5 text-blue-400" />} title="Performance Overview" subtitle="Live Search Console data" open={openPerf} toggle={() => setOpenPerf(!openPerf)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <TopList title="Top Queries" icon={<Search className="h-4 w-4 text-violet-400" />} rows={d.topQueries.map((q) => ({ label: q.query, value: `${formatNumber(q.clicks)} clicks` }))} />
          <TopList title="Top Pages" icon={<Globe className="h-4 w-4 text-emerald-400" />} rows={d.topPages.map((p) => ({ label: p.page, value: `${formatNumber(p.clicks)} clicks` }))} />
        </div>
      </CollapsibleSection>

      <InsightCard icon={<Zap className="h-5 w-5 text-amber-400" />} title="Quick Wins" subtitle="Queries ranking position 5-20" rows={Array.isArray(d.quickWins) ? d.quickWins : []} badge={`${Array.isArray(d.quickWins) ? d.quickWins.length : d.quickWins.count} queries`} badgeColor="bg-amber-500/15 text-amber-300" open={openQuickWins} toggle={() => setOpenQuickWins(!openQuickWins)} type="query" />
      <InsightCard icon={<Target className="h-5 w-5 text-orange-400" />} title="High Potential Pages" subtitle="High impressions but low CTR" rows={Array.isArray(d.highPotentialPages) ? d.highPotentialPages : []} badge={`${Array.isArray(d.highPotentialPages) ? d.highPotentialPages.length : d.highPotentialPages.count} pages`} badgeColor="bg-orange-500/15 text-orange-300" open={openHighPotential} toggle={() => setOpenHighPotential(!openHighPotential)} type="page" />
      <InsightCard icon={<AlertTriangle className="h-5 w-5 text-rose-400" />} title="Penalized Pages" subtitle="Pages that lost significant clicks versus the previous period" rows={Array.isArray(d.penalizedPages) ? d.penalizedPages : []} badge={`${Array.isArray(d.penalizedPages) ? d.penalizedPages.length : d.penalizedPages.count} pages`} badgeColor="bg-rose-500/15 text-rose-300" open={openPenalized} toggle={() => setOpenPenalized(!openPenalized)} type="page-change" />
      <InsightCard icon={<TrendingUp className="h-5 w-5 text-emerald-400" />} title="Ranked Pages" subtitle="Pages gaining meaningful clicks" rows={Array.isArray(d.rankedPages) ? d.rankedPages : []} badge={`${Array.isArray(d.rankedPages) ? d.rankedPages.length : d.rankedPages.count} pages`} badgeColor="bg-emerald-500/15 text-emerald-300" open={openRanked} toggle={() => setOpenRanked(!openRanked)} type="page-change" />
      <InsightCard icon={<Skull className="h-5 w-5 text-white/40" />} title="Dead Pages" subtitle="Indexed pages with impressions but zero clicks" rows={Array.isArray(d.deadPages) ? d.deadPages : []} badge={`${Array.isArray(d.deadPages) ? d.deadPages.length : d.deadPages.count} pages`} badgeColor="bg-white/10 text-white/50" open={openDead} toggle={() => setOpenDead(!openDead)} type="page" />

      <CollapsibleSection icon={<AlertTriangle className="h-5 w-5 text-rose-400" />} title="Indexing Issues to Check" subtitle="Review in GSC Indexing > Pages" open={openIndexing} toggle={() => setOpenIndexing(!openIndexing)}>
        <div className="space-y-2">
          {d.indexingIssues.map((issue, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/85">{issue.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${issue.priority === "high" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>{issue.priority}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/35">{issue.desc}</p>
              <p className="mt-2 text-[11px] text-emerald-300/70">Fix: {issue.fix}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function linePath(rows, key, maxValue, chartW, chartH) {
  if (!rows.length) return "";
  return rows.map((point, i) => {
    const x = rows.length === 1 ? 0 : (i / (rows.length - 1)) * chartW;
    const y = chartH - ((point[key] || 0) / maxValue) * chartH;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

function MetricCard({ value, label, color }) {
  return (
    <div className={`gsc-audit-metric ${color} px-5 py-4 text-center`}>
      <div className="font-display text-2xl font-black">{value}</div>
      <div className="text-[11px]">{label}</div>
    </div>
  );
}

function CollapsibleSection({ icon, title, subtitle, open, toggle, children }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <button onClick={toggle} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="text-sm font-bold text-white/85">{title}</div>
            <div className="text-[11px] text-white/35">{subtitle}</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
      </button>
      {open && <div className="border-t border-white/[0.04] px-5 py-4">{children}</div>}
    </div>
  );
}

function TopList({ title, icon, rows }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-white/80">{title}</span>
      </div>
      <div className="space-y-1">
        {rows.length ? rows.map((row, i) => (
          <div key={`${row.label}-${i}`} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.02]">
            <span className="truncate text-sm text-white/70">{row.label}</span>
            <span className="text-xs font-semibold text-blue-300">{row.value}</span>
          </div>
        )) : <p className="text-xs text-white/30">No data loaded yet.</p>}
      </div>
    </div>
  );
}

const INSIGHT_PAGE_SIZE = 10;

function InsightCard({ icon, title, subtitle, badge, badgeColor, open, toggle, rows, type }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / INSIGHT_PAGE_SIZE));
  const pagedRows = rows.slice(page * INSIGHT_PAGE_SIZE, (page + 1) * INSIGHT_PAGE_SIZE);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <button onClick={toggle} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="text-sm font-bold text-white/85">{title}</div>
            <div className="text-[11px] text-white/35">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeColor}`}>{badge}</span>
          {open ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-white/[0.04] px-5 py-4">
          {rows.length ? (
            <>
              {pagedRows.map((row, i) => <InsightRow key={page * INSIGHT_PAGE_SIZE + i} row={row} type={type} />)}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-white/30">
                    Showing {page * INSIGHT_PAGE_SIZE + 1}–{Math.min((page + 1) * INSIGHT_PAGE_SIZE, rows.length)} of {rows.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} onClick={() => setPage(i)} className={`min-w-[28px] rounded-lg px-1.5 py-1 text-[11px] font-bold transition ${i === page ? "bg-brand-500/20 text-brand-300" : "text-white/40 hover:bg-white/[0.06]"}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : <p className="text-xs text-white/30">No rows in this group for the loaded date range.</p>}
        </div>
      )}
    </div>
  );
}

function InsightRow({ row, type }) {
  const label = type === "query" ? row.query : row.url;
  return (
    <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="truncate text-sm font-semibold text-white/80">{label}</span>
        <span className="text-xs text-white/45">
          {formatNumber(row.impressions || 0)} imp. / {formatNumber(row.clicks || row.currentClicks || 0)} clicks
        </span>
      </div>
      {type === "query" && <p className="mt-1 text-[11px] text-amber-300">Position {Number(row.position || 0).toFixed(1)} / CTR {Number(row.ctr || 0).toFixed(1)}%</p>}
      {type === "page-change" && <p className="mt-1 text-[11px] text-white/35">Change: {row.change > 0 ? "+" : ""}{row.change} clicks ({Number(row.changePercent || 0).toFixed(0)}%)</p>}
      {row.topQueries?.length > 0 && <p className="mt-1 text-[11px] text-emerald-300/70">Queries: {row.topQueries.join(", ")}</p>}
    </div>
  );
}
