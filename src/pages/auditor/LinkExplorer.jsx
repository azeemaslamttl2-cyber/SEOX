import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Code2, Columns3, Download, HelpCircle, Link2, Plus, Search, X } from "lucide-react";
import { useCrawl } from "../../context/CrawlContext.jsx";

const FILTER_TABS = [
  { id: "all", label: "All links", filter: "all" },
  { id: "crawled", label: "Crawled", drop: true },
  { id: "internal", label: "Internal", drop: true },
  { id: "external", label: "External", drop: true },
  { id: "resources", label: "Resources", drop: true },
  { id: "redirects", label: "Redirects", drop: true },
  { id: "canonicals", label: "Canonicals", drop: true },
  { id: "hreflangs", label: "Hreflangs", drop: true },
];

const SEARCH_SCOPES = [
  { key: "source", label: "Source URL" },
  { key: "target", label: "Target URL" },
  { key: "anchor", label: "Anchor" },
  { key: "type", label: "Link type" },
];

const ADVANCED_FIELDS = [
  { key: "source", label: "Source URL" },
  { key: "target", label: "Target URL" },
  { key: "anchor", label: "Anchor" },
  { key: "type", label: "Link type" },
  { key: "sourceStatus", label: "Source status code" },
  { key: "targetStatus", label: "Target status code" },
  { key: "nofollow", label: "Is nofollow" },
];

const ADVANCED_OPERATORS = [
  { key: "exists", label: "Exists", needsValue: false },
  { key: "not-exists", label: "Does not exist", needsValue: false },
  { key: "contains", label: "Contains", needsValue: true },
  { key: "not-contains", label: "Does not contain", needsValue: true },
  { key: "equals", label: "Equals", needsValue: true },
  { key: "not-equals", label: "Does not equal", needsValue: true },
  { key: "greater-than", label: "Greater than", needsValue: true },
  { key: "less-than", label: "Less than", needsValue: true },
];

const DEFAULT_ADVANCED_RULE = { field: "source", operator: "exists", value: "" };
const PAGE_SIZE = 50;

function itemUrl(item) {
  return typeof item === "string" ? item : item?.url || "";
}

function isInternalLink(sourceUrl, targetUrl) {
  try {
    const source = new URL(sourceUrl);
    const target = new URL(targetUrl);
    return source.hostname.replace(/^www\./, "") === target.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function countRows(rows, predicate) {
  return rows.reduce((count, row) => (predicate(row) ? count + 1 : count), 0);
}

function isSuccessStatus(status) {
  return Number(status) >= 200 && Number(status) < 300;
}

function isRedirectStatus(status) {
  return Number(status) >= 300 && Number(status) < 400;
}

function isNotFoundStatus(status) {
  return Number(status) === 404;
}

function isOtherClientErrorStatus(status) {
  return Number(status) >= 400 && Number(status) < 500 && Number(status) !== 404;
}

function isServerErrorStatus(status) {
  return Number(status) >= 500;
}

function isBrokenStatus(status) {
  return Number(status) === 0 || Number(status) >= 400;
}

function hasTargetStatus(link, predicate) {
  return link.tStatus !== null && predicate(link.tStatus);
}

function isHrefLink(link) {
  return link.linkKind === "href";
}

function isResourceLink(link) {
  return link.linkKind === "resource";
}

function isImageLink(link) {
  return link.resourceKind === "Image";
}

function isJavaScriptLink(link) {
  return link.resourceKind === "JavaScript";
}

function isCssLink(link) {
  return link.resourceKind === "CSS";
}

function isCanonicalLink(link) {
  return link.linkKind === "canonical" || link.type === "Canonical";
}

function isHreflangLink(link) {
  return link.linkKind === "hreflang" || link.type === "Hreflang";
}

function isInternalHref(link) {
  return isHrefLink(link) && link.internal;
}

function isExternalHref(link) {
  return isHrefLink(link) && !link.internal;
}

function isHttpsToHttp(link) {
  return /^https:/i.test(link.source || "") && /^http:/i.test(link.target || "");
}

function relationTokens(item) {
  const rel = typeof item === "string" ? "" : item?.rel || item?.relationship || "";
  if (Array.isArray(rel)) return rel.map((part) => String(part).toLowerCase());
  return String(rel).toLowerCase().split(/[\s,]+/).filter(Boolean);
}

function targetNoindex(link, rowByUrl) {
  const target = rowByUrl.get(link.target);
  const audit = target?.audit || {};
  const robots = [
    audit.robotsMeta,
    audit.metaRobots,
    target?.robotsMeta,
    target?.xRobotsTag,
  ].filter(Boolean).join(" ").toLowerCase();
  return Boolean(audit.noindex || /\bnoindex\b/.test(robots));
}

function targetCanonicalized(link, rowByUrl) {
  const target = rowByUrl.get(link.target);
  if (!target?.canonicalUrl) return false;
  try {
    const current = new URL(target.url);
    const canonical = new URL(target.canonicalUrl);
    current.hash = "";
    canonical.hash = "";
    return current.toString() !== canonical.toString();
  } catch {
    return target.canonicalUrl !== target.url;
  }
}

function resourceType(resource) {
  const type = String(resource?.type || "").toLowerCase();
  const url = itemUrl(resource);
  if (type.includes("css") || /\.css(?:[?#]|$)/i.test(url)) return "CSS";
  if (type.includes("javascript") || /\.m?js(?:[?#]|$)/i.test(url)) return "JavaScript";
  if (type.includes("image") || /\.(png|jpe?g|webp|gif|svg|ico|avif)(?:[?#]|$)/i.test(url)) return "Image";
  return "Resource";
}

function isWordPressPostIdRedirect(url, status) {
  if (Number(status || 0) !== 301) return false;
  try {
    return new URL(url || "").searchParams.has("p");
  } catch {
    return false;
  }
}

/* ─── Helper: classify content type ─── */
function isHtmlContentType(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  if (/text\/html|application\/xhtml/i.test(ct)) return true;
  // If no content-type and URL doesn't look like a resource, assume HTML
  if (!ct) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      if (/\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|avif|bmp|xml|json|woff2?|ttf|eot|pdf|zip|mp[34]|avi|mov)$/i.test(path)) return false;
    } catch { /* ignore */ }
    return true;
  }
  return false;
}

/* ─── Build page list from real crawl data (HTML pages only) ─── */
function buildPagesFromCrawl(latestUrls) {
  return latestUrls
    .filter((row) =>
      row.url &&
      row.status &&
      isHtmlContentType(row.contentType, row.url) &&
      !isWordPressPostIdRedirect(row.url, row.status)
    )
    .map((row) => ({
      pr: row.status >= 200 && row.status < 300 ? Math.max(1, Math.min(60, Math.round(40 - (row.status >= 400 ? 40 : 0)))) : 0,
      url: row.url,
      status: row.status || 200,
      indexable: row.status >= 200 && row.status < 300,
      inlinks: row.outlinks || 0,
      contentType: row.contentType || "",
    }));
}

/* ─── Dynamic link generation from crawled pages (pages only, no resources) ─── */
function buildLinks(latestUrls) {
  const links = [];
  if (latestUrls.length === 0) return links;
  const statusByUrl = new Map(latestUrls.map((row) => [row.url, row.status || null]));
  const rowByUrl = new Map(latestUrls.map((row) => [row.url, row]));

  for (const source of latestUrls) {
    const missingAltUrls = new Set(source.audit?.missingImageAltUrls || []);
    for (const item of source.links || []) {
      const target = itemUrl(item);
      if (!target) continue;
      const targetStatus = statusByUrl.get(target) ?? null;
      if (isWordPressPostIdRedirect(target, targetStatus)) continue;
      const relTokens = relationTokens(item);

      links.push({
        type: typeof item === "string" ? "Href link" : item.type || "Href link",
        linkKind: "href",
        resourceKind: "",
        internal: isInternalLink(source.url, target),
        nofollow: typeof item === "string" ? false : Boolean(item.nofollow || relTokens.includes("nofollow")),
        ugc: relTokens.includes("ugc"),
        sponsored: relTokens.includes("sponsored"),
        source: source.url,
        sStatus: source.status || null,
        target,
        tStatus: targetStatus,
        noCrawl: targetStatus !== null ? "" : "Not crawled by current crawl",
        anchor: typeof item === "string" ? "" : item.anchor || "",
        img: "",
      });
    }

    if (source.canonicalUrl) {
      const canonicalStatus = statusByUrl.get(source.canonicalUrl) ?? null;
      if (!isWordPressPostIdRedirect(source.canonicalUrl, canonicalStatus)) {
        links.push({
          type: "Canonical",
          linkKind: "canonical",
          resourceKind: "",
          internal: isInternalLink(source.url, source.canonicalUrl),
          nofollow: false,
          ugc: false,
          sponsored: false,
          source: source.url,
          sStatus: source.status || null,
          target: source.canonicalUrl,
          tStatus: canonicalStatus,
          noCrawl: "",
          anchor: "",
          img: "",
        });
      }
    }

    for (const resource of source.resources || []) {
      const target = itemUrl(resource);
      if (!target) continue;
      const type = resourceType(resource);
      const targetStatus = statusByUrl.get(target) ?? null;
      if (isWordPressPostIdRedirect(target, targetStatus)) continue;

      links.push({
        type,
        linkKind: "resource",
        resourceKind: type,
        internal: isInternalLink(source.url, target),
        nofollow: false,
        ugc: false,
        sponsored: false,
        source: source.url,
        sStatus: source.status || null,
        target,
        tStatus: targetStatus,
        noCrawl: targetStatus !== null ? "" : "Not crawled by current crawl",
        anchor: "",
        img: type === "Image" ? resource.imageType || "Content" : "",
        missingAlt: type === "Image" && (
          Boolean(resource.missingAlt || resource.altMissing || resource.alt === "") ||
          missingAltUrls.has(target)
        ),
      });
    }

    const hreflangs = [
      ...(Array.isArray(source.hreflangs) ? source.hreflangs : []),
      ...(Array.isArray(source.audit?.hreflangs) ? source.audit.hreflangs : []),
    ];
    for (const hreflang of hreflangs) {
      const target = itemUrl(hreflang) || hreflang?.href || "";
      if (!target) continue;
      const targetStatus = statusByUrl.get(target) ?? null;
      links.push({
        type: "Hreflang",
        linkKind: "hreflang",
        resourceKind: "",
        internal: isInternalLink(source.url, target),
        nofollow: false,
        ugc: false,
        sponsored: false,
        source: source.url,
        sStatus: source.status || null,
        target,
        tStatus: targetStatus,
        noCrawl: targetStatus !== null ? "" : "Not crawled by current crawl",
        anchor: hreflang?.hreflang || hreflang?.lang || "",
        img: hreflang?.origin || "Page source",
      });
    }
  }

  return links.map((link) => ({
    ...link,
    targetRow: rowByUrl.get(link.target) || null,
  }));
}

/* ─── Filter logic ─── */
function legacyFilterLinks(links, activeFilter, searchQuery) {
  let filtered = links;

  // Apply category filter
  switch (activeFilter) {
    case "internal":
      filtered = filtered.filter((l) => isInternalLink(l.source, l.target));
      break;
    case "external":
      filtered = filtered.filter((l) => !isInternalLink(l.source, l.target));
      break;
    case "redirects":
      filtered = filtered.filter((l) => l.tStatus === 301 || l.tStatus === 302);
      break;
    case "broken-internal":
      filtered = filtered.filter((l) => isInternalLink(l.source, l.target) && (l.tStatus === 0 || Number(l.tStatus) >= 400));
      break;
    case "broken-external":
      filtered = filtered.filter((l) => !isInternalLink(l.source, l.target) && (l.tStatus === 0 || Number(l.tStatus) >= 400));
      break;
    case "canonicals":
      filtered = filtered.filter((l) => l.type === "Canonical");
      break;
    case "crawled":
      filtered = filtered.filter((l) => l.tStatus !== null);
      break;
    default:
      break;
  }

  // Apply text search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.source.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        l.anchor.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q)
    );
  }

  return filtered;
}

function buildFilterMenus(links) {
  const hrefLinks = links.filter(isHrefLink);
  const internalHref = links.filter(isInternalHref);
  const externalHref = links.filter(isExternalHref);
  const resources = links.filter(isResourceLink);
  const images = links.filter(isImageLink);
  const scripts = links.filter(isJavaScriptLink);
  const stylesheets = links.filter(isCssLink);
  const redirects = links.filter((link) => hasTargetStatus(link, isRedirectStatus));
  const canonicals = links.filter(isCanonicalLink);
  const hreflangs = links.filter(isHreflangLink);
  const targetRows = new Map(links.map((link) => [link.target, link.targetRow]).filter(([, row]) => row));
  const item = (label, count, filter) => ({ label, count, filter });
  const divider = (label = "") => ({ label, section: true });
  const statusItems = (baseLinks, prefix) => [
    item("Successful", countRows(baseLinks, (link) => hasTargetStatus(link, isSuccessStatus)), `${prefix}-success`),
    item("To not found", countRows(baseLinks, (link) => hasTargetStatus(link, isNotFoundStatus)), `${prefix}-not-found`),
    item("To other client errors", countRows(baseLinks, (link) => hasTargetStatus(link, isOtherClientErrorStatus)), `${prefix}-client-errors`),
    item("To server error", countRows(baseLinks, (link) => hasTargetStatus(link, isServerErrorStatus)), `${prefix}-server-error`),
    item("To redirect", countRows(baseLinks, (link) => hasTargetStatus(link, isRedirectStatus)), `${prefix}-redirect`),
  ];

  return {
    Crawled: [
      item("All crawled links", countRows(links, (link) => link.tStatus !== null), "crawled"),
      ...statusItems(links, "crawled"),
    ],
    Internal: [
      item("All internal href links", internalHref.length, "internal"),
      ...statusItems(internalHref, "internal"),
      divider(),
      item("Not crawled", countRows(internalHref, (link) => link.tStatus === null), "internal-not-crawled"),
      item("To blocked by robots.txt", countRows(internalHref, (link) => /robots/i.test(link.noCrawl || "")), "internal-blocked-robots"),
      divider(),
      item("Dofollow", countRows(internalHref, (link) => !link.nofollow), "internal-dofollow"),
      item("Nofollow", countRows(internalHref, (link) => link.nofollow), "internal-nofollow"),
      item("UGC", countRows(internalHref, (link) => link.ugc), "internal-ugc"),
      item("Sponsored", countRows(internalHref, (link) => link.sponsored), "internal-sponsored"),
      divider(),
      item("HTTPS to HTTP", countRows(internalHref, isHttpsToHttp), "internal-https-to-http"),
    ],
    External: [
      item("All external href links", externalHref.length, "external"),
      ...statusItems(externalHref, "external"),
      divider(),
      item("Not crawled", countRows(externalHref, (link) => link.tStatus === null), "external-not-crawled"),
      divider(),
      item("Dofollow", countRows(externalHref, (link) => !link.nofollow), "external-dofollow"),
      item("Nofollow", countRows(externalHref, (link) => link.nofollow), "external-nofollow"),
      item("UGC", countRows(externalHref, (link) => link.ugc), "external-ugc"),
      item("Sponsored", countRows(externalHref, (link) => link.sponsored), "external-sponsored"),
    ],
    Resources: [
      item("All resource links", resources.length, "resources"),
      divider(),
      item("All images", images.length, "resource-images"),
      item("Broken images", countRows(images, (link) => hasTargetStatus(link, isBrokenStatus)), "resource-broken-images"),
      item("Redirecting images", countRows(images, (link) => hasTargetStatus(link, isRedirectStatus)), "resource-redirecting-images"),
      item("Images missing alt text", countRows(images, (link) => link.missingAlt), "resource-images-missing-alt"),
      divider(),
      item("All JavaScript", scripts.length, "resource-javascript"),
      item("Broken JavaScript", countRows(scripts, (link) => hasTargetStatus(link, isBrokenStatus)), "resource-broken-javascript"),
      item("Redirecting JavaScript", countRows(scripts, (link) => hasTargetStatus(link, isRedirectStatus)), "resource-redirecting-javascript"),
      divider(),
      item("All CSS", stylesheets.length, "resource-css"),
      item("Broken CSS", countRows(stylesheets, (link) => hasTargetStatus(link, isBrokenStatus)), "resource-broken-css"),
      item("Redirecting CSS", countRows(stylesheets, (link) => hasTargetStatus(link, isRedirectStatus)), "resource-redirecting-css"),
      divider(),
      item("HTTPS to HTTP", countRows(resources, isHttpsToHttp), "resource-https-to-http"),
    ],
    Redirects: [
      item("All redirect links", redirects.length, "redirects"),
      divider(),
      item("To not found", 0, "redirect-to-not-found"),
      item("To other client errors", 0, "redirect-to-client-errors"),
      item("To server error", 0, "redirect-to-server-error"),
      item("To redirect", redirects.length, "redirect-to-redirect"),
      divider(),
      item("To external URL", countRows(redirects, (link) => !link.internal), "redirect-to-external"),
      item("HTTPS to HTTP", countRows(redirects, isHttpsToHttp), "redirect-https-to-http"),
    ],
    Canonicals: [
      item("All canonical links", canonicals.length, "canonicals"),
      divider(),
      item("To not found", countRows(canonicals, (link) => hasTargetStatus(link, isNotFoundStatus)), "canonical-to-not-found"),
      item("To other client errors", countRows(canonicals, (link) => hasTargetStatus(link, isOtherClientErrorStatus)), "canonical-to-client-errors"),
      item("To server error", countRows(canonicals, (link) => hasTargetStatus(link, isServerErrorStatus)), "canonical-to-server-error"),
      item("To redirect", countRows(canonicals, (link) => hasTargetStatus(link, isRedirectStatus)), "canonical-to-redirect"),
      divider(),
      item("To non-canonical", countRows(canonicals, (link) => targetCanonicalized(link, targetRows)), "canonical-to-non-canonical"),
      item("To noindex", countRows(canonicals, (link) => targetNoindex(link, targetRows)), "canonical-to-noindex"),
      item("To external URL", countRows(canonicals, (link) => !link.internal), "canonical-to-external"),
    ],
    Hreflangs: [
      item("All hreflang links", hreflangs.length, "hreflangs"),
      divider(),
      item("To not found", countRows(hreflangs, (link) => hasTargetStatus(link, isNotFoundStatus)), "hreflang-to-not-found"),
      item("To other client errors", countRows(hreflangs, (link) => hasTargetStatus(link, isOtherClientErrorStatus)), "hreflang-to-client-errors"),
      item("To server error", countRows(hreflangs, (link) => hasTargetStatus(link, isServerErrorStatus)), "hreflang-to-server-error"),
      item("To redirect", countRows(hreflangs, (link) => hasTargetStatus(link, isRedirectStatus)), "hreflang-to-redirect"),
      divider(),
      item("To non-canonical", 0, "hreflang-to-non-canonical"),
      item("To noindex", 0, "hreflang-to-noindex"),
      divider("Hreflangs origin"),
      item("Page source", countRows(hreflangs, (link) => /page source/i.test(link.img || "")), "hreflang-origin-page-source"),
      item("Sitemap", countRows(hreflangs, (link) => /sitemap/i.test(link.img || "")), "hreflang-origin-sitemap"),
      item("HTTP headers", countRows(hreflangs, (link) => /headers/i.test(link.img || "")), "hreflang-origin-http-headers"),
    ],
  };
}

function matchesLinkFilter(link, activeFilter) {
  const isInternalScoped = activeFilter.startsWith("internal");
  const scopedHref = isInternalScoped ? isInternalHref(link) : isExternalHref(link);

  switch (activeFilter) {
    case "all":
      return true;
    case "crawled":
      return link.tStatus !== null;
    case "crawled-success":
      return hasTargetStatus(link, isSuccessStatus);
    case "crawled-not-found":
      return hasTargetStatus(link, isNotFoundStatus);
    case "crawled-client-errors":
      return hasTargetStatus(link, isOtherClientErrorStatus);
    case "crawled-server-error":
      return hasTargetStatus(link, isServerErrorStatus);
    case "crawled-redirect":
      return hasTargetStatus(link, isRedirectStatus);
    case "internal":
      return isInternalHref(link);
    case "external":
      return isExternalHref(link);
    case "broken-internal":
      return isInternalHref(link) && hasTargetStatus(link, isBrokenStatus);
    case "broken-external":
      return isExternalHref(link) && hasTargetStatus(link, isBrokenStatus);
    case "internal-success":
    case "external-success":
      return scopedHref && hasTargetStatus(link, isSuccessStatus);
    case "internal-not-found":
    case "external-not-found":
      return scopedHref && hasTargetStatus(link, isNotFoundStatus);
    case "internal-client-errors":
    case "external-client-errors":
      return scopedHref && hasTargetStatus(link, isOtherClientErrorStatus);
    case "internal-server-error":
    case "external-server-error":
      return scopedHref && hasTargetStatus(link, isServerErrorStatus);
    case "internal-redirect":
    case "external-redirect":
      return scopedHref && hasTargetStatus(link, isRedirectStatus);
    case "internal-not-crawled":
    case "external-not-crawled":
      return scopedHref && link.tStatus === null;
    case "internal-blocked-robots":
      return isInternalHref(link) && /robots/i.test(link.noCrawl || "");
    case "internal-dofollow":
    case "external-dofollow":
      return scopedHref && !link.nofollow;
    case "internal-nofollow":
    case "external-nofollow":
      return scopedHref && link.nofollow;
    case "internal-ugc":
    case "external-ugc":
      return scopedHref && link.ugc;
    case "internal-sponsored":
    case "external-sponsored":
      return scopedHref && link.sponsored;
    case "internal-https-to-http":
      return isInternalHref(link) && isHttpsToHttp(link);
    case "resources":
      return isResourceLink(link);
    case "resource-images":
      return isImageLink(link);
    case "resource-broken-images":
      return isImageLink(link) && hasTargetStatus(link, isBrokenStatus);
    case "resource-redirecting-images":
      return isImageLink(link) && hasTargetStatus(link, isRedirectStatus);
    case "resource-images-missing-alt":
      return isImageLink(link) && link.missingAlt;
    case "resource-javascript":
      return isJavaScriptLink(link);
    case "resource-broken-javascript":
      return isJavaScriptLink(link) && hasTargetStatus(link, isBrokenStatus);
    case "resource-redirecting-javascript":
      return isJavaScriptLink(link) && hasTargetStatus(link, isRedirectStatus);
    case "resource-css":
      return isCssLink(link);
    case "resource-broken-css":
      return isCssLink(link) && hasTargetStatus(link, isBrokenStatus);
    case "resource-redirecting-css":
      return isCssLink(link) && hasTargetStatus(link, isRedirectStatus);
    case "resource-https-to-http":
      return isResourceLink(link) && isHttpsToHttp(link);
    case "redirects":
    case "redirect-to-redirect":
      return hasTargetStatus(link, isRedirectStatus);
    case "redirect-to-external":
      return hasTargetStatus(link, isRedirectStatus) && !link.internal;
    case "redirect-https-to-http":
      return hasTargetStatus(link, isRedirectStatus) && isHttpsToHttp(link);
    case "canonicals":
      return isCanonicalLink(link);
    case "canonical-to-not-found":
      return isCanonicalLink(link) && hasTargetStatus(link, isNotFoundStatus);
    case "canonical-to-client-errors":
      return isCanonicalLink(link) && hasTargetStatus(link, isOtherClientErrorStatus);
    case "canonical-to-server-error":
      return isCanonicalLink(link) && hasTargetStatus(link, isServerErrorStatus);
    case "canonical-to-redirect":
      return isCanonicalLink(link) && hasTargetStatus(link, isRedirectStatus);
    case "canonical-to-non-canonical":
      return isCanonicalLink(link) && targetCanonicalized(link, new Map([[link.target, link.targetRow]].filter(([, row]) => row)));
    case "canonical-to-noindex":
      return isCanonicalLink(link) && targetNoindex(link, new Map([[link.target, link.targetRow]].filter(([, row]) => row)));
    case "canonical-to-external":
      return isCanonicalLink(link) && !link.internal;
    case "hreflangs":
      return isHreflangLink(link);
    case "hreflang-to-not-found":
      return isHreflangLink(link) && hasTargetStatus(link, isNotFoundStatus);
    case "hreflang-to-client-errors":
      return isHreflangLink(link) && hasTargetStatus(link, isOtherClientErrorStatus);
    case "hreflang-to-server-error":
      return isHreflangLink(link) && hasTargetStatus(link, isServerErrorStatus);
    case "hreflang-to-redirect":
      return isHreflangLink(link) && hasTargetStatus(link, isRedirectStatus);
    case "hreflang-origin-page-source":
      return isHreflangLink(link) && /page source/i.test(link.img || "");
    case "hreflang-origin-sitemap":
      return isHreflangLink(link) && /sitemap/i.test(link.img || "");
    case "hreflang-origin-http-headers":
      return isHreflangLink(link) && /headers/i.test(link.img || "");
    default:
      return false;
  }
}

function searchHaystack(link, scope) {
  if (scope === "target") return link.target || "";
  if (scope === "anchor") return link.anchor || "";
  if (scope === "type") return link.type || "";
  return link.source || "";
}

function advancedFieldValue(link, field) {
  switch (field) {
    case "target":
      return link.target || "";
    case "anchor":
      return link.anchor || "";
    case "type":
      return link.type || "";
    case "sourceStatus":
      return link.sStatus ?? "";
    case "targetStatus":
      return link.tStatus ?? "";
    case "nofollow":
      return link.nofollow ? "Yes" : "No";
    case "source":
    default:
      return link.source || "";
  }
}

function matchesAdvancedRule(link, rule) {
  const value = advancedFieldValue(link, rule.field);
  const raw = String(value ?? "");
  const query = String(rule.value || "").trim();
  const lowerRaw = raw.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (rule.operator === "exists") return raw.trim().length > 0;
  if (rule.operator === "not-exists") return raw.trim().length === 0;
  if (!query) return true;
  if (rule.operator === "contains") return lowerRaw.includes(lowerQuery);
  if (rule.operator === "not-contains") return !lowerRaw.includes(lowerQuery);
  if (rule.operator === "equals") return lowerRaw === lowerQuery;
  if (rule.operator === "not-equals") return lowerRaw !== lowerQuery;

  const numericValue = Number(value);
  const numericQuery = Number(query);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericQuery)) return true;
  if (rule.operator === "greater-than") return numericValue > numericQuery;
  if (rule.operator === "less-than") return numericValue < numericQuery;
  return true;
}

function filterLinks(links, activeFilter, searchQuery, searchScope, advancedOpen, advancedRule) {
  let filtered = links.filter((link) => matchesLinkFilter(link, activeFilter));

  if (advancedOpen) {
    filtered = filtered.filter((link) => matchesAdvancedRule(link, advancedRule));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((link) => searchHaystack(link, searchScope).toLowerCase().includes(q));
  }

  return filtered;
}

function FilterMenuDropdown({ items, activeFilter, onSelect }) {
  return (
    <div className="absolute left-0 top-[calc(100%+4px)] z-[100] max-h-[72vh] min-w-64 overflow-y-auto rounded-md border border-white/10 bg-[#303034] py-1 text-sm shadow-2xl">
      {items.map((item, index) => {
        if (item.section) {
          return item.label ? (
            <div key={`${item.label}-${index}`} className="border-t border-white/10 px-3 pb-1 pt-3 text-sm font-bold text-white first:border-t-0 first:pt-2">
              {item.label}
            </div>
          ) : (
            <div key={`divider-${index}`} className="my-1 border-t border-white/10" />
          );
        }
        const active = item.filter === activeFilter;
        return (
          <button
            key={`${item.label}-${item.filter}-${index}`}
            onClick={() => onSelect(item)}
            className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left transition ${
              active ? "bg-brand-500/25 text-white" : "text-white hover:bg-white/[0.06]"
            }`}
          >
            <span className="min-w-0 whitespace-nowrap">{item.label}</span>
            <span className="flex-shrink-0 tabular-nums text-white/55">{Number(item.count || 0).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}

function AdvancedFilterPanel({ rule, setRule, resultCount, operator, onReset }) {
  const needsValue = Boolean(operator?.needsValue);
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/70 backdrop-blur">
      <div className="border-b border-white/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-white/10">
            <button className="bg-brand-500/25 px-3 py-1.5 text-xs font-semibold text-brand-100">AND</button>
            <button className="px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.06]">OR</button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-white/10">
            <button className="px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.06]">Previous</button>
            <button className="bg-brand-500/25 px-3 py-1.5 text-xs font-semibold text-brand-100">Current</button>
          </div>
          <select
            value={rule.field}
            onChange={(event) => setRule((current) => ({ ...current, field: event.target.value }))}
            className="h-8 min-w-[240px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none"
          >
            {ADVANCED_FIELDS.map((field) => (
              <option key={field.key} value={field.key} className="bg-[#303034] text-white">{field.label}</option>
            ))}
          </select>
          <select
            value={rule.operator}
            onChange={(event) => {
              const nextOperator = event.target.value;
              const nextMeta = ADVANCED_OPERATORS.find((item) => item.key === nextOperator);
              setRule((current) => ({
                ...current,
                operator: nextOperator,
                value: nextMeta?.needsValue ? current.value : "",
              }));
            }}
            className="h-8 min-w-[190px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none"
          >
            {ADVANCED_OPERATORS.map((item) => (
              <option key={item.key} value={item.key} className="bg-[#303034] text-white">{item.label}</option>
            ))}
          </select>
          {needsValue && (
            <input
              value={rule.value}
              onChange={(event) => setRule((current) => ({ ...current, value: event.target.value }))}
              placeholder="Value"
              className="h-8 min-w-[220px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-white/30 outline-none"
            />
          )}
          <button
            onClick={onReset}
            className="flex h-8 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
            aria-label="Reset advanced rule"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/80 hover:bg-white/[0.08]">
            <Plus className="h-3.5 w-3.5" /> Rule
          </button>
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/80 hover:bg-white/[0.08]">
            <Plus className="h-3.5 w-3.5" /> Group
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-3 py-3 text-xs">
        <button
          disabled={needsValue && !String(rule.value || "").trim()}
          className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-4 font-semibold text-white/45 disabled:cursor-not-allowed disabled:opacity-50 enabled:text-white/80 enabled:hover:bg-white/[0.08]"
        >
          Apply
        </button>
        <span className="font-semibold text-white/55">{Number(resultCount || 0).toLocaleString()} results matching</span>
        <button onClick={onReset} className="font-semibold text-brand-300 hover:underline">Reset</button>
      </div>
    </div>
  );
}

export default function LinkExplorer() {
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter") || "all";
  const { stats } = useCrawl();

  const latestUrls = stats?.latestUrls || [];

  // Build page data from real crawl data
  const pages = useMemo(() => buildPagesFromCrawl(latestUrls), [latestUrls]);

  const [activeFilter, setActiveFilter] = useState(urlFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState("source");
  const [openMenu, setOpenMenu] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedRule, setAdvancedRule] = useState(DEFAULT_ADVANCED_RULE);
  const [chartVisible, setChartVisible] = useState(true);
  const [resultTab, setResultTab] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setActiveFilter(urlFilter);
    setVisibleCount(PAGE_SIZE);
  }, [urlFilter]);

  // Build all links/resources from real crawl data
  const allLinks = useMemo(() => buildLinks(latestUrls), [latestUrls]);
  const lostLinksCount = 0;
  const filterMenus = useMemo(() => buildFilterMenus(allLinks), [allLinks]);
  const currentSearchScope = SEARCH_SCOPES.find((scope) => scope.key === searchScope) || SEARCH_SCOPES[0];
  const activeAdvancedOperator = ADVANCED_OPERATORS.find((operator) => operator.key === advancedRule.operator) || ADVANCED_OPERATORS[0];

  // Apply filters
  const filteredLinks = useMemo(
    () => filterLinks(allLinks, activeFilter, searchQuery, searchScope, advancedOpen, advancedRule),
    [allLinks, activeFilter, searchQuery, searchScope, advancedOpen, advancedRule]
  );

  const applyFilter = (item) => {
    setActiveFilter(item.filter || "all");
    setOpenMenu(null);
    setVisibleCount(PAGE_SIZE);
  };

  // Crawl history bar data from the active crawl session.
  const crawlData = useMemo(() => {
    return (stats?.perMinute || []).map((item) => item.total || 0).slice(-27);
  }, [stats?.perMinute]);

  return (
    <div className="space-y-4">
      <div className="auditor-hero">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <Link2 className="h-5 w-5" />
          Link explorer
          <HelpCircle className="h-4 w-4 text-white/30" />
          <span className="text-xs font-normal text-white/40 ml-1">How to use</span>
        </h1>
      </div>

      {/* Filter tabs + search */}
      <div className="relative z-[80] flex flex-wrap items-center gap-1.5 overflow-visible rounded-2xl border border-white/10 bg-ink-800/60 p-1.5 backdrop-blur">
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.id || activeFilter === tab.filter || filterMenus[tab.label]?.some((item) => item.filter === activeFilter);
          return (
            <div key={tab.id} className="relative">
              <button
                onClick={() => {
                  if (tab.filter) {
                    applyFilter({ filter: tab.filter });
                    return;
                  }
                  setOpenMenu((current) => (current === tab.id ? null : tab.id));
                }}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-brand-500/20 text-brand-100 ring-1 ring-inset ring-brand-500/30" : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {tab.label}
                {tab.drop && <ChevronDown className={`h-3 w-3 opacity-70 transition ${openMenu === tab.id ? "rotate-180" : ""}`} />}
              </button>
              {tab.drop && openMenu === tab.id && (
                <FilterMenuDropdown
                  items={filterMenus[tab.label] || []}
                  activeFilter={activeFilter}
                  onSelect={applyFilter}
                />
              )}
            </div>
          );
        })}
        <div className="ml-auto flex flex-wrap items-center gap-2 px-2">
          <div className="hidden h-8 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs sm:flex">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <input
              placeholder="Word or phrase"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="w-32 bg-transparent placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <div className="relative hidden sm:block">
            <button
              onClick={() => setOpenMenu((current) => (current === "searchScope" ? null : "searchScope"))}
              className="flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08]"
            >
              {currentSearchScope.label} <ChevronDown className={`h-3 w-3 transition ${openMenu === "searchScope" ? "rotate-180" : ""}`} />
            </button>
            {openMenu === "searchScope" && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-[100] w-40 rounded-md border border-white/10 bg-[#303034] py-1 text-sm shadow-2xl">
                {SEARCH_SCOPES.map((scope) => (
                  <button
                    key={scope.key}
                    onClick={() => {
                      setSearchScope(scope.key);
                      setOpenMenu(null);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className={`block w-full px-3 py-1.5 text-left ${searchScope === scope.key ? "bg-brand-500/25 text-white" : "text-white hover:bg-white/[0.06]"}`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setAdvancedOpen((current) => !current);
              setOpenMenu(null);
            }}
            className={`flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition ${
              advancedOpen ? "border-brand-500/40 bg-brand-500/20 text-brand-100" : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
            }`}
          >
            Advanced filter <ChevronDown className={`h-3 w-3 transition ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {advancedOpen && (
        <AdvancedFilterPanel
          rule={advancedRule}
          setRule={(next) => {
            setAdvancedRule(next);
            setVisibleCount(PAGE_SIZE);
          }}
          resultCount={filteredLinks.length}
          operator={activeAdvancedOperator}
          onReset={() => {
            setAdvancedRule(DEFAULT_ADVANCED_RULE);
            setVisibleCount(PAGE_SIZE);
          }}
        />
      )}

      {/* Crawl history chart */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm font-semibold">
            Crawl history <HelpCircle className="h-3.5 w-3.5 text-white/30" />
          </span>
          <button onClick={() => setChartVisible(!chartVisible)} className="text-xs text-white/50 hover:text-white/80">
            {chartVisible ? "Hide chart ▲" : "Show chart ▼"}
          </button>
        </div>
        {chartVisible && (
          <>
            <CrawlHistoryBars data={crawlData} />
            <div className="mt-2 flex items-center justify-between text-xs text-white/55">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-brand-500" /> Highlight new
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-brand-500" /> Show lost
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" defaultChecked className="accent-brand-500" /> All filter results
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-brand-500" /> Incomplete crawl
              </label>
              <button className="ml-auto rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 hover:bg-white/[0.08]">
                All {crawlData.length} crawls <ChevronDown className="ml-1 inline h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Results table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setResultTab("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${resultTab === "all" ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"}`}
            >
              All filter results <span className="ml-1 rounded bg-brand-500/30 px-1.5 py-0.5 text-[10px] text-brand-100">{filteredLinks.length.toLocaleString()}</span>
            </button>
            <button
              onClick={() => setResultTab("lostFilter")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${resultTab === "lostFilter" ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"}`}
            >
              Lost from filter results 0
            </button>
            <button
              onClick={() => setResultTab("lost")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${resultTab === "lost" ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"}`}
            >
              Lost {lostLinksCount}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Plus className="h-3.5 w-3.5" /> Patches: Show all <ChevronDown className="h-3 w-3" />
            </button>
            <button className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08] lg:flex">
              Changes: Don&apos;t show <ChevronDown className="h-3 w-3" />
            </button>
            <button className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08] lg:flex">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </button>
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Code2 className="h-3.5 w-3.5" /> AI · API
            </button>
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="px-3 py-3 font-medium">Link type</th>
                <th className="px-3 py-3 font-medium">Is nofollow</th>
                <th className="px-3 py-3 font-medium">Source URL</th>
                <th className="px-3 py-3 text-center font-medium">Source HTTP status code</th>
                <th className="px-3 py-3 font-medium">Target URL</th>
                <th className="px-3 py-3 text-center font-medium">Target HTTP status code</th>
                <th className="px-3 py-3 font-medium">Target no-crawl reason</th>
                <th className="px-3 py-3 font-medium">Anchor</th>
                <th className="px-3 py-3 font-medium">Image type</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-sm text-white/40">
                    {searchQuery ? "No links match your search." : "No links found. Run a crawl to discover links."}
                  </td>
                </tr>
              ) : (
                filteredLinks.slice(0, visibleCount).map((l, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                    <td className="px-3 py-3 text-white">{l.type}</td>
                    <td className="px-3 py-3 text-white/70">{l.nofollow ? "Yes" : "No"}</td>
                    <td className="px-3 py-3"><UrlCell url={l.source} /></td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={l.sStatus} />
                    </td>
                    <td className="px-3 py-3"><UrlCell url={l.target} /></td>
                    <td className="px-3 py-3 text-center">
                      {l.tStatus !== null ? <StatusBadge status={l.tStatus} /> : (
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-white/50">Not crawled</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-white/50">{l.noCrawl || ""}</td>
                    <td className="px-3 py-3 text-white/80">{l.anchor || ""}</td>
                    <td className="px-3 py-3 text-white/60">{l.img || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Show more footer */}
        {filteredLinks.length > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-white/10 py-4">
            {visibleCount < filteredLinks.length && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="text-sm font-semibold text-brand-300 hover:underline"
              >
                Show more
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (Math.min(visibleCount, filteredLinks.length) / filteredLinks.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white/40">
                Showing {Math.min(visibleCount, filteredLinks.length).toLocaleString()} of {filteredLinks.length.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  let colors;
  if (status < 300) colors = "bg-emerald-500/15 text-emerald-400";
  else if (status < 400) colors = "bg-amber-500/15 text-amber-400";
  else colors = "bg-rose-500/15 text-rose-400";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${colors}`}>{status}</span>;
}

function UrlCell({ url }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-xs leading-snug text-brand-300 hover:underline">
      <span className="break-all">{url}</span>
      <Search className="mt-0.5 h-3 w-3 flex-shrink-0 text-white/30" />
    </a>
  );
}

function CrawlHistoryBars({ data }) {
  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-sm text-white/40">
        No crawl history captured yet.
      </div>
    );
  }
  const max = Math.max(...data, 1);
  return (
    <>
      <div className="flex h-44 items-end gap-[2px]">
        {data.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-all ${i === data.length - 1 ? "bg-brand-500" : "bg-gradient-to-t from-emerald-700/40 to-emerald-500"}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>Oldest</span>
        <span>Newest</span>
      </div>
    </>
  );
}
