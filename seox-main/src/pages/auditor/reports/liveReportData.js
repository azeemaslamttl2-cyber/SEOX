export function itemUrl(item) {
  return typeof item === "string" ? item : item?.url || "";
}

export function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hostKey(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isInternalLink(sourceUrl, targetUrl) {
  const sourceHost = hostKey(sourceUrl);
  const targetHost = hostKey(targetUrl);
  return Boolean(sourceHost && targetHost && sourceHost === targetHost);
}

export function classifyContentType(contentType, url, typeHint = "") {
  const ct = String(contentType || "").toLowerCase();
  const hint = String(typeHint || "").toLowerCase();
  const path = (() => {
    try {
      return new URL(url || "").pathname.toLowerCase();
    } catch {
      return String(url || "").toLowerCase();
    }
  })();

  if (/text\/html|application\/xhtml/.test(ct)) return "html";
  if (/text\/css/.test(ct) || hint.includes("css") || /\.css(?:[?#]|$)/i.test(path)) return "css";
  if (/javascript|ecmascript/.test(ct) || hint.includes("javascript") || /\.m?js(?:[?#]|$)/i.test(path)) return "javascript";
  if (/image\//.test(ct) || hint.includes("image") || /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp)(?:[?#]|$)/i.test(path)) return "image";
  if (/xml/.test(ct) || /\.xml(?:[?#]|$)/i.test(path)) return "xml";
  if (!ct && !/\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|avif|bmp|xml|json|woff2?|ttf|eot|pdf|zip|mp[34]|avi|mov)(?:[?#]|$)/i.test(path)) return "html";
  return "other";
}

export function isHtmlRow(row) {
  return classifyContentType(row?.contentType, row?.url) === "html";
}

export function isBlockedByRobots(row) {
  return Boolean(row?.robotsTxtBlocked || row?.blockedByRobotsTxt || row?.audit?.blockedByRobotsTxt);
}

export function statusBucket(status) {
  const code = Number(status || 0);
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500) return "5xx";
  return "Error";
}

export function statusSegments(rows) {
  const counts = new Map();
  rows.forEach((row) => counts.set(statusBucket(row.status), (counts.get(statusBucket(row.status)) || 0) + 1));
  return [
    { label: "Success (2xx)", key: "2xx", color: "#34d399" },
    { label: "Redirect (3xx)", key: "3xx", color: "#fbbf24" },
    { label: "Client error (4xx)", key: "4xx", color: "#f97316" },
    { label: "Server error (5xx)", key: "5xx", color: "#f43f5e" },
    { label: "Fetch error", key: "Error", color: "#64748b" },
  ]
    .map((item) => ({ label: item.label, value: counts.get(item.key) || 0, color: item.color }))
    .filter((item) => item.value > 0);
}

export function protocolSegments(rows) {
  const https = rows.filter((row) => String(row.url || "").startsWith("https://")).length;
  const http = rows.filter((row) => String(row.url || "").startsWith("http://")).length;
  return [
    { label: "HTTPS", value: https, color: "#34d399" },
    { label: "HTTP", value: http, color: "#fbbf24" },
  ].filter((item) => item.value > 0);
}

export function fileSizeSegments(rows) {
  const light = rows.filter((row) => Number(row.sizeKb || 0) > 0 && Number(row.sizeKb || 0) < 100).length;
  const medium = rows.filter((row) => Number(row.sizeKb || 0) >= 100 && Number(row.sizeKb || 0) <= 500).length;
  const heavy = rows.filter((row) => Number(row.sizeKb || 0) > 500).length;
  const unknown = rows.filter((row) => !Number(row.sizeKb || 0)).length;
  return [
    { label: "Light: <100 KB", value: light, color: "#34d399" },
    { label: "Medium: 100-500 KB", value: medium, color: "#fbbf24" },
    { label: "Heavy: >500 KB", value: heavy, color: "#f97316" },
    { label: "Unknown", value: unknown, color: "#64748b" },
  ].filter((item) => item.value > 0);
}

export function loadTimeSegments(rows) {
  const fast = rows.filter((row) => Number(row.loadTime || 0) > 0 && Number(row.loadTime || 0) < 500).length;
  const medium = rows.filter((row) => Number(row.loadTime || 0) >= 500 && Number(row.loadTime || 0) <= 1000).length;
  const slow = rows.filter((row) => Number(row.loadTime || 0) > 1000).length;
  const unknown = rows.filter((row) => !Number(row.loadTime || 0)).length;
  return [
    { label: "Fast: <500 ms", value: fast, color: "#34d399" },
    { label: "Medium: 500-1000 ms", value: medium, color: "#fbbf24" },
    { label: "Slow: >1000 ms", value: slow, color: "#f97316" },
    { label: "Unknown", value: unknown, color: "#64748b" },
  ].filter((item) => item.value > 0);
}

export function resourceRows(latestUrls, kind) {
  return (latestUrls || []).filter((row) => classifyContentType(row.contentType, row.url) === kind);
}

export function resourceStats(latestUrls, kind) {
  const rows = resourceRows(latestUrls, kind);
  return {
    rows,
    crawled: rows.length,
    redirects: rows.filter((row) => row.status >= 300 && row.status < 400).length,
    broken: rows.filter((row) => row.status === 0 || row.status >= 400).length,
    blocked: rows.filter(isBlockedByRobots).length,
    statusSegments: statusSegments(rows),
    protocolSegments: protocolSegments(rows),
    fileSizeSegments: fileSizeSegments(rows),
    loadTimeSegments: loadTimeSegments(rows),
  };
}

export function imageStats(latestUrls, auditIssues = {}) {
  const base = resourceStats(latestUrls, "image");
  const imageResources = [];
  (latestUrls || []).forEach((row) => {
    (row.resources || []).forEach((resource) => {
      const url = itemUrl(resource);
      if (classifyContentType("", url, resource?.type) === "image") imageResources.push(resource);
    });
  });
  const missingAlt = Number(auditIssues?.["missing-alt-text"]?.crawled || 0) ||
    (latestUrls || []).reduce((sum, row) => sum + Number(row.audit?.missingImageAltCount || 0), 0);
  const totalImages = imageResources.length || base.crawled;
  const setAlt = Math.max(0, totalImages - missingAlt);
  const subtypeCounts = new Map();
  const urls = [
    ...base.rows.map((row) => row.url),
    ...imageResources.map((resource) => itemUrl(resource)),
  ].filter(Boolean);
  urls.forEach((url) => {
    const ext = (() => {
      try {
        return new URL(url).pathname.split(".").pop()?.toLowerCase() || "other";
      } catch {
        return String(url).split(".").pop()?.toLowerCase() || "other";
      }
    })();
    const label = ["jpg", "jpeg"].includes(ext) ? "JPG" : ext === "png" ? "PNG" : ext === "webp" ? "WebP" : ext === "svg" ? "SVG" : "Other";
    subtypeCounts.set(label, (subtypeCounts.get(label) || 0) + 1);
  });

  return {
    ...base,
    totalImages,
    altSegments: [
      { label: "Set", value: setAlt, color: "#34d399" },
      { label: "Missing", value: missingAlt, color: "#f43f5e" },
    ].filter((item) => item.value > 0),
    subtypeSegments: Array.from(subtypeCounts.entries()).map(([label, value], index) => ({
      label,
      value,
      color: ["#f97316", "#fbbf24", "#34d399", "#60a5fa", "#a855f7"][index % 5],
    })),
  };
}

export function externalLinkStats(latestUrls) {
  const statusByUrl = new Map((latestUrls || []).map((row) => [row.url, row.status ?? null]));
  const external = [];
  (latestUrls || []).forEach((source) => {
    [...(source.links || []), ...(source.resources || [])].forEach((item) => {
      const target = itemUrl(item);
      if (!target || isInternalLink(source.url, target)) return;
      external.push({ source: source.url, target, status: statusByUrl.get(target) ?? null });
    });
  });
  const statusRows = external.map((row) => ({ status: row.status ?? 0, url: row.target }));
  const domains = new Map();
  external.forEach((row) => {
    const host = hostKey(row.target);
    if (!host) return;
    domains.set(host, (domains.get(host) || 0) + 1);
  });
  const https = external.filter((row) => row.target.startsWith("https://")).length;
  const http = external.filter((row) => row.target.startsWith("http://")).length;

  return {
    total: external.length,
    broken: external.filter((row) => row.status === 0 || Number(row.status) >= 400).length,
    redirects: external.filter((row) => Number(row.status) >= 300 && Number(row.status) < 400).length,
    statusSegments: [
      ...statusSegments(statusRows.filter((row) => row.status)),
      { label: "Not crawled", value: external.filter((row) => row.status === null).length, color: "#52525b" },
    ].filter((item) => item.value > 0),
    protocolSegments: [
      { label: "HTTPS", value: https, color: "#34d399" },
      { label: "HTTP", value: http, color: "#fbbf24" },
    ].filter((item) => item.value > 0),
    domains: Array.from(domains.entries())
      .map(([domain, links]) => ({ domain, links }))
      .sort((a, b) => b.links - a.links)
      .slice(0, 12),
  };
}

export function htmlRows(latestUrls) {
  return (latestUrls || []).filter(isHtmlRow);
}

export function pageFieldValue(row, field) {
  if (!row) return "";
  if (field === "title") return row.title || row.audit?.titleText || "";
  if (field === "description") return row.metaDescription || row.audit?.metaDescriptionText || "";
  if (field === "h1") return row.h1 || row.audit?.h1Text || "";
  if (field === "content") return row.contentText || row.audit?.contentText || "";
  return "";
}

export function duplicateClusters(latestUrls, field) {
  const groups = new Map();
  htmlRows(latestUrls).forEach((row) => {
    const value = pageFieldValue(row, field);
    const key = normalizeText(value);
    if (!key) return;
    const current = groups.get(key) || {
      field,
      value,
      key,
      rows: [],
    };
    current.rows.push(row);
    groups.set(key, current);
  });
  return Array.from(groups.values())
    .filter((group) => group.rows.length > 1)
    .sort((a, b) => b.rows.length - a.rows.length || a.value.localeCompare(b.value));
}

export function duplicateSummary(latestUrls) {
  const pages = htmlRows(latestUrls);
  return ["title", "description", "h1", "content"].map((field) => {
    const clusters = duplicateClusters(pages, field);
    const duplicateUrls = new Set(clusters.flatMap((cluster) => cluster.rows.map((row) => row.url)));
    return {
      field,
      clusters,
      duplicateUrls: duplicateUrls.size,
      percent: pages.length ? Math.round((duplicateUrls.size / pages.length) * 100) : 0,
    };
  });
}

export function linkRows(latestUrls) {
  const statusByUrl = new Map((latestUrls || []).map((row) => [row.url, row.status ?? null]));
  const rows = [];

  (latestUrls || []).forEach((source) => {
    const sourceUrl = source.url || "";
    const discovered = [
      ...(source.links || []).map((item) => ({ item, resource: false })),
      ...(source.resources || []).map((item) => ({ item, resource: true })),
    ];

    discovered.forEach(({ item, resource }) => {
      const target = itemUrl(item);
      if (!sourceUrl || !target) return;
      const internal = isInternalLink(sourceUrl, target);
      rows.push({
        source: sourceUrl,
        target,
        sourceStatus: source.status ?? null,
        targetStatus: statusByUrl.get(target) ?? null,
        anchor: typeof item === "string" ? "" : item.anchor || "",
        nofollow: typeof item === "string" ? false : Boolean(item.nofollow),
        type: typeof item === "string" ? "Href link" : item.type || (resource ? "Resource" : "Href link"),
        internal,
        resource,
      });
    });
  });

  return rows;
}

export function linkStats(latestUrls) {
  const rows = linkRows(latestUrls);
  const internalRows = rows.filter((row) => row.internal);
  const externalRows = rows.filter((row) => !row.internal);
  const broken = (row) => row.targetStatus === 0 || Number(row.targetStatus) >= 400;
  const notCrawled = (row) => row.targetStatus === null;
  const anchorCounts = new Map();
  const internalAnchorCounts = new Map();
  const externalAnchorCounts = new Map();
  const incomingByPage = new Map();
  const incomingByDomain = new Map();

  rows.forEach((row) => {
    const anchor = normalizeText(row.anchor);
    if (anchor) {
      const current = anchorCounts.get(anchor) || { label: row.anchor.trim(), value: 0 };
      current.value += 1;
      anchorCounts.set(anchor, current);
      const typedCounts = row.internal ? internalAnchorCounts : externalAnchorCounts;
      const typed = typedCounts.get(anchor) || { label: row.anchor.trim(), value: 0 };
      typed.value += 1;
      typedCounts.set(anchor, typed);
    }
    if (row.internal) {
      const current = incomingByPage.get(row.target) || { label: row.target, href: row.target, value: 0 };
      current.value += 1;
      incomingByPage.set(row.target, current);
    }
    const domain = hostKey(row.target);
    if (domain) {
      const current = incomingByDomain.get(domain) || { label: domain, href: `https://${domain}`, value: 0 };
      current.value += 1;
      incomingByDomain.set(domain, current);
    }
  });

  const outgoingDofollowCounts = new Map();
  (latestUrls || []).forEach((source) => {
    const count = linkRows([source]).filter((row) => row.internal && !row.nofollow).length;
    let bucket = "0";
    if (count >= 1 && count <= 10) bucket = "1-10";
    else if (count <= 50) bucket = "11-50";
    else if (count <= 100) bucket = "51-100";
    else bucket = "101+";
    outgoingDofollowCounts.set(bucket, (outgoingDofollowCounts.get(bucket) || 0) + 1);
  });

  return {
    rows,
    internal: internalRows.length,
    external: externalRows.length,
    brokenInternal: internalRows.filter(broken).length,
    brokenExternal: externalRows.filter(broken).length,
    internalDofollow: internalRows.filter((row) => !row.nofollow).length,
    internalNofollow: internalRows.filter((row) => row.nofollow).length,
    externalDofollow: externalRows.filter((row) => !row.nofollow).length,
    externalNofollow: externalRows.filter((row) => row.nofollow).length,
    notCrawled: internalRows.filter(notCrawled).length,
    anchorRows: Array.from(anchorCounts.values()).sort((a, b) => b.value - a.value).slice(0, 10),
    internalAnchorRows: Array.from(internalAnchorCounts.values()).sort((a, b) => b.value - a.value).slice(0, 10),
    externalAnchorRows: Array.from(externalAnchorCounts.values()).sort((a, b) => b.value - a.value).slice(0, 10),
    pageRows: Array.from(incomingByPage.values()).sort((a, b) => b.value - a.value).slice(0, 10),
    domainRows: Array.from(incomingByDomain.values()).sort((a, b) => b.value - a.value).slice(0, 10),
    outgoingBuckets: ["0", "1-10", "11-50", "51-100", "101+"].map((label) => ({
      depth: label,
      value: outgoingDofollowCounts.get(label) || 0,
      color: label === "0"
        ? "bg-gradient-to-r from-amber-500 to-amber-300"
        : "bg-gradient-to-r from-emerald-500 to-emerald-300",
    })),
  };
}

export function canonicalSegments(latestUrls) {
  const pages = htmlRows(latestUrls);
  let self = 0;
  let other = 0;
  let missing = 0;

  pages.forEach((row) => {
    const canonical = row.canonicalUrl || row.audit?.canonicalUrl || "";
    if (!canonical) {
      missing += 1;
      return;
    }
    try {
      const source = new URL(row.url);
      const target = new URL(canonical);
      source.hash = "";
      target.hash = "";
      if (source.toString() === target.toString()) self += 1;
      else other += 1;
    } catch {
      other += 1;
    }
  });

  return [
    { label: "Self-referencing", value: self, color: "#34d399" },
    { label: "To canonical page", value: other, color: "#f97316" },
    { label: "Not set", value: missing, color: "#71717a" },
  ].filter((item) => item.value > 0);
}

export function safeSegments(segments, emptyLabel = "No data") {
  return segments.length ? segments : [{ label: emptyLabel, value: 0, color: "#64748b" }];
}
