export const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
export const NUMBERS = "0123456789".split("");

export const AUTOCOMPLETE_REGIONS = [
  { name: "United States", gl: "US", hl: "en" },
  { name: "United Kingdom", gl: "GB", hl: "en" },
  { name: "Pakistan", gl: "PK", hl: "en" },
  { name: "India", gl: "IN", hl: "en" },
  { name: "Canada", gl: "CA", hl: "en" },
  { name: "Australia", gl: "AU", hl: "en" },
  { name: "Germany", gl: "DE", hl: "de" },
  { name: "France", gl: "FR", hl: "fr" },
  { name: "Spain", gl: "ES", hl: "es" },
  { name: "Brazil", gl: "BR", hl: "pt" },
];

export const DATAFORSEO_LOCATIONS = [
  { code: 2840, country: "United States", language: "en" },
  { code: 2826, country: "United Kingdom", language: "en" },
  { code: 2586, country: "Pakistan", language: "en" },
  { code: 2356, country: "India", language: "en" },
  { code: 2124, country: "Canada", language: "en" },
  { code: 2036, country: "Australia", language: "en" },
  { code: 2276, country: "Germany", language: "de" },
  { code: 2250, country: "France", language: "fr" },
  { code: 2724, country: "Spain", language: "es" },
  { code: 2076, country: "Brazil", language: "pt" },
];

export const UBERSUGGEST_CATEGORIES = {
  questions: {
    label: "Questions",
    modifiers: ["who", "what", "where", "when", "why", "how", "can", "are", "is", "which"],
    subModifiers: { how: ["how much", "how many"] },
    buildQuery: (keyword, modifier) => `${modifier} ${keyword}`,
  },
  prepositions: {
    label: "Prepositions",
    modifiers: ["to", "with", "for", "near", "without", "is", "from", "at", "by", "in"],
    buildQuery: (keyword, modifier) => `${keyword} ${modifier}`,
  },
  comparisons: {
    label: "Comparisons",
    modifiers: ["versus", "and", "or", "like", "other"],
    buildQuery: (keyword, modifier) => `${keyword} ${modifier}`,
  },
};

export function uniqueKeywords(values) {
  const seen = new Set();
  return values.filter((value) => {
    const keyword = String(value || "").trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchAutocomplete(query, region = AUTOCOMPLETE_REGIONS[0]) {
  const params = new URLSearchParams({
    q: query,
    hl: region.hl || "en",
    gl: region.gl || "US",
  });
  const response = await fetch(`/api/autocomplete?${params.toString()}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Could not fetch Google autocomplete suggestions");
  }

  return uniqueKeywords(data.suggestions || []);
}

export async function fetchAutocompleteBatch(tasks, { batchSize = 4, onProgress } = {}) {
  const results = {};

  for (let index = 0; index < tasks.length; index += batchSize) {
    const batch = tasks.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (task) => ({
        key: task.key,
        suggestions: await fetchAutocomplete(task.query, task.region),
      }))
    );

    for (const result of batchResults) {
      results[result.key] = uniqueKeywords([
        ...(results[result.key] || []),
        ...result.suggestions,
      ]);
    }

    onProgress?.(Math.min(100, Math.round(((index + batch.length) / tasks.length) * 100)));
  }

  return results;
}

export function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadText(filename, csv, "text/csv;charset=utf-8");
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return number.toLocaleString();
}

export function formatDateISO(value) {
  return (value instanceof Date ? value : new Date(value)).toISOString().split("T")[0];
}

export function formatDateShort(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function getSiteDomain(siteUrl = "") {
  const cleaned = siteUrl.replace(/^sc-domain:/, "");
  try {
    const normalized = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return cleaned.replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
  }
}

export function getSitePrettyUrl(siteUrl = "") {
  if (!siteUrl) return "";
  return siteUrl.replace(/^sc-domain:/, "https://").replace(/\/$/, "");
}

export function getBrandStem(siteUrl = "") {
  const domain = getSiteDomain(siteUrl);
  return (domain.split(".")[0] || domain).toLowerCase();
}

export function getPageDisplay(rawUrl, siteUrl = "") {
  if (!rawUrl) return "/";
  try {
    const parsed = new URL(rawUrl);
    const siteBase = getSiteDomain(siteUrl);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (siteBase && host === siteBase) {
      return (parsed.pathname || "/").replace(/\/+$/, "") || "/";
    }
    return `${host}${parsed.pathname}`;
  } catch {
    return rawUrl;
  }
}

export function pctChange(current = 0, previous = 0) {
  if (!previous) return current > 0 ? Infinity : 0;
  return ((current - previous) / previous) * 100;
}

export function formatPctChange(value) {
  if (value === Infinity) return "+∞%";
  if (value === -Infinity) return "-∞%";
  if (!Number.isFinite(value) || value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) < 10 ? 1 : 0)}%`;
}

function aggregateRows(rows, siteUrl) {
  const map = new Map();

  rows.forEach((row) => {
    const keyword = row.keys?.[0];
    const page = row.keys?.[1] || "";
    if (!keyword) return;

    const key = keyword.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        keyword,
        clicks: 0,
        impressions: 0,
        positionWeight: 0,
        positionTotal: 0,
        pages: new Map(),
      });
    }

    const entry = map.get(key);
    const clicks = Number(row.clicks || 0);
    const impressions = Number(row.impressions || 0);
    const position = Number(row.position || 0);
    entry.clicks += clicks;
    entry.impressions += impressions;
    entry.positionTotal += position * Math.max(impressions, 1);
    entry.positionWeight += Math.max(impressions, 1);

    if (page) {
      const existing = entry.pages.get(page) || {
        url: page,
        display: getPageDisplay(page, siteUrl),
        clicks: 0,
        impressions: 0,
      };
      existing.clicks += clicks;
      existing.impressions += impressions;
      entry.pages.set(page, existing);
    }
  });

  return map;
}

export function buildKeywordRows(currentRows = [], previousRows = [], siteUrl = "") {
  const currentMap = aggregateRows(currentRows, siteUrl);
  const previousMap = aggregateRows(previousRows, siteUrl);
  const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);

  return Array.from(keys, (key) => {
    const current = currentMap.get(key) || {};
    const previous = previousMap.get(key) || {};
    const currentPages = Array.from((current.pages || new Map()).values()).sort(
      (a, b) => b.impressions - a.impressions
    );
    const previousPages = Array.from((previous.pages || new Map()).values()).sort(
      (a, b) => b.impressions - a.impressions
    );
    const pages = currentPages.length ? currentPages : previousPages;
    const topPage = pages[0]?.url || "";
    const position = current.positionWeight ? current.positionTotal / current.positionWeight : 0;
    const prevPosition = previous.positionWeight
      ? previous.positionTotal / previous.positionWeight
      : 0;

    return {
      keyword: current.keyword || previous.keyword || key,
      topPage,
      topPageDisplay: pages[0]?.display || "—",
      clicks: current.clicks || 0,
      prevClicks: previous.clicks || 0,
      impressions: current.impressions || 0,
      prevImpressions: previous.impressions || 0,
      position,
      prevPosition,
      positionDelta: prevPosition && position ? prevPosition - position : 0,
      clicksPct: pctChange(current.clicks || 0, previous.clicks || 0),
      impressionsPct: pctChange(current.impressions || 0, previous.impressions || 0),
      isNew: (current.impressions || 0) > 0 && !(previous.impressions || 0),
      isLost: (previous.impressions || 0) > 0 && !(current.impressions || 0),
      isLowHanging: position >= 8 && position <= 30 && (current.impressions || 0) > 0,
      pages,
    };
  });
}

export function buildCannibalizationRows(currentRows = [], previousRows = [], siteUrl = "") {
  const buildMap = (rows) => {
    const map = new Map();

    rows.forEach((row) => {
      const keyword = row.keys?.[0];
      const page = row.keys?.[1] || "";
      if (!keyword || !page) return;

      const key = keyword.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { keyword, pages: new Map() });
      }

      const entry = map.get(key);
      const existing = entry.pages.get(page) || {
        url: page,
        display: getPageDisplay(page, siteUrl),
        clicks: 0,
        impressions: 0,
        positionTotal: 0,
        positionWeight: 0,
      };
      const clicks = Number(row.clicks || 0);
      const impressions = Number(row.impressions || 0);
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.positionTotal += Number(row.position || 0) * Math.max(impressions, 1);
      existing.positionWeight += Math.max(impressions, 1);
      entry.pages.set(page, existing);
    });

    return map;
  };

  const currentMap = buildMap(currentRows);
  const previousMap = buildMap(previousRows);

  return Array.from(currentMap.entries())
    .filter(([, entry]) => entry.pages.size > 1)
    .map(([key, entry]) => {
      const pages = Array.from(entry.pages.values())
        .map((page) => ({
          ...page,
          position: page.positionWeight ? page.positionTotal / page.positionWeight : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions);
      const previous = previousMap.get(key);
      const totalImpressions = pages.reduce((sum, page) => sum + page.impressions, 0);
      const totalClicks = pages.reduce((sum, page) => sum + page.clicks, 0);
      const position =
        pages.reduce((sum, page) => sum + page.position * Math.max(page.impressions, 1), 0) /
        pages.reduce((sum, page) => sum + Math.max(page.impressions, 1), 0);

      let prevImpressions = 0;
      let prevClicks = 0;
      let prevPositionTotal = 0;
      let prevPositionWeight = 0;

      previous?.pages.forEach((page) => {
        prevImpressions += page.impressions;
        prevClicks += page.clicks;
        prevPositionTotal += page.positionTotal;
        prevPositionWeight += page.positionWeight;
      });

      const prevPosition = prevPositionWeight ? prevPositionTotal / prevPositionWeight : 0;

      return {
        keyword: entry.keyword,
        pageCount: pages.length,
        pages,
        impressions: totalImpressions,
        clicks: totalClicks,
        position,
        impressionsPct: pctChange(totalImpressions, prevImpressions),
        clicksPct: pctChange(totalClicks, prevClicks),
        positionChange: prevPosition && position ? prevPosition - position : 0,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}
