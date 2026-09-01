const CRAWL_ENDPOINT = "/api/crawler/fetch";

const ASSET_EXTENSIONS = new Set([
  "css",
  "js",
  "mjs",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "ico",
  "avif",
  "pdf",
  "xml",
  "txt",
  "json",
]);

const EXCLUDED_QUERY_PARAMS = new Set([
  "add-to-cart",
  "currency",
  "filter",
  "filter_by",
  "max_price",
  "min_price",
  "orderby",
  "order",
  "price",
  "rating",
  "replytocom",
  "review_sort_by",
  "sort",
  "sort_by",
  "stars",
]);

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
  "wbraid",
]);

const EXCLUDED_QUERY_PREFIXES = [
  "filter_",
  "pa_",
  "attribute_",
  "review_",
];

export function normalizeCrawlUrl(input) {
  if (!input) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProtocol);
    url.hash = "";
    if (hasExcludedQuery(url) || hasExcludedPath(url)) return "";
    stripTrackingQuery(url);
    return url.toString();
  } catch {
    return "";
  }
}

export function shouldExcludeCrawlUrl(input) {
  if (!input) return true;
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProtocol);
    return hasExcludedQuery(url) || hasExcludedPath(url);
  } catch {
    return true;
  }
}

export function createCrawlSession(project) {
  const rootUrl = normalizeCrawlUrl(project.fullUrl || project.domain);
  const root = new URL(rootUrl);
  const seedUrls = [
    rootUrl,
    new URL("/robots.txt", root.origin).toString(),
    new URL("/sitemap.xml", root.origin).toString(),
  ];
  const seen = new Set(seedUrls);

  return {
    baseUrl: rootUrl,
    baseOrigin: root.origin,
    baseHost: root.hostname.replace(/^www\./, ""),
    queue: seedUrls,
    seen,
    sitemapUrls: new Set(),
    inFlight: 0,
    disallowedPaths: [],
    idCounter: 0,
  };
}

export async function fetchCrawlTarget(url) {
  const started = performance.now();
  const response = await fetch(`${CRAWL_ENDPOINT}?url=${encodeURIComponent(url)}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Could not crawl ${url}`);
  }
  if (!payload || typeof payload.status !== "number") {
    throw new Error("Crawler API returned an invalid response");
  }
  return {
    ...payload,
    loadTime: Math.max(1, Math.round(performance.now() - started)),
  };
}

export function crawlResultToRow(result, session) {
  session.idCounter += 1;
  const status = result.status || 0;
  const contentType = result.contentType || "unknown";
  const outlinks = Array.isArray(result.links) ? result.links.length : 0;

  return {
    id: `${session.baseHost}-${Date.now()}-${session.idCounter}`,
    time: new Date(),
    url: result.finalUrl || result.url,
    status,
    contentType,
    loadTime: result.loadTime || 0,
    sizeKb: Number(result.sizeKb || 0),
    outlinks,
    title: result.audit?.titleText || "",
    metaDescription: result.audit?.metaDescriptionText || "",
    h1: result.audit?.h1Text || "",
    contentText: result.contentText || "",
    headings: Array.isArray(result.headings) ? result.headings : [],
    canonicalUrl: result.audit?.canonicalUrl || "",
    robotsMeta: result.audit?.robotsMeta || "",
    xRobotsTag: result.xRobotsTag || "",
    links: normalizeDiscoveredItems(result.links, "Href link"),
    resources: normalizeDiscoveredItems(result.resources, "Resource"),
    audit: result.audit || {},
  };
}

export function errorToRow(url, error, session) {
  session.idCounter += 1;
  return {
    id: `${session.baseHost}-${Date.now()}-${session.idCounter}`,
    time: new Date(),
    url,
    status: 0,
    contentType: error?.message || "Fetch error",
    loadTime: 0,
    sizeKb: 0,
    outlinks: 0,
  };
}

export function collectDiscoveredUrls(result) {
  return [
    ...(Array.isArray(result.links) ? result.links : []),
    ...(Array.isArray(result.resources) ? result.resources : []),
    ...(Array.isArray(result.sitemaps) ? result.sitemaps : []),
  ].map(discoveredUrl).filter(Boolean);
}

function normalizeDiscoveredItems(items, fallbackType) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") return { url: item, type: fallbackType };
      if (!item?.url) return null;
      return {
        ...item,
        type: item.type || fallbackType,
      };
    })
    .filter(Boolean);
}

function discoveredUrl(item) {
  return typeof item === "string" ? item : item?.url || "";
}

export function updateRobotsRules(session, result) {
  if (Array.isArray(result.disallow)) {
    session.disallowedPaths = [
      ...new Set([...session.disallowedPaths, ...result.disallow.filter(Boolean)]),
    ];
  }
}

export function enqueueDiscoveredUrls(session, project, urls, maxUrls) {
  for (const rawUrl of urls) {
    const next = normalizeCrawlUrl(rawUrl);
    if (!next) continue;
    if (session.seen.has(next)) continue;
    if (!isInScope(next, session, project)) continue;
    if (isDisallowed(next, session, project)) continue;
    if (session.seen.size >= maxUrls) break;

    session.seen.add(next);
    session.queue.push(next);
  }
}

export function shouldParseForLinks(contentType = "") {
  const lowered = contentType.toLowerCase();
  return (
    lowered.includes("text/html") ||
    lowered.includes("xml") ||
    lowered.includes("text/plain")
  );
}

export function isLikelyAsset(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    return ASSET_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function isInScope(rawUrl, session, project) {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;

    const base = new URL(session.baseUrl);
    const host = url.hostname.replace(/^www\./, "");
    const sameHost = host === session.baseHost;
    const subdomain = host.endsWith(`.${session.baseHost}`);

    if (project.scope === "exact") return url.origin === base.origin;
    if (project.scope === "path") {
      const basePath = base.pathname === "/" ? "/" : base.pathname.replace(/\/+$/, "");
      return url.origin === base.origin && url.pathname.startsWith(basePath);
    }
    return sameHost || subdomain;
  } catch {
    return false;
  }
}

function isDisallowed(rawUrl, session, project) {
  if (!project.respectRobots) return false;
  try {
    const url = new URL(rawUrl);
    return session.disallowedPaths.some((path) => {
      if (!path || path === "/") return path === "/";
      return url.pathname.startsWith(path);
    });
  } catch {
    return false;
  }
}

function hasExcludedQuery(url) {
  if (url.pathname.toLowerCase() === "/xmlrpc.php" && url.searchParams.has("rsd")) {
    return true;
  }
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (EXCLUDED_QUERY_PARAMS.has(normalized)) return true;
    if (EXCLUDED_QUERY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      return true;
    }
  }
  return false;
}

function hasExcludedPath(url) {
  const pathname = url.pathname.toLowerCase();
  return pathname === "/xmlrpc.php" || pathname.startsWith("/wp-json/");
}

function stripTrackingQuery(url) {
  for (const key of Array.from(url.searchParams.keys())) {
    const normalized = key.toLowerCase();
    if (TRACKING_QUERY_PARAMS.has(normalized) || normalized.startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }
}
