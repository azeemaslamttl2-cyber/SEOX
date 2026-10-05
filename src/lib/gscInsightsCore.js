/**
 * GSC Insights core - pure builders shared by the /gsc pages (browser) and
 * /api/project-details (server). No I/O: `runGscInsights` takes a
 * `request(body)` that resolves to Search Console rows.
 */

const formatDateISO = (value) => (value instanceof Date ? value : new Date(value)).toISOString().split("T")[0];

export function sumRows(rows) {
  return rows.reduce(
    (total, row) => {
      const clicks = Number(row.clicks) || 0;
      const impressions = Number(row.impressions) || 0;
      const position = Number(row.position) || 0;
      total.clicks += clicks;
      total.impressions += impressions;
      total.positionWeight += position * impressions;
      return total;
    },
    { clicks: 0, impressions: 0, positionWeight: 0 }
  );
}

export function summarizeRows(rows) {
  const totals = sumRows(rows || []);
  const avgCtr =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgPosition =
    totals.impressions > 0 ? totals.positionWeight / totals.impressions : 0;

  return {
    totalClicks: Math.round(totals.clicks),
    totalImpressions: Math.round(totals.impressions),
    avgCtr: roundMetric(avgCtr, 2),
    avgPosition: roundMetric(avgPosition, 1),
  };
}

export function roundMetric(value, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

export function metricDelta(current, previous, digits = 0) {
  const raw = (Number(current) || 0) - (Number(previous) || 0);
  return digits > 0 ? roundMetric(raw, digits) : Math.round(raw);
}

export function normalizeSearchType(searchType) {
  const normalized = String(searchType || "Web").toLowerCase();
  if (["image", "video", "news"].includes(normalized)) return normalized;
  return "web";
}

export function buildRequestBody({
  startDate,
  endDate,
  dimensions,
  searchType,
  device,
  rowLimit = 5000,
}) {
  const body = {
    startDate: formatDateISO(startDate),
    endDate: formatDateISO(endDate),
    dimensions,
    rowLimit,
    type: normalizeSearchType(searchType),
  };

  if (device && device !== "All") {
    body.dimensionFilterGroups = [
      {
        groupType: "and",
        filters: [
          {
            dimension: "device",
            operator: "equals",
            expression: String(device).toUpperCase(),
          },
        ],
      },
    ];
  }

  return body;
}

export function rowsByDate(rows) {
  return [...(rows || [])]
    .map((row) => {
      const clicks = Number(row.clicks) || 0;
      const impressions = Number(row.impressions) || 0;
      return {
        date: row.keys?.[0] || "",
        clicks: Math.round(clicks),
        impressions: Math.round(impressions),
        ctr: impressions > 0 ? roundMetric((clicks / impressions) * 100, 2) : 0,
        position: roundMetric(Number(row.position) || 0, 1),
      };
    })
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateBy(rows, keyGetter) {
  const groups = new Map();

  (rows || []).forEach((row) => {
    const key = keyGetter(row);
    if (!key) return;
    const clicks = Number(row.clicks) || 0;
    const impressions = Number(row.impressions) || 0;
    const position = Number(row.position) || 0;
    const group =
      groups.get(key) ||
      {
        key,
        clicks: 0,
        impressions: 0,
        positionWeight: 0,
        rows: [],
      };

    group.clicks += clicks;
    group.impressions += impressions;
    group.positionWeight += position * impressions;
    group.rows.push(row);
    groups.set(key, group);
  });

  return groups;
}

export function groupToMetrics(group) {
  if (!group) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    };
  }

  return {
    clicks: Math.round(group.clicks),
    impressions: Math.round(group.impressions),
    ctr:
      group.impressions > 0
        ? roundMetric((group.clicks / group.impressions) * 100, 2)
        : 0,
    position:
      group.impressions > 0
        ? roundMetric(group.positionWeight / group.impressions, 1)
        : 0,
  };
}

export function buildKeywordRows(queryRows, queryPageRows, previousQueryRows) {
  const queryGroups = aggregateBy(
    queryRows?.length ? queryRows : queryPageRows,
    (row) => row.keys?.[0]
  );
  const previousGroups = aggregateBy(previousQueryRows, (row) => row.keys?.[0]);
  const pageGroups = aggregateBy(queryPageRows, (row) => row.keys?.[0]);

  return [...queryGroups.values()]
    .map((group) => {
      const current = groupToMetrics(group);
      const previous = groupToMetrics(previousGroups.get(group.key));
      const pageRows = pageGroups.get(group.key)?.rows || [];
      const pages = aggregateBy(pageRows, (row) => row.keys?.[1]);
      const topPage = [...pages.values()].sort((a, b) => b.clicks - a.clicks)[0];

      return {
        keyword: group.key,
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: current.ctr,
        position: current.position,
        change: metricDelta(current.clicks, previous.clicks),
        impChange: metricDelta(current.impressions, previous.impressions),
        ctrChange: metricDelta(current.ctr, previous.ctr, 2),
        posChange: metricDelta(current.position, previous.position, 1),
        urls: pages.size || 0,
        topUrl: topPage?.key || "",
      };
    })
    .sort((a, b) => b.clicks - a.clicks);
}

export function buildPageRows(pageRows, queryPageRows, previousPageRows) {
  const pageGroups = aggregateBy(
    pageRows?.length ? pageRows : queryPageRows,
    (row) => (pageRows?.length ? row.keys?.[0] : row.keys?.[1])
  );
  const previousGroups = aggregateBy(previousPageRows, (row) => row.keys?.[0]);
  const queryPageGroups = aggregateBy(queryPageRows, (row) => row.keys?.[1]);

  return [...pageGroups.values()]
    .map((group) => {
      const current = groupToMetrics(group);
      const previous = groupToMetrics(previousGroups.get(group.key));
      const queryRows = queryPageGroups.get(group.key)?.rows || [];
      const queryGroups = aggregateBy(queryRows, (row) => row.keys?.[0]);
      const topKeyword = [...queryGroups.values()].sort((a, b) => b.clicks - a.clicks)[0];

      return {
        url: group.key,
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: current.ctr,
        position: current.position,
        change: metricDelta(current.clicks, previous.clicks),
        impChange: metricDelta(current.impressions, previous.impressions),
        ctrChange: metricDelta(current.ctr, previous.ctr, 2),
        posChange: metricDelta(current.position, previous.position, 1),
        keywords: queryGroups.size || 0,
        topKeyword: topKeyword?.key || "",
      };
    })
    .sort((a, b) => b.clicks - a.clicks);
}

export function buildDeviceRows(deviceRows) {
  const totalClicks = (deviceRows || []).reduce(
    (total, row) => total + (Number(row.clicks) || 0),
    0
  );

  return (deviceRows || [])
    .map((row) => {
      const clicks = Number(row.clicks) || 0;
      const impressions = Number(row.impressions) || 0;
      const device = String(row.keys?.[0] || "Unknown").toLowerCase();
      return {
        device: device.charAt(0).toUpperCase() + device.slice(1),
        clicks: Math.round(clicks),
        impressions: Math.round(impressions),
        ctr: impressions > 0 ? roundMetric((clicks / impressions) * 100, 2) : 0,
        position: roundMetric(Number(row.position) || 0, 1),
        share: totalClicks > 0 ? roundMetric((clicks / totalClicks) * 100, 1) : 0,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);
}

export function buildLowHangingFruit(keywords) {
  return (keywords || [])
    .filter((row) => row.position > 3 && row.position <= 20 && row.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

export function buildCannibalization(queryPageRows) {
  const queryGroups = aggregateBy(queryPageRows, (row) => row.keys?.[0]);

  return [...queryGroups.values()]
    .map((group) => {
      const pages = aggregateBy(group.rows, (row) => row.keys?.[1]);
      const metrics = groupToMetrics(group);
      return {
        keyword: group.key,
        urls: pages.size,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
      };
    })
    .filter((row) => row.urls > 1)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

export function buildPositionBuckets(keywords) {
  const buckets = [
    { label: "1-3", min: 1, max: 3, count: 0 },
    { label: "4-10", min: 4, max: 10, count: 0 },
    { label: "11-20", min: 11, max: 20, count: 0 },
    { label: "21-50", min: 21, max: 50, count: 0 },
    { label: "51+", min: 51, max: Infinity, count: 0 },
  ];

  (keywords || []).forEach((row) => {
    const bucket = buckets.find(
      (candidate) => row.position >= candidate.min && row.position <= candidate.max
    );
    if (bucket) bucket.count += 1;
  });

  return buckets;
}

export function buildCtrByPosition(keywords) {
  const groups = new Map();

  (keywords || []).forEach((row) => {
    if (!row.position) return;
    const position = Math.max(1, Math.min(20, Math.round(row.position)));
    const group = groups.get(position) || { position, clicks: 0, impressions: 0 };
    group.clicks += row.clicks;
    group.impressions += row.impressions;
    groups.set(position, group);
  });

  return [...groups.values()]
    .map((group) => ({
      position: group.position,
      ctr: group.impressions > 0 ? roundMetric((group.clicks / group.impressions) * 100, 2) : 0,
    }))
    .sort((a, b) => a.position - b.position);
}

export function buildSiteSummary(site, dailyRows, previousDailyRows = []) {
  const summary = summarizeRows(dailyRows);
  const previous = summarizeRows(previousDailyRows);
  return {
    ...(site || {}),
    ...summary,
    dailyData: rowsByDate(dailyRows),
    changes: {
      clicks: metricDelta(summary.totalClicks, previous.totalClicks),
      impressions: metricDelta(summary.totalImpressions, previous.totalImpressions),
      ctr: metricDelta(summary.avgCtr, previous.avgCtr, 2),
      position: metricDelta(summary.avgPosition, previous.avgPosition, 1),
    },
  };
}

/** Same window the /gsc pages use: ends yesterday, previous period directly before. */
export function getInsightsWindow(days = 90, now = new Date()) {
  const currentEnd = new Date(now);
  currentEnd.setDate(currentEnd.getDate() - 1);
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - days + 1);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return { currentStart, currentEnd, previousStart, previousEnd };
}

/**
 * Builds the GSC Insights report for one property. Lists are capped at `limit`
 * rows (sorted by clicks) so the result stays small enough for project_data.
 * `request(body)` must resolve to an array of rows.
 */
export async function runGscInsights({ request, site, days = 90, searchType = "Web", device = "All", limit = 500 }) {
  const { currentStart, currentEnd, previousStart, previousEnd } = getInsightsWindow(days);
  const base = { searchType, device };
  const current = { ...base, startDate: currentStart, endDate: currentEnd };
  const previous = { ...base, startDate: previousStart, endDate: previousEnd };
  const [dailyRows, previousDailyRows, queryRows, previousQueryRows, pageRows, previousPageRows, queryPageRows, deviceRows] =
    await Promise.all([
      request(buildRequestBody({ ...current, dimensions: ["date"], rowLimit: 1000 })),
      request(buildRequestBody({ ...previous, dimensions: ["date"], rowLimit: 1000 })),
      request(buildRequestBody({ ...current, dimensions: ["query"], rowLimit: 25000 })),
      request(buildRequestBody({ ...previous, dimensions: ["query"], rowLimit: 25000 })),
      request(buildRequestBody({ ...current, dimensions: ["page"], rowLimit: 25000 })),
      request(buildRequestBody({ ...previous, dimensions: ["page"], rowLimit: 25000 })),
      request(buildRequestBody({ ...current, dimensions: ["query", "page"], rowLimit: 25000 })),
      request(buildRequestBody({ ...current, dimensions: ["device"], rowLimit: 50 })),
    ]);

  const summary = buildSiteSummary({ siteUrl: site, url: site, domain: site.replace(/^sc-domain:/, "") }, dailyRows, previousDailyRows);
  const keywords = buildKeywordRows(queryRows, queryPageRows, previousQueryRows);
  const pages = buildPageRows(pageRows, queryPageRows, previousPageRows);

  return {
    signedIn: true,
    selectedSite: site,
    days,
    searchType,
    device,
    range: { startDate: formatDateISO(currentStart), endDate: formatDateISO(currentEnd) },
    previousRange: { startDate: formatDateISO(previousStart), endDate: formatDateISO(previousEnd) },
    summary,
    dailyData: summary.dailyData,
    totals: { keywords: keywords.length, pages: pages.length },
    keywords: keywords.slice(0, limit),
    pages: pages.slice(0, limit),
    devices: buildDeviceRows(deviceRows),
    lowHangingFruit: buildLowHangingFruit(keywords),
    cannibalization: buildCannibalization(queryPageRows),
    positionBuckets: buildPositionBuckets(keywords),
    ctrByPosition: buildCtrByPosition(keywords),
  };
}
