import { restoreGscSession } from "./gscSession.js";
import { normalizeToolUrl } from "./techSeoTools.js";

export const EMPTY_GSC_PERFORMANCE_METRICS = {
  clicks: 0,
  impressions: 0,
  ctr: 0,
  position: 0,
};

function normalizeProjectUrl(project) {
  const raw =
    typeof project === "string"
      ? project
      : String(project?.fullUrl || project?.url || project?.domain || "").trim();
  if (!raw) return "";
  return normalizeToolUrl(raw);
}

export function gscHostFromUrl(rawUrl) {
  if (!rawUrl) return "";
  if (String(rawUrl).startsWith("sc-domain:")) {
    return String(rawUrl).replace("sc-domain:", "").replace(/^www\./i, "").toLowerCase();
  }
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(rawUrl)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
  }
}

function dateRange(days = 28, offsetDays = 0) {
  const end = new Date();
  end.setDate(end.getDate() - offsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    days,
  };
}

export function findMatchingGscSite(entries, project) {
  const projectUrl = normalizeProjectUrl(project);
  if (!projectUrl) return "";

  const host = gscHostFromUrl(projectUrl);
  const origin = new URL(projectUrl).origin.replace(/\/$/, "").toLowerCase();
  const match = (entries || []).find((entry) => {
    const siteUrl = entry?.siteUrl || entry?.url || entry;
    if (!siteUrl) return false;
    if (String(siteUrl).startsWith("sc-domain:")) return gscHostFromUrl(siteUrl) === host;
    return gscHostFromUrl(siteUrl) === host || String(siteUrl).replace(/\/$/, "").toLowerCase() === origin;
  });

  return match?.siteUrl || match?.url || match || "";
}

export async function fetchGscSites(accessToken) {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `GSC sites API returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload?.siteEntry || [];
}

export async function fetchGscPerformanceRows(accessToken, siteUrl, range, options = {}) {
  const body = {
    startDate: range.startDate,
    endDate: range.endDate,
    rowLimit: options.rowLimit || 1,
    type: options.searchType || "web",
  };
  if (options.dimensions?.length) body.dimensions = options.dimensions;

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `GSC API returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload.rows || [];
}

function metricsFromAggregateRows(rows) {
  const row = rows?.[0] || {};
  const clicks = Number(row.clicks) || 0;
  const impressions = Number(row.impressions) || 0;
  const ctr = impressions ? (clicks / impressions) * 100 : (Number(row.ctr) || 0) * 100;
  const position = Number(row.position) || 0;
  return {
    clicks: Math.round(clicks),
    impressions: Math.round(impressions),
    ctr,
    position,
  };
}

function deltas(current, previous) {
  return {
    clicks: current.clicks - previous.clicks,
    impressions: current.impressions - previous.impressions,
    ctr: current.ctr - previous.ctr,
    position: current.position - previous.position,
  };
}

export async function fetchProjectGscPerformance(project, { userId, accessToken, days = 28 } = {}) {
  const projectUrl = normalizeProjectUrl(project);
  if (!projectUrl) {
    return {
      status: "skipped",
      summary: "Select a website",
      detail: "Choose a project before loading Search Console metrics.",
      metrics: EMPTY_GSC_PERFORMANCE_METRICS,
    };
  }

  const session = accessToken
    ? { connected: true, accessToken }
    : await restoreGscSession({ userId, preferServer: true });

  if (!session?.connected || !session.accessToken) {
    return {
      status: "skipped",
      summary: "Connect GSC",
      detail: "No Google Search Console connection is available.",
      metrics: EMPTY_GSC_PERFORMANCE_METRICS,
    };
  }

  const sites = await fetchGscSites(session.accessToken);
  const siteUrl = findMatchingGscSite(sites, projectUrl);
  if (!siteUrl) {
    return {
      status: "skipped",
      summary: "No matching GSC property",
      detail: `Connect a Search Console property for ${gscHostFromUrl(projectUrl)}.`,
      metrics: EMPTY_GSC_PERFORMANCE_METRICS,
    };
  }

  const currentRange = dateRange(days, 1);
  const previousRange = dateRange(days, days + 1);
  const [currentRows, previousRows, dailyRows, queryRows, pageRows] = await Promise.all([
    fetchGscPerformanceRows(session.accessToken, siteUrl, currentRange),
    fetchGscPerformanceRows(session.accessToken, siteUrl, previousRange),
    fetchGscPerformanceRows(session.accessToken, siteUrl, currentRange, {
      dimensions: ["date"],
      rowLimit: 500,
    }),
    fetchGscPerformanceRows(session.accessToken, siteUrl, currentRange, {
      dimensions: ["query"],
      rowLimit: 10,
    }),
    fetchGscPerformanceRows(session.accessToken, siteUrl, currentRange, {
      dimensions: ["page"],
      rowLimit: 10,
    }),
  ]);
  const metrics = metricsFromAggregateRows(currentRows);
  const previousMetrics = metricsFromAggregateRows(previousRows);

  const dailyData = (dailyRows || [])
    .map((row) => ({
      date: row.keys?.[0] || "",
      clicks: Math.round(Number(row.clicks) || 0),
      impressions: Math.round(Number(row.impressions) || 0),
      ctr: row.impressions ? ((row.clicks || 0) / row.impressions) * 100 : 0,
      position: Number(row.position) || 0,
    }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const topQueries = (queryRows || []).slice(0, 5).map((row) => ({
    query: row.keys?.[0] || "",
    clicks: Math.round(Number(row.clicks) || 0),
    impressions: Math.round(Number(row.impressions) || 0),
    ctr: row.impressions ? ((row.clicks || 0) / row.impressions) * 100 : 0,
    position: Number(row.position) || 0,
  }));

  const topPages = (pageRows || []).slice(0, 5).map((row) => ({
    page: row.keys?.[0] || "",
    clicks: Math.round(Number(row.clicks) || 0),
    impressions: Math.round(Number(row.impressions) || 0),
    ctr: row.impressions ? ((row.clicks || 0) / row.impressions) * 100 : 0,
    position: Number(row.position) || 0,
  }));

  const quickWins = (queryRows || [])
    .filter((row) => Number(row.position) >= 5 && Number(row.position) <= 20)
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5)
    .map((row) => ({
      query: row.keys?.[0] || "",
      clicks: Math.round(Number(row.clicks) || 0),
      impressions: Math.round(Number(row.impressions) || 0),
      position: Number(row.position) || 0,
    }));

  return {
    status: "complete",
    siteUrl,
    metrics,
    previousMetrics,
    deltas: deltas(metrics, previousMetrics),
    dailyData,
    topQueries,
    topPages,
    quickWins,
    range: currentRange,
    previousRange,
    fetchedAt: new Date().toISOString(),
    summary: "GSC live",
    detail: `Search Console totals for ${siteUrl}.`,
  };
}
