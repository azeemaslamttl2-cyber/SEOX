/**
 * GSC Audit core - pure logic shared by the /tech-seo/gsc-audit page (browser,
 * user's Google token) and /api/project-details (server, project owner's
 * stored token). It performs no I/O itself: callers hand `runGscAudit` a
 * `request(site, body)` that resolves to Search Console rows.
 */

function formatNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function getDateWindow(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Number(days || 28));
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - Number(days || 28));
  return { start, end, prevStart, prevEnd };
}

export function formatDate(date) {
  return date.toISOString().split("T")[0];
}

export function formatDateLabel(start, end) {
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function normalizePageKey(rawUrl, siteUrl) {
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

export function hostFromAnySite(siteUrl) {
  if (!siteUrl) return "";
  if (String(siteUrl).startsWith("sc-domain:")) return String(siteUrl).replace("sc-domain:", "").replace(/^www\./i, "").toLowerCase();
  try {
    return new URL(siteUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(siteUrl).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

export function findMatchingSiteForProject(sites, projectUrl, projectDomain) {
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

export function buildGscResult({ selectedSite, rangeDays, dailyRows, queryRows, pageRows, pageQueryRows, prevPageQueryRows }) {
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

/**
 * Runs the five Search Console queries the audit is built from and returns the
 * audit result. `request(site, body)` must resolve to an array of rows.
 */
export async function runGscAudit({ request, site, rangeDays = 28 }) {
  const { start, end, prevStart, prevEnd } = getDateWindow(rangeDays);
  const baseBody = { startDate: formatDate(start), endDate: formatDate(end) };
  const [dailyRows, queryRows, pageRows, pageQueryRows, prevPageQueryRows] = await Promise.all([
    request(site, { ...baseBody, dimensions: ["date"], rowLimit: 1000 }),
    request(site, { ...baseBody, dimensions: ["query"], rowLimit: 500 }),
    request(site, { ...baseBody, dimensions: ["page"], rowLimit: 1000 }),
    request(site, { ...baseBody, dimensions: ["page", "query"], rowLimit: 500 }),
    request(site, { startDate: formatDate(prevStart), endDate: formatDate(prevEnd), dimensions: ["page", "query"], rowLimit: 500 }),
  ]);
  return buildGscResult({ selectedSite: site, rangeDays, dailyRows, queryRows, pageRows, pageQueryRows, prevPageQueryRows });
}
