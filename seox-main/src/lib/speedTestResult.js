const CDN_PATTERNS = [
  "cloudflare",
  "cloudfront",
  "fastly",
  "akamai",
  "bunnycdn",
  "jsdelivr",
  "unpkg",
  "stackpath",
  "bootstrapcdn",
  "googleapis.com",
  "gstatic.com",
];

export function normalizeSpeedUrl(domain, path = "") {
  const raw = String(domain || "").trim();
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(base);
  const cleanPath = String(path || "").trim();
  if (cleanPath) url.pathname = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  url.hash = "";
  return url.toString();
}

function metricValue(lhr, key, fallback = "--") {
  return lhr?.audits?.[key]?.displayValue || fallback;
}

function scoreFromCategory(data) {
  return Math.round((data?.lighthouseResult?.categories?.performance?.score || 0) * 100);
}

function sectionFromChecks(id, title, checks) {
  return {
    id,
    title,
    passed: checks.filter((item) => item.status === "pass").length,
    total: checks.length,
    checks,
  };
}

function speedCheck(name, desc, passed, affected = 0) {
  return { name, desc, status: passed ? "pass" : "fail", tutorial: false, affected };
}

function getAuditScore(lhr, key) {
  return lhr?.audits?.[key]?.score;
}

function resourceUrl(item) {
  return typeof item === "string" ? item : item?.url || "";
}

export function collectCdnHits(resources = []) {
  return resources
    .map(resourceUrl)
    .filter(Boolean)
    .filter((url) => CDN_PATTERNS.some((pattern) => url.toLowerCase().includes(pattern)));
}

export function categorizeResources(resources = []) {
  const buckets = { css: [], javascript: [], images: [], fonts: [], videos: [], html: [], other: [] };
  for (const item of resources.slice(0, 250)) {
    const resource = typeof item === "string" ? { url: item } : { ...item };
    if (!resource.url) continue;
    const type = String(resource.type || "").toLowerCase();
    const url = resource.url.toLowerCase();
    const bucket = type.includes("css") || /\.css(?:[?#]|$)/.test(url) ? "css"
      : type.includes("javascript") || type.includes("script") || /\.m?js(?:[?#]|$)/.test(url) ? "javascript"
      : type.includes("image") || /\.(?:jpe?g|png|gif|webp|avif|svg|ico)(?:[?#]|$)/.test(url) ? "images"
      : type.includes("font") || /\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/.test(url) ? "fonts"
      : type.includes("video") || /\.(?:mp4|webm|mov)(?:[?#]|$)/.test(url) ? "videos"
      : type.includes("html") ? "html" : "other";
    buckets[bucket].push(resource);
  }
  buckets.resources = resources.slice(0, 250);
  return buckets;
}

export function buildSpeedResult(targetUrl, mobileData, desktopData, crawlData, resourceData = {}, options = {}) {
  const mobileLhr = mobileData?.lighthouseResult || {};
  const desktopLhr = desktopData?.lighthouseResult || {};
  const audits = desktopLhr.audits || mobileLhr.audits || {};
  const audit = crawlData?.audit || {};
  const resources = Array.isArray(crawlData?.resources) ? crawlData.resources : [];
  const cdnHits = collectCdnHits(resources);
  const mobileScore = scoreFromCategory(mobileData) || Math.max(0, Math.min(100, 100 - Math.round((crawlData?.loadTime || 0) / 100)));
  const desktopScore = scoreFromCategory(desktopData) || mobileScore;

  const cwv = [
    { metric: "LCP", value: metricValue(mobileLhr, "largest-contentful-paint"), full: "Largest Contentful Paint", good: getAuditScore(mobileLhr, "largest-contentful-paint") !== 0 },
    { metric: "FCP", value: metricValue(mobileLhr, "first-contentful-paint"), full: "First Contentful Paint", good: getAuditScore(mobileLhr, "first-contentful-paint") !== 0 },
    { metric: "CLS", value: metricValue(mobileLhr, "cumulative-layout-shift"), full: "Cumulative Layout Shift", good: getAuditScore(mobileLhr, "cumulative-layout-shift") !== 0 },
    { metric: "TBT", value: metricValue(mobileLhr, "total-blocking-time"), full: "Total Blocking Time", good: getAuditScore(mobileLhr, "total-blocking-time") !== 0 },
    { metric: "SI", value: metricValue(mobileLhr, "speed-index"), full: "Speed Index", good: getAuditScore(mobileLhr, "speed-index") !== 0 },
    { metric: "TTFB", value: metricValue(mobileLhr, "server-response-time", `${crawlData?.loadTime || 0} ms`), full: "Server Response Time", good: (crawlData?.loadTime || 0) < 800 },
  ];

  const sections = [
    sectionFromChecks("cache", "Caching & Compression", [
      speedCheck("Enable Text Compression", audits["uses-text-compression"]?.title || "Text compression enabled", getAuditScore(mobileLhr, "uses-text-compression") !== 0),
      speedCheck("Efficient Cache Policy", audits["uses-long-cache-ttl"]?.title || "Static assets use cache policy", getAuditScore(mobileLhr, "uses-long-cache-ttl") !== 0),
    ]),
    sectionFromChecks("css", "CSS Optimization", [
      speedCheck("Remove Unused CSS", audits["unused-css-rules"]?.title || "Unused CSS check", getAuditScore(mobileLhr, "unused-css-rules") !== 0),
      speedCheck("Avoid Render Blocking", audits["render-blocking-resources"]?.title || "Render-blocking resources check", getAuditScore(mobileLhr, "render-blocking-resources") !== 0),
    ]),
    sectionFromChecks("js", "JavaScript Optimization", [
      speedCheck("Remove Unused JavaScript", audits["unused-javascript"]?.title || "Unused JavaScript check", getAuditScore(mobileLhr, "unused-javascript") !== 0),
      speedCheck("Minimize Main Thread Work", audits["mainthread-work-breakdown"]?.title || "Main-thread work check", getAuditScore(mobileLhr, "mainthread-work-breakdown") !== 0),
      speedCheck("Avoid Legacy JavaScript", audits["legacy-javascript"]?.title || "Legacy JavaScript check", getAuditScore(mobileLhr, "legacy-javascript") !== 0),
    ]),
    sectionFromChecks("html", "HTML Optimization", [
      speedCheck("Has Valid Doctype", "Valid doctype present", true),
      speedCheck("DOM Size Healthy", audits["dom-size"]?.title || "DOM size check", getAuditScore(mobileLhr, "dom-size") !== 0),
      speedCheck("Meta Viewport Present", "Page exposes viewport metadata", !audit.noindex),
    ]),
    sectionFromChecks("images", "Image Optimization", [
      speedCheck("Images Have Alt Text", "Images should have descriptive alt attributes", (audit.missingImageAltCount || 0) === 0, audit.missingImageAltCount || 0),
      speedCheck("Properly Size Images", audits["uses-responsive-images"]?.title || "Responsive image sizing", getAuditScore(mobileLhr, "uses-responsive-images") !== 0),
      speedCheck("Serve Next-Gen Formats", audits["modern-image-formats"]?.title || "Modern image formats", getAuditScore(mobileLhr, "modern-image-formats") !== 0),
    ]),
    sectionFromChecks("network", "Network & CDN", [
      speedCheck("Minimize Redirects", audits.redirects?.title || "Avoid redirect chains", getAuditScore(mobileLhr, "redirects") !== 0),
      speedCheck("No Mixed Content", "HTTPS pages should not load HTTP resources", (audit.mixedContentCount || 0) === 0, audit.mixedContentCount || 0),
      speedCheck("CDN or Edge Resources Detected", "Static assets should be served through fast edge infrastructure when possible", cdnHits.length > 0, cdnHits.length),
      speedCheck("Resource Count Reasonable", "Too many page resources can slow crawling and rendering", resources.length <= 120, resources.length),
    ]),
  ];

  const result = {
    url: targetUrl,
    analyzedAt: new Date().toISOString(),
    mobile: { score: mobileScore, label: "Mobile Score" },
    desktop: { score: desktopScore, label: "Desktop Score" },
    cwv,
    sections,
    opportunities: Object.values(audits)
      .filter((item) => item?.details?.overallSavingsMs || item?.details?.overallSavingsBytes)
      .slice(0, 5)
      .map((item) => ({ name: item.title, savings: item.displayValue || "Potential improvement" })),
    resourceSummary: {
      totalResources: resources.length,
      cdnResources: cdnHits.length,
      cdnExamples: cdnHits.slice(0, 5),
    },
    resourceDetails: resourceData && Object.keys(resourceData).length ? resourceData : categorizeResources(resources),
  };

  if (options.includeRaw) {
    result.resources = resources;
    result.crawl = crawlData;
    result.pagespeed = { mobile: mobileData, desktop: desktopData };
  }

  return result;
}