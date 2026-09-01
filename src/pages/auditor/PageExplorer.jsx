import { useDeferredValue, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Search,
  ExternalLink,
  Code2,
  Download,
  Columns3,
  Plus,
  HelpCircle,
  X,
  CheckCircle2,
  RotateCcw,
  Folder,
} from "lucide-react";
import { useAuditData } from "../../hooks/useAuditData.js";
import { useCrawl } from "../../context/CrawlContext.jsx";

const FILTER_TABS = [
  { key: "all", label: "All URLs", filter: "all" },
  { key: "pages", label: "Pages", drop: true },
  { key: "resources", label: "Resources", drop: true },
  { key: "content", label: "Content", drop: true },
  { key: "links", label: "Links", drop: true },
  { key: "redirects", label: "Redirects", drop: true },
  { key: "indexability", label: "Indexability", drop: true },
  { key: "sitemaps", label: "Sitemaps", drop: true },
];

const SEARCH_SCOPES = [
  { key: "url", label: "URL" },
  { key: "source", label: "Page source" },
  { key: "text", label: "Page text" },
];

const ADVANCED_FIELDS = [
  { key: "url", label: "URL" },
  { key: "status", label: "HTTP status code" },
  { key: "contentType", label: "Content type" },
  { key: "title", label: "Title" },
  { key: "pageText", label: "Page text" },
  { key: "pageSource", label: "Page source" },
  { key: "depth", label: "Depth" },
  { key: "indexable", label: "Is indexable page" },
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

const DEFAULT_ADVANCED_RULE = { field: "url", operator: "exists", value: "" };

/* ─── Helper: classify content type label ─── */
function classifyContentType(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  const path = (() => {
    try { return new URL(url).pathname.toLowerCase(); } catch { return ""; }
  })();
  if (/text\/html|application\/xhtml/i.test(ct)) return "text/html";
  if (/text\/css/i.test(ct) || path.endsWith(".css")) return "text/css";
  if (/javascript|ecmascript/i.test(ct) || /\.(js|mjs)$/.test(path)) return "application/javascript";
  if (/image\//i.test(ct) || /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp)$/i.test(path)) return "image/*";
  if (/text\/xml|application\/xml/i.test(ct) || path.endsWith(".xml")) return "text/xml";
  return ct || "text/html";
}

/* ─── Helper: get human-readable title label from URL ─── */
function pageLabelFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/|\/$/g, "");
    if (!path) return url.hostname;
    return path
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .map((seg) => seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(" › ");
  } catch {
    return rawUrl || "Untitled page";
  }
}

function itemUrl(item) {
  return typeof item === "string" ? item : item?.url || "";
}

function sameUrl(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    left.hash = "";
    right.hash = "";
    return left.toString() === right.toString();
  } catch {
    return a === b;
  }
}

function isInternalUrl(rawUrl, origin) {
  try {
    return new URL(rawUrl).origin === origin;
  } catch {
    return false;
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

function isWordPressPostIdRedirect(row) {
  if (Number(row?.status || 0) !== 301) return false;
  try {
    return new URL(row.url || "").searchParams.has("p");
  } catch {
    return false;
  }
}

function pageSortInfo(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
    return {
      isHomepage: cleanPath === "/" && !url.search,
      hasParams: Boolean(url.search),
      depth: cleanPath === "/" ? 0 : cleanPath.split("/").filter(Boolean).length,
      path: cleanPath.toLowerCase(),
    };
  } catch {
    return {
      isHomepage: false,
      hasParams: true,
      depth: Number.MAX_SAFE_INTEGER,
      path: String(rawUrl || "").toLowerCase(),
    };
  }
}

/* ─── Helper: compute PR-like score from status and position ─── */
function countRows(rows, predicate) {
  return rows.reduce((count, row) => (predicate(row) ? count + 1 : count), 0);
}

function firstIssueCount(auditIssues, keys) {
  for (const key of keys) {
    const issue = auditIssues?.[key];
    if (!issue) continue;
    if (Array.isArray(issue.urls)) return issue.urls.length;
    if (Array.isArray(issue.items)) return issue.items.length;
    if (Number.isFinite(Number(issue.count))) return Number(issue.count);
    if (Number.isFinite(Number(issue.total))) return Number(issue.total);
  }
  return 0;
}

function issueUrlSet(auditIssues, keys) {
  const urls = new Set();
  keys.forEach((key) => {
    const issue = auditIssues?.[key];
    const rows = Array.isArray(issue?.urls) ? issue.urls : Array.isArray(issue?.items) ? issue.items : [];
    rows.forEach((item) => {
      const url = itemUrl(item) || item?.sourceUrl || item?.targetUrl || item?.pageUrl || item?.page?.url || "";
      if (url) urls.add(url);
    });
  });
  return urls;
}

function isPageRow(row) {
  return row.kind === "page";
}

function isImageRow(row) {
  return row.kind === "image" || /image\//i.test(row.ct || "") || /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp)(?:[?#]|$)/i.test(row.url || "");
}

function isJavaScriptRow(row) {
  return /javascript|ecmascript/i.test(row.ct || "") || /\.m?js(?:[?#]|$)/i.test(row.url || "");
}

function isCssRow(row) {
  return /text\/css/i.test(row.ct || "") || /\.css(?:[?#]|$)/i.test(row.url || "");
}

function isSitemapRow(row) {
  return /xml/i.test(row.ct || "") || /sitemap|\.xml(?:[?#]|$)/i.test(row.url || "");
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

function textLength(value) {
  return String(value || "").trim().length;
}

function wordsIn(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function flattenHeadings(headings) {
  if (!Array.isArray(headings)) return "";
  return headings.map((heading) => {
    if (typeof heading === "string") return heading;
    return heading?.text || heading?.content || heading?.label || "";
  }).join(" ");
}

function rowPageText(row) {
  return [
    row.title,
    row.rawTitle,
    row.metaDescription,
    row.h1,
    flattenHeadings(row.headings),
    row.contentText,
  ].filter(Boolean).join(" ");
}

function rowPageSource(row) {
  return [
    row.sourceText,
    row.rawHtml,
    row.html,
    row.contentText,
    row.metaDescription,
    JSON.stringify(row.audit || {}),
  ].filter(Boolean).join(" ");
}

function rowSearchHaystack(row, scope) {
  if (scope === "text") return rowPageText(row);
  if (scope === "source") return rowPageSource(row);
  return [row.url, row.title, row.rawTitle, row.ct].filter(Boolean).join(" ");
}

function hasRobotsDirective(row, directive) {
  const haystack = [
    row.robotsMeta,
    row.xRobotsTag,
    row.audit?.robotsMeta,
    row.audit?.xRobotsTag,
    row.audit?.metaRobots,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.split(/[,;\s]+/).includes(directive);
}

function hasMissingAltSignal(row) {
  if (row.issueFlags?.missingImageAlt) return true;
  const audit = row.audit || {};
  const numericKeys = [
    "missingImageAltCount",
    "imageAltMissingCount",
    "imagesMissingAltCount",
    "imagesWithoutAltCount",
  ];
  if (numericKeys.some((key) => Number(audit[key] || 0) > 0)) return true;
  const listKeys = ["imagesMissingAlt", "missingAltImages", "imagesWithoutAlt"];
  return listKeys.some((key) => Array.isArray(audit[key]) && audit[key].length > 0);
}

function hasResourceStatus(row, resourceKind, predicate) {
  return (row.resources || []).some((resource) => {
    if (resourceKind === "image" && resource.type !== "Image") return false;
    if (resourceKind === "javascript" && resource.type !== "JavaScript") return false;
    if (resourceKind === "css" && resource.type !== "CSS") return false;
    return predicate(resource.status);
  });
}

function hasOutgoingStatus(row, predicate) {
  return (row.outgoingLinks || []).some((link) => predicate(link.status));
}

function hasHttpsToHttpLink(row) {
  if (!/^https:/i.test(row.url || "")) return false;
  return (row.outgoingLinks || []).some((link) => /^http:/i.test(link.url || ""));
}

function canonicalTargetStatus(row, rowsByUrl) {
  if (!row.canonicalUrl) return null;
  return rowsByUrl.get(row.canonicalUrl)?.status ?? null;
}

function redirectTargetStatus(row, rowsByUrl) {
  if (!row.redirectUrl) return null;
  return rowsByUrl.get(row.redirectUrl)?.status ?? null;
}

function isCanonicalized(row) {
  return Boolean(row.canonicalUrl) && !sameUrl(row.url, row.canonicalUrl);
}

function isSelfCanonical(row) {
  return Boolean(row.canonicalUrl) && sameUrl(row.url, row.canonicalUrl);
}

function isInSitemap(row) {
  const audit = row.audit || {};
  return Boolean(
    row.inSitemap ||
    row.presentInSitemap ||
    audit.inSitemap ||
    audit.presentInSitemap ||
    (Array.isArray(row.sitemaps) && row.sitemaps.length) ||
    (Array.isArray(audit.sitemaps) && audit.sitemaps.length)
  );
}

function sitemapCount(row) {
  const audit = row.audit || {};
  if (Array.isArray(row.sitemaps)) return row.sitemaps.length;
  if (Array.isArray(audit.sitemaps)) return audit.sitemaps.length;
  return isInSitemap(row) ? 1 : 0;
}

function advancedFieldValue(row, field) {
  switch (field) {
    case "status":
      return row.status || "";
    case "contentType":
      return row.ct || "";
    case "title":
      return row.title || row.rawTitle || "";
    case "pageText":
      return rowPageText(row);
    case "pageSource":
      return rowPageSource(row);
    case "depth":
      return row.depth;
    case "indexable":
      return row.indexable ? "Yes" : "No";
    case "url":
    default:
      return row.url || "";
  }
}

function matchesAdvancedRule(row, rule) {
  const value = advancedFieldValue(row, rule.field);
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

function computePR(status, index, total) {
  if (status === 0 || status >= 400) return 0;
  if (status >= 300) return 0;
  // Higher PR for URLs crawled earlier (more linked/important)
  return Math.max(1, Math.min(99, Math.round(60 - (index / Math.max(total, 1)) * 55)));
}

/* ─── Build Page Explorer rows from real crawl data ─── */
function buildPageRows(latestUrls, auditIssues) {
  const noindexUrls = new Set();
  const noindexIssue = auditIssues?.["noindex-page"];
  if (noindexIssue?.urls) {
    noindexIssue.urls.forEach((u) => { if (u.url) noindexUrls.add(u.url); });
  }
  const missingAltUrls = issueUrlSet(auditIssues, ["missing-image-alt", "missing-alt-text", "image-alt-missing", "pages-with-images-missing-alt-text"]);
  const titleSerpMismatchUrls = issueUrlSet(auditIssues, ["page-serp-title-mismatch", "title-serp-mismatch"]);
  const redirectChainUrls = issueUrlSet(auditIssues, ["redirect-chain", "redirect-chains"]);
  const redirectLoopUrls = issueUrlSet(auditIssues, ["redirect-loop", "redirect-loops"]);

  const crawledByUrl = new Map(latestUrls.map((row) => [row.url, row]));
  const incomingByUrl = new Map();
  latestUrls.forEach((sourceRow) => {
    (sourceRow.links || []).forEach((item) => {
      const targetUrl = itemUrl(item);
      if (!targetUrl) return;
      const existing = incomingByUrl.get(targetUrl) || [];
      existing.push({
        url: sourceRow.url,
        status: sourceRow.status || null,
        anchor: typeof item === "string" ? "" : item.anchor || "",
        dofollow: typeof item === "string" ? true : !item.nofollow,
        type: typeof item === "string" ? "Href link" : item.type || "Href link",
      });
      incomingByUrl.set(targetUrl, existing);
    });
  });

  return latestUrls
    .map((row, idx) => {
      const url = row.url || "";
      const status = row.status || 0;
      const ct = classifyContentType(row.contentType, url);
      const isHtml = ct.includes("text/html");
      const isImage = ct.includes("image");

      if (!url) return null;
      if (isWordPressPostIdRedirect(row)) return null;

      const isSuccess = status >= 200 && status < 300;
      const isNoindex = noindexUrls.has(url);
      const indexable = isHtml && isSuccess && !isNoindex;

      let depth = 0;
      try {
        const pathname = new URL(url).pathname.replace(/^\/|\/$/g, "");
        depth = pathname ? pathname.split("/").filter(Boolean).length : 0;
      } catch { /* default 0 */ }

      const pr = computePR(status, idx, latestUrls.length);
      const rawTitle = row.title || row.audit?.titleText || "";
      const title = rawTitle || pageLabelFromUrl(url);
      const sortInfo = pageSortInfo(url);
      const origin = (() => {
        try { return new URL(url).origin; } catch { return ""; }
      })();
      const outgoingLinks = (row.links || []).map((item) => {
        const targetUrl = itemUrl(item);
        const targetRow = crawledByUrl.get(targetUrl);
        return {
          url: targetUrl,
          status: targetRow?.status ?? null,
          anchor: typeof item === "string" ? "" : item.anchor || "",
          dofollow: typeof item === "string" ? true : !item.nofollow,
          type: typeof item === "string" ? "Href link" : item.type || "Href link",
          internal: origin ? isInternalUrl(targetUrl, origin) : true,
        };
      }).filter((item) => item.url);
      const resources = (row.resources || []).map((item) => ({
        ...(typeof item === "string" ? { url: item } : item),
        type: resourceType(item),
        status: crawledByUrl.get(itemUrl(item))?.status ?? null,
      })).filter((item) => item.url);
      const incomingLinks = incomingByUrl.get(url) || [];

      return {
        pr,
        title,
        rawTitle,
        url,
        status,
        ct: row.contentType || ct,
        depth,
        indexable,
        inlinks: incomingLinks.length,
        outgoingLinks,
        incomingLinks,
        resources,
        sourceText: row.sourceText || row.pageSource || row.rawHtml || row.html || row.audit?.sourceText || row.audit?.pageSource || "",
        rawHtml: row.rawHtml || row.html || row.audit?.rawHtml || "",
        redirectUrl: row.redirectUrl || row.redirectTo || row.location || row.audit?.redirectUrl || row.audit?.redirectTo || "",
        sizeKb: row.sizeKb || 0,
        loadTime: row.loadTime || 0,
        metaDescription: row.metaDescription || row.audit?.metaDescriptionText || "",
        h1: row.h1 || row.audit?.h1Text || "",
        headings: Array.isArray(row.headings) ? row.headings : [],
        contentText: row.contentText || row.audit?.contentText || "",
        canonicalUrl: row.canonicalUrl || row.audit?.canonicalUrl || "",
        robotsMeta: row.robotsMeta || row.audit?.robotsMeta || "",
        xRobotsTag: row.xRobotsTag || "",
        audit: row.audit || {},
        robotsTxtBlocked: Boolean(row.robotsTxtBlocked || row.blockedByRobotsTxt || row.audit?.blockedByRobotsTxt),
        issueFlags: {
          missingImageAlt: missingAltUrls.has(url),
          titleSerpMismatch: titleSerpMismatchUrls.has(url),
          redirectChain: redirectChainUrls.has(url),
          redirectLoop: redirectLoopUrls.has(url),
        },
        time: row.time,
        kind: isHtml ? "page" : isImage ? "image" : "resource",
        sourceIndex: idx,
        sortInfo,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const kindOrder = { page: 0, resource: 1, image: 2 };
      if (a.kind !== b.kind) return (kindOrder[a.kind] ?? 3) - (kindOrder[b.kind] ?? 3);
      if (a.kind === "page") {
        if (a.sortInfo.isHomepage !== b.sortInfo.isHomepage) {
          return a.sortInfo.isHomepage ? -1 : 1;
        }
        if (a.sortInfo.hasParams !== b.sortInfo.hasParams) {
          return a.sortInfo.hasParams ? 1 : -1;
        }
        if (a.sortInfo.depth !== b.sortInfo.depth) {
          return a.sortInfo.depth - b.sortInfo.depth;
        }
        const pathOrder = a.sortInfo.path.localeCompare(b.sortInfo.path);
        if (pathOrder !== 0) return pathOrder;
      }
      return a.sourceIndex - b.sourceIndex;
    });
}

function buildFilterMenus(urls, auditIssues) {
  const rowsByUrl = new Map(urls.map((row) => [row.url, row]));
  const pages = urls.filter(isPageRow);
  const resources = urls.filter((row) => !isPageRow(row));
  const images = urls.filter(isImageRow);
  const scripts = urls.filter(isJavaScriptRow);
  const stylesheets = urls.filter(isCssRow);
  const redirects = urls.filter((row) => isRedirectStatus(row.status));
  const sitemaps = urls.filter(isSitemapRow);
  const menuItem = (label, count, filter) => ({ label, count, filter });
  const section = (label) => ({ label, section: true });
  const canonicalStatusMatches = (row, predicate) => predicate(canonicalTargetStatus(row, rowsByUrl));
  const redirectTargetMatches = (row, predicate) => predicate(redirectTargetStatus(row, rowsByUrl));
  const missingAltCount = Math.max(
    countRows(pages, hasMissingAltSignal),
    firstIssueCount(auditIssues, ["missing-image-alt", "missing-alt-text", "image-alt-missing", "pages-with-images-missing-alt-text"])
  );

  return {
    Pages: [
      menuItem("All pages", pages.length, "pages"),
      section("Internal"),
      menuItem("All pages", pages.length, "pages"),
      menuItem("Success", countRows(urls, (row) => isSuccessStatus(row.status)), "success"),
      menuItem("Not found", countRows(urls, (row) => isNotFoundStatus(row.status)), "not-found"),
      menuItem("Other client errors", countRows(urls, (row) => isOtherClientErrorStatus(row.status)), "client-errors"),
      menuItem("Server error", countRows(urls, (row) => isServerErrorStatus(row.status)), "server-errors"),
      menuItem("Redirect", redirects.length, "redirects"),
      section("External"),
      menuItem("All pages", 0, "external-pages"),
      menuItem("Success", 0, "external-success"),
      menuItem("Not found", 0, "external-not-found"),
      menuItem("Other client errors", 0, "external-client-errors"),
      menuItem("Server error", 0, "external-server-errors"),
      menuItem("Redirect", 0, "external-redirects"),
    ],
    Resources: [
      menuItem("All resources", resources.length, "resources"),
      menuItem("All images", images.length, "images"),
      menuItem("Too large images", countRows(images, (row) => Number(row.sizeKb || 0) > 1024), "large-images"),
      menuItem("Broken images", countRows(images, (row) => isBrokenStatus(row.status)), "broken-images"),
      menuItem("Redirecting images", countRows(images, (row) => isRedirectStatus(row.status)), "redirecting-images"),
      menuItem("Pages with images missing alt text", missingAltCount, "pages-missing-image-alt"),
      menuItem("Pages with broken images", countRows(pages, (row) => hasResourceStatus(row, "image", isBrokenStatus)), "pages-broken-images"),
      menuItem("Pages with redirecting images", countRows(pages, (row) => hasResourceStatus(row, "image", isRedirectStatus)), "pages-redirecting-images"),
      section(""),
      menuItem("All JavaScript", scripts.length, "javascript"),
      menuItem("Broken JavaScript", countRows(scripts, (row) => isBrokenStatus(row.status)), "broken-javascript"),
      menuItem("Redirecting JavaScript", countRows(scripts, (row) => isRedirectStatus(row.status)), "redirecting-javascript"),
      menuItem("Pages with broken JavaScript", countRows(pages, (row) => hasResourceStatus(row, "javascript", isBrokenStatus)), "pages-broken-javascript"),
      menuItem("Pages with redirecting JavaScript", countRows(pages, (row) => hasResourceStatus(row, "javascript", isRedirectStatus)), "pages-redirecting-javascript"),
      section(""),
      menuItem("All CSS", stylesheets.length, "css"),
      menuItem("Broken CSS", countRows(stylesheets, (row) => isBrokenStatus(row.status)), "broken-css"),
      menuItem("Redirecting CSS", countRows(stylesheets, (row) => isRedirectStatus(row.status)), "redirecting-css"),
      menuItem("Pages with broken CSS", countRows(pages, (row) => hasResourceStatus(row, "css", isBrokenStatus)), "pages-broken-css"),
      menuItem("Pages with redirecting CSS", countRows(pages, (row) => hasResourceStatus(row, "css", isRedirectStatus)), "pages-redirecting-css"),
      section(""),
      menuItem("Mixed content", countRows(pages, hasHttpsToHttpLink), "mixed-content"),
    ],
    Content: [
      menuItem("All pages", pages.length, "pages"),
      menuItem("Title missing", countRows(pages, (row) => !textLength(row.rawTitle || row.title)), "title-missing"),
      menuItem("Title too long", countRows(pages, (row) => textLength(row.rawTitle || row.title) > 70), "title-too-long"),
      menuItem("Title too short", countRows(pages, (row) => {
        const length = textLength(row.rawTitle || row.title);
        return length > 0 && length < 15;
      }), "title-too-short"),
      menuItem("Title changed", 0, "title-changed"),
      menuItem("Page and SERP titles do not match", countRows(pages, (row) => row.issueFlags?.titleSerpMismatch), "title-serp-mismatch"),
      menuItem("SERP title changed", 0, "serp-title-changed"),
      section(""),
      menuItem("Meta description missing", countRows(pages, (row) => !textLength(row.metaDescription)), "meta-missing"),
      menuItem("Meta description too long", countRows(pages, (row) => textLength(row.metaDescription) > 300), "meta-too-long"),
      menuItem("Meta description too short", countRows(pages, (row) => {
        const length = textLength(row.metaDescription);
        return length > 0 && length < 100;
      }), "meta-too-short"),
      menuItem("Meta description changed", 0, "meta-changed"),
      section(""),
      menuItem("H1 missing", countRows(pages, (row) => !textLength(row.h1)), "h1-missing"),
      menuItem("H1 changed", 0, "h1-changed"),
      section(""),
      menuItem("Low word count", countRows(pages, (row) => wordsIn(row.contentText) > 0 && wordsIn(row.contentText) < 50), "low-word-count"),
      menuItem("Word count changed", 0, "word-count-changed"),
      menuItem("Pages with high AI content level", 0, "high-ai-content"),
    ],
    Links: [
      menuItem("All pages", pages.length, "pages"),
      section(""),
      menuItem("With links to not found", countRows(pages, (row) => hasOutgoingStatus(row, isNotFoundStatus)), "links-to-not-found"),
      menuItem("With links to other client errors", countRows(pages, (row) => hasOutgoingStatus(row, isOtherClientErrorStatus)), "links-to-client-errors"),
      menuItem("With links to server error", countRows(pages, (row) => hasOutgoingStatus(row, isServerErrorStatus)), "links-to-server-error"),
      menuItem("With links to redirect", countRows(pages, (row) => hasOutgoingStatus(row, isRedirectStatus)), "links-to-redirect"),
      section(""),
      menuItem("Orphan pages", countRows(pages, (row) => row.inlinks === 0 && !row.sortInfo?.isHomepage), "orphan-pages"),
      menuItem("With no outgoing links", countRows(pages, (row) => (row.outgoingLinks || []).length === 0), "no-outgoing-links"),
      menuItem("HTTPS pages link to HTTP pages", countRows(pages, hasHttpsToHttpLink), "https-to-http"),
    ],
    Redirects: [
      menuItem("All redirects", redirects.length, "redirects"),
      section(""),
      menuItem("To not found", countRows(redirects, (row) => redirectTargetMatches(row, isNotFoundStatus)), "redirect-to-not-found"),
      menuItem("To other client errors", countRows(redirects, (row) => redirectTargetMatches(row, isOtherClientErrorStatus)), "redirect-to-client-errors"),
      menuItem("To server error", countRows(redirects, (row) => redirectTargetMatches(row, isServerErrorStatus)), "redirect-to-server-error"),
      menuItem("Redirect chains", countRows(urls, (row) => row.issueFlags?.redirectChain), "redirect-chains"),
      menuItem("Redirect loops", countRows(urls, (row) => row.issueFlags?.redirectLoop), "redirect-loops"),
    ],
    Indexability: [
      menuItem("All pages", urls.length, "all"),
      menuItem("Indexable", countRows(urls, (row) => row.indexable), "indexable"),
      menuItem("Non-indexable", countRows(urls, (row) => !row.indexable), "non-indexable"),
      menuItem("Indexable became non-indexable", 0, "indexable-became-non-indexable"),
      menuItem("Noindex became indexable", 0, "noindex-became-indexable"),
      section("Canonical"),
      menuItem("Modified", 0, "canonical-modified"),
      menuItem("Canonicalized", countRows(pages, isCanonicalized), "canonicalized"),
      menuItem("Self-canonical", countRows(pages, isSelfCanonical), "self-canonical"),
      menuItem("Not set", countRows(pages, (row) => !row.canonicalUrl), "canonical-not-set"),
      menuItem("To not found", countRows(pages, (row) => canonicalStatusMatches(row, isNotFoundStatus)), "canonical-to-not-found"),
      menuItem("To other client errors", countRows(pages, (row) => canonicalStatusMatches(row, isOtherClientErrorStatus)), "canonical-to-client-errors"),
      menuItem("To server error", countRows(pages, (row) => canonicalStatusMatches(row, isServerErrorStatus)), "canonical-to-server-error"),
      menuItem("To redirect", countRows(pages, (row) => canonicalStatusMatches(row, isRedirectStatus)), "canonical-to-redirect"),
      menuItem("To non-canonical", countRows(pages, (row) => {
        const target = row.canonicalUrl ? rowsByUrl.get(row.canonicalUrl) : null;
        return Boolean(target && isCanonicalized(target));
      }), "canonical-to-non-canonical"),
      section("Directives"),
      menuItem("Noindex", countRows(urls, (row) => hasRobotsDirective(row, "noindex") || !row.indexable), "noindex"),
      menuItem("Nofollow", countRows(urls, (row) => hasRobotsDirective(row, "nofollow")), "nofollow"),
      menuItem("Nosnippet", countRows(urls, (row) => hasRobotsDirective(row, "nosnippet")), "nosnippet"),
      menuItem("Noindex follow", countRows(urls, (row) => hasRobotsDirective(row, "noindex") && hasRobotsDirective(row, "follow") && !hasRobotsDirective(row, "nofollow")), "noindex-follow"),
      menuItem("Noindex nofollow", countRows(urls, (row) => hasRobotsDirective(row, "noindex") && hasRobotsDirective(row, "nofollow")), "noindex-nofollow"),
    ],
    Sitemaps: [
      menuItem("Pages in sitemap", countRows(urls, isInSitemap), "pages-in-sitemap"),
      menuItem("Not indexable pages in sitemap", countRows(urls, (row) => isInSitemap(row) && !row.indexable), "not-indexable-in-sitemap"),
      menuItem("Indexable pages not in sitemap", countRows(urls, (row) => row.indexable && !isInSitemap(row)), "indexable-not-in-sitemap"),
      menuItem("Pages in multiple sitemaps", countRows(urls, (row) => sitemapCount(row) > 1), "multiple-sitemaps"),
      menuItem("Pages removed from sitemap", 0, "removed-from-sitemap"),
      section(""),
      menuItem("All sitemaps", sitemaps.length, "sitemaps"),
      menuItem("Broken sitemaps", countRows(sitemaps, (row) => isBrokenStatus(row.status)), "broken-sitemaps"),
      menuItem("Sitemaps with over 50K URLs", 0, "large-url-sitemaps"),
      menuItem("Sitemaps larger than 50MB", countRows(sitemaps, (row) => Number(row.sizeKb || 0) > 51200), "large-size-sitemaps"),
    ],
  };
}

const PAGE_SIZE = 50;

function matchesExplorerFilter(row, filter, rowsByUrl = new Map()) {
  switch (filter) {
    case "all":
      return true;
    case "html":
    case "pages":
      return row.kind === "page";
    case "non-html":
    case "resources":
      return row.kind !== "page";
    case "images":
      return isImageRow(row);
    case "large-images":
      return isImageRow(row) && Number(row.sizeKb || 0) > 1024;
    case "broken-images":
      return isImageRow(row) && isBrokenStatus(row.status);
    case "redirecting-images":
      return isImageRow(row) && isRedirectStatus(row.status);
    case "pages-missing-image-alt":
      return row.kind === "page" && hasMissingAltSignal(row);
    case "pages-broken-images":
      return row.kind === "page" && hasResourceStatus(row, "image", isBrokenStatus);
    case "pages-redirecting-images":
      return row.kind === "page" && hasResourceStatus(row, "image", isRedirectStatus);
    case "javascript":
      return isJavaScriptRow(row);
    case "broken-javascript":
      return isJavaScriptRow(row) && isBrokenStatus(row.status);
    case "redirecting-javascript":
      return isJavaScriptRow(row) && isRedirectStatus(row.status);
    case "pages-broken-javascript":
      return row.kind === "page" && hasResourceStatus(row, "javascript", isBrokenStatus);
    case "pages-redirecting-javascript":
      return row.kind === "page" && hasResourceStatus(row, "javascript", isRedirectStatus);
    case "css":
      return isCssRow(row);
    case "broken-css":
      return isCssRow(row) && isBrokenStatus(row.status);
    case "redirecting-css":
      return isCssRow(row) && isRedirectStatus(row.status);
    case "pages-broken-css":
      return row.kind === "page" && hasResourceStatus(row, "css", isBrokenStatus);
    case "pages-redirecting-css":
      return row.kind === "page" && hasResourceStatus(row, "css", isRedirectStatus);
    case "mixed-content":
      return row.kind === "page" && hasHttpsToHttpLink(row);
    case "redirects":
      return isRedirectStatus(row.status);
    case "not-found":
      return isNotFoundStatus(row.status);
    case "client-errors":
      return isOtherClientErrorStatus(row.status);
    case "server-errors":
      return isServerErrorStatus(row.status);
    case "broken":
      return isBrokenStatus(row.status);
    case "success":
      return isSuccessStatus(row.status);
    case "title-missing":
      return row.kind === "page" && !textLength(row.rawTitle || row.title);
    case "title-too-long":
      return row.kind === "page" && textLength(row.rawTitle || row.title) > 70;
    case "title-too-short": {
      const length = textLength(row.rawTitle || row.title);
      return row.kind === "page" && length > 0 && length < 15;
    }
    case "title-serp-mismatch":
      return row.kind === "page" && Boolean(row.issueFlags?.titleSerpMismatch);
    case "meta-missing":
      return row.kind === "page" && !textLength(row.metaDescription);
    case "meta-too-long":
      return row.kind === "page" && textLength(row.metaDescription) > 300;
    case "meta-too-short": {
      const length = textLength(row.metaDescription);
      return row.kind === "page" && length > 0 && length < 100;
    }
    case "h1-missing":
      return row.kind === "page" && !textLength(row.h1);
    case "low-word-count":
      return row.kind === "page" && wordsIn(row.contentText) > 0 && wordsIn(row.contentText) < 50;
    case "links-to-not-found":
      return row.kind === "page" && hasOutgoingStatus(row, isNotFoundStatus);
    case "links-to-client-errors":
      return row.kind === "page" && hasOutgoingStatus(row, isOtherClientErrorStatus);
    case "links-to-server-error":
      return row.kind === "page" && hasOutgoingStatus(row, isServerErrorStatus);
    case "links-to-redirect":
      return row.kind === "page" && hasOutgoingStatus(row, isRedirectStatus);
    case "orphan-pages":
      return row.kind === "page" && row.inlinks === 0 && !row.sortInfo?.isHomepage;
    case "no-outgoing-links":
      return row.kind === "page" && (row.outgoingLinks || []).length === 0;
    case "https-to-http":
      return row.kind === "page" && hasHttpsToHttpLink(row);
    case "redirect-to-not-found":
      return isRedirectStatus(row.status) && isNotFoundStatus(redirectTargetStatus(row, rowsByUrl));
    case "redirect-to-client-errors":
      return isRedirectStatus(row.status) && isOtherClientErrorStatus(redirectTargetStatus(row, rowsByUrl));
    case "redirect-to-server-error":
      return isRedirectStatus(row.status) && isServerErrorStatus(redirectTargetStatus(row, rowsByUrl));
    case "redirect-chains":
      return Boolean(row.issueFlags?.redirectChain);
    case "redirect-loops":
      return Boolean(row.issueFlags?.redirectLoop);
    case "indexable":
      return row.indexable;
    case "non-indexable":
      return !row.indexable;
    case "blocked-robots":
      return Boolean(row.robotsTxtBlocked || /blocked/i.test(row.xRobotsTag || ""));
    case "canonicalized":
      return row.kind === "page" && isCanonicalized(row);
    case "self-canonical":
      return row.kind === "page" && isSelfCanonical(row);
    case "canonical-not-set":
      return row.kind === "page" && !row.canonicalUrl;
    case "canonical-to-not-found":
      return row.kind === "page" && isNotFoundStatus(canonicalTargetStatus(row, rowsByUrl));
    case "canonical-to-client-errors":
      return row.kind === "page" && isOtherClientErrorStatus(canonicalTargetStatus(row, rowsByUrl));
    case "canonical-to-server-error":
      return row.kind === "page" && isServerErrorStatus(canonicalTargetStatus(row, rowsByUrl));
    case "canonical-to-redirect":
      return row.kind === "page" && isRedirectStatus(canonicalTargetStatus(row, rowsByUrl));
    case "canonical-to-non-canonical": {
      const target = row.canonicalUrl ? rowsByUrl.get(row.canonicalUrl) : null;
      return row.kind === "page" && Boolean(target && isCanonicalized(target));
    }
    case "noindex":
      return hasRobotsDirective(row, "noindex") || !row.indexable;
    case "nofollow":
      return hasRobotsDirective(row, "nofollow");
    case "nosnippet":
      return hasRobotsDirective(row, "nosnippet");
    case "noindex-follow":
      return hasRobotsDirective(row, "noindex") && hasRobotsDirective(row, "follow") && !hasRobotsDirective(row, "nofollow");
    case "noindex-nofollow":
      return hasRobotsDirective(row, "noindex") && hasRobotsDirective(row, "nofollow");
    case "pages-in-sitemap":
      return isInSitemap(row);
    case "not-indexable-in-sitemap":
      return isInSitemap(row) && !row.indexable;
    case "indexable-not-in-sitemap":
      return row.indexable && !isInSitemap(row);
    case "multiple-sitemaps":
      return sitemapCount(row) > 1;
    case "sitemaps":
      return isSitemapRow(row);
    case "broken-sitemaps":
      return isSitemapRow(row) && isBrokenStatus(row.status);
    case "large-size-sitemaps":
      return isSitemapRow(row) && Number(row.sizeKb || 0) > 51200;
    case "external-pages":
    case "external-success":
    case "external-not-found":
    case "external-client-errors":
    case "external-server-errors":
    case "external-redirects":
    case "title-changed":
    case "serp-title-changed":
    case "meta-changed":
    case "h1-changed":
    case "word-count-changed":
    case "high-ai-content":
    case "indexable-became-non-indexable":
    case "noindex-became-indexable":
    case "canonical-modified":
    case "removed-from-sitemap":
    case "large-url-sitemaps":
      return false;
    default:
      return true;
  }
}

function tabLabelForExplorerFilter(filter) {
  if (filter === "all") return "All URLs";
  if (["html", "pages", "success", "not-found", "client-errors", "server-errors"].includes(filter)) return "Pages";
  if ([
    "non-html", "resources", "images", "large-images", "broken-images", "redirecting-images",
    "pages-missing-image-alt", "pages-broken-images", "pages-redirecting-images", "javascript",
    "broken-javascript", "redirecting-javascript", "pages-broken-javascript",
    "pages-redirecting-javascript", "css", "broken-css", "redirecting-css",
    "pages-broken-css", "pages-redirecting-css", "mixed-content",
  ].includes(filter)) return "Resources";
  if ([
    "title-missing", "title-too-long", "title-too-short", "title-changed",
    "title-serp-mismatch", "serp-title-changed", "meta-missing", "meta-too-long",
    "meta-too-short", "meta-changed", "h1-missing", "h1-changed",
    "low-word-count", "word-count-changed", "high-ai-content",
  ].includes(filter)) return "Content";
  if ([
    "links-to-not-found", "links-to-client-errors", "links-to-server-error",
    "links-to-redirect", "orphan-pages", "no-outgoing-links", "https-to-http",
  ].includes(filter)) return "Links";
  if ([
    "redirects", "redirect-to-not-found", "redirect-to-client-errors",
    "redirect-to-server-error", "redirect-chains", "redirect-loops",
  ].includes(filter)) return "Redirects";
  if ([
    "indexable", "non-indexable", "blocked-robots", "canonicalized", "self-canonical",
    "canonical-not-set", "canonical-to-not-found", "canonical-to-client-errors",
    "canonical-to-server-error", "canonical-to-redirect", "canonical-to-non-canonical",
    "noindex", "nofollow", "nosnippet", "noindex-follow", "noindex-nofollow",
  ].includes(filter)) return "Indexability";
  if ([
    "pages-in-sitemap", "not-indexable-in-sitemap", "indexable-not-in-sitemap",
    "multiple-sitemaps", "removed-from-sitemap", "sitemaps", "broken-sitemaps",
    "large-url-sitemaps", "large-size-sitemaps",
  ].includes(filter)) return "Sitemaps";
  return "All URLs";
}

function FilterMenuDropdown({ items, activeFilter, onSelect }) {
  return (
    <div className="absolute left-0 top-[calc(100%+4px)] z-[100] max-h-[72vh] w-72 overflow-y-auto rounded-md border border-white/10 bg-[#303034] py-1 text-sm shadow-2xl">
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
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="flex-shrink-0 tabular-nums text-white/55">{Number(item.count || 0).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}

function AdvancedFilterPanel({
  rule,
  setRule,
  logic,
  setLogic,
  version,
  setVersion,
  resultCount,
  operator,
  onReset,
}) {
  const needsValue = Boolean(operator?.needsValue);
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/70 backdrop-blur">
      <div className="border-b border-white/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-white/10">
            {[
              { key: "and", label: "AND" },
              { key: "or", label: "OR" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setLogic(item.key)}
                className={`px-3 py-1.5 text-xs font-semibold ${logic === item.key ? "bg-brand-500/25 text-brand-100" : "text-white/70 hover:bg-white/[0.06]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-white/10">
            {[
              { key: "previous", label: "Previous" },
              { key: "current", label: "Current" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setVersion(item.key)}
                className={`px-3 py-1.5 text-xs font-semibold ${version === item.key ? "bg-brand-500/25 text-brand-100" : "text-white/70 hover:bg-white/[0.06]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            value={rule.field}
            onChange={(event) => setRule((current) => ({ ...current, field: event.target.value }))}
            className="h-8 min-w-[260px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none"
          >
            {ADVANCED_FIELDS.map((field) => (
              <option key={field.key} value={field.key} className="bg-[#303034] text-white">
                {field.label}
              </option>
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
            className="h-8 min-w-[200px] rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none"
          >
            {ADVANCED_OPERATORS.map((item) => (
              <option key={item.key} value={item.key} className="bg-[#303034] text-white">
                {item.label}
              </option>
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
        <button onClick={onReset} className="font-semibold text-brand-300 hover:underline">
          Reset
        </button>
      </div>
    </div>
  );
}

export default function PageExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter") || "all";
  const urlFilterLabel = searchParams.get("label") || "";
  const [filter, setFilter] = useState(() => tabLabelForExplorerFilter(urlFilter));
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState("url");
  const [openMenu, setOpenMenu] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedLogic, setAdvancedLogic] = useState("and");
  const [advancedVersion, setAdvancedVersion] = useState("current");
  const [advancedRule, setAdvancedRule] = useState(DEFAULT_ADVANCED_RULE);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [titleOverrides, setTitleOverrides] = useState({});
  const { project } = useAuditData();
  const { stats } = useCrawl();

  const latestUrls = stats?.latestUrls || [];
  const auditIssues = stats?.auditIssues || {};
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Build all URL rows from real crawl data
  const urls = useMemo(
    () => buildPageRows(latestUrls, auditIssues),
    [latestUrls, auditIssues]
  );
  const rowsByUrl = useMemo(() => new Map(urls.map((row) => [row.url, row])), [urls]);
  const filterMenus = useMemo(() => buildFilterMenus(urls, auditIssues), [urls, auditIssues]);
  const currentSearchScope = SEARCH_SCOPES.find((scope) => scope.key === searchScope) || SEARCH_SCOPES[0];
  const activeAdvancedOperator = ADVANCED_OPERATORS.find((operator) => operator.key === advancedRule.operator) || ADVANCED_OPERATORS[0];

  // Apply search filter
  const filteredUrls = useMemo(() => {
    let filterMatched = urls.filter((u) => matchesExplorerFilter(u, urlFilter, rowsByUrl));
    if (advancedOpen) {
      filterMatched = filterMatched.filter((u) => matchesAdvancedRule(u, advancedRule));
    }
    if (!deferredSearchQuery.trim()) return filterMatched;
    const q = deferredSearchQuery.toLowerCase();
    return filterMatched.filter(
      (u) => rowSearchHaystack(u, searchScope).toLowerCase().includes(q)
    );
  }, [urls, deferredSearchQuery, urlFilter, rowsByUrl, searchScope, advancedOpen, advancedRule]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearchQuery, filter, urlFilter, searchScope, advancedOpen, advancedRule]);

  useEffect(() => {
    setFilter(tabLabelForExplorerFilter(urlFilter));
  }, [urlFilter]);

  const hasUrlFilter = urlFilter !== "all";
  const totalCount = hasUrlFilter ? filteredUrls.length : urls.length || project.totalUrls;

  function applyExplorerFilter(item) {
    if (!item?.filter) return;
    const nextParams = new URLSearchParams(searchParams);
    if (item.filter === "all") {
      nextParams.delete("filter");
      nextParams.delete("label");
    } else {
      nextParams.set("filter", item.filter);
      nextParams.set("label", item.label);
    }
    setSearchParams(nextParams);
    setFilter(tabLabelForExplorerFilter(item.filter));
    setOpenMenu(null);
  }

  useEffect(() => {
    const missingTitles = urls
      .filter((item) => item.kind === "page" && !item.rawTitle && !titleOverrides[item.url])
      .slice(0, 20);
    if (!missingTitles.length) return;

    let cancelled = false;
    Promise.allSettled(
      missingTitles.map(async (item) => {
        const response = await fetch(`/api/fetch-url-meta?url=${encodeURIComponent(item.url)}`);
        const payload = await response.json();
        return [item.url, payload?.title || ""];
      })
    ).then((results) => {
      if (cancelled) return;
      const nextTitles = Object.fromEntries(
        results
          .filter((result) => result.status === "fulfilled" && result.value[1])
          .map((result) => result.value)
      );
      if (Object.keys(nextTitles).length) {
        setTitleOverrides((current) => ({ ...current, ...nextTitles }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [urls, titleOverrides]);

  const resultTabs = [
    { label: "All filter results", count: totalCount, active: true },
    { label: "Lost from filter results", count: 0 },
    { label: "Lost", count: 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          Page explorer
          <HelpCircle className="h-4 w-4 text-white/30" />
        </h1>
      </div>

      {/* Filters bar */}
      <div className="relative z-[80] flex flex-wrap items-center gap-1.5 overflow-visible rounded-2xl border border-white/10 bg-ink-800/60 p-1.5 backdrop-blur">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.label || (tab.filter && urlFilter === tab.filter);
          return (
            <div key={tab.key} className="relative">
              <button
                onClick={() => {
                  setFilter(tab.label);
                  if (tab.filter) {
                    applyExplorerFilter({ label: tab.label, filter: tab.filter });
                    return;
                  }
                  setOpenMenu((current) => (current === tab.key ? null : tab.key));
                }}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-brand-500/20 text-brand-100 ring-1 ring-inset ring-brand-500/30" : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {tab.label}
                {tab.drop && <ChevronDown className={`h-3 w-3 opacity-70 transition ${openMenu === tab.key ? "rotate-180" : ""}`} />}
              </button>
              {tab.drop && openMenu === tab.key && (
                <FilterMenuDropdown
                  items={filterMenus[tab.label] || []}
                  activeFilter={urlFilter}
                  onSelect={applyExplorerFilter}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
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
                    }}
                    className={`block w-full px-3 py-1.5 text-left ${searchScope === scope.key ? "bg-brand-500/25 text-white" : "text-white hover:bg-white/[0.06]"}`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hasUrlFilter && (
            <button
              onClick={() => applyExplorerFilter({ label: "All URLs", filter: "all" })}
              className="flex h-8 items-center gap-2 rounded-md bg-brand-500/20 px-2.5 text-xs font-semibold text-brand-100 ring-1 ring-inset ring-brand-500/35 hover:bg-brand-500/25"
            >
              {urlFilterLabel || filter} <X className="h-3.5 w-3.5" />
            </button>
          )}
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
          setRule={setAdvancedRule}
          logic={advancedLogic}
          setLogic={setAdvancedLogic}
          version={advancedVersion}
          setVersion={setAdvancedVersion}
          resultCount={filteredUrls.length}
          operator={activeAdvancedOperator}
          onReset={() => setAdvancedRule(DEFAULT_ADVANCED_RULE)}
        />
      )}

      {/* Crawl history */}
      <details className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold">
          <span className="flex items-center gap-1">
            Crawl history <HelpCircle className="h-3.5 w-3.5 text-white/30" />
          </span>
          <span className="text-xs text-white/50">Show chart</span>
        </summary>
      </details>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {resultTabs.map((t) => (
              <button
                key={t.label}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  t.active ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"
                }`}
              >
                {t.label}
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${t.active ? "bg-brand-500/30 text-brand-100" : "bg-white/5"}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Plus className="h-3.5 w-3.5" /> Patches <ChevronDown className="h-3 w-3" />
            </button>
            <button className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08] lg:flex">
              Changes: Don't show <ChevronDown className="h-3 w-3" />
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
                <th className="px-3 py-3 font-medium">PR ▾</th>
                <th className="px-3 py-3 font-medium">URL</th>
                <th className="px-3 py-3 text-right font-medium">Organic traffic</th>
                <th className="px-3 py-3 text-center font-medium">HTTP status code</th>
                <th className="px-3 py-3 font-medium">Content type</th>
                <th className="px-3 py-3 text-center font-medium">Depth</th>
                <th className="px-3 py-3 text-center font-medium">Is indexable page</th>
                <th className="px-3 py-3 text-right font-medium">No. of all inlinks</th>
                <th className="px-3 py-3 font-medium">First found at</th>
              </tr>
            </thead>
            <tbody>
              {filteredUrls.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Folder className="h-10 w-10 text-white/20" />
                      <p className="text-sm font-medium text-white/50">
                        {searchQuery ? "No URLs match your search" : hasUrlFilter ? "No URLs match this filter" : "No crawl data yet"}
                      </p>
                      <p className="text-xs text-white/30">
                        {searchQuery || hasUrlFilter ? "Try a different filter or clear the active filter." : "Run a crawl on your project to populate the page explorer."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUrls.slice(0, visibleCount).map((u, i) => {
                  const displayTitle = titleOverrides[u.url] || u.title;
                  const typeLabel = u.ct.includes("html") ? "HTML" : u.ct.includes("css") ? "CSS" : u.ct.includes("javascript") ? "JS" : u.ct.includes("image") ? "IMG" : u.ct.includes("xml") ? "XML" : "—";
                  const typeColor = u.ct.includes("html") ? "from-emerald-500/20 to-emerald-500/5 text-emerald-300" : u.ct.includes("css") ? "from-sky-500/20 to-sky-500/5 text-sky-300" : u.ct.includes("javascript") ? "from-amber-500/20 to-amber-500/5 text-amber-300" : u.ct.includes("image") ? "from-blue-500/20 to-blue-500/5 text-blue-300" : "from-white/[0.06] to-transparent text-white/40";
                  const crawledAt = u.time ? new Date(u.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—";

                  return (
                    <tr key={i} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]">
                      <td className="px-3 py-3">
                        <PRBadge value={u.pr} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-bold ${typeColor}`}>
                            {typeLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{displayTitle}</p>
                            <a href={u.url} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-xs leading-snug text-brand-300 hover:underline">
                              <span className="break-all">{u.url}</span>
                              <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-white/60">0</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${u.status === 0 ? "bg-zinc-500/15 text-zinc-400" : u.status < 300 ? "bg-emerald-500/15 text-emerald-400" : u.status < 400 ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>{u.status || "ERR"}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-white/60">{u.ct}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-white/70">{u.depth}</td>
                      <td className="px-3 py-3 text-center text-white/70">{u.indexable ? "Yes" : "No"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-brand-300 hover:underline cursor-pointer" onClick={() => setSelectedUrl({ ...u, title: displayTitle })}>{u.inlinks} ↗</td>
                      <td className="px-3 py-3 text-xs text-white/50">{crawledAt}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Show more footer */}
        {filteredUrls.length > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-white/10 py-4">
            {visibleCount < filteredUrls.length && (
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
                  style={{ width: `${Math.min(100, (Math.min(visibleCount, filteredUrls.length) / filteredUrls.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white/40">
                Showing {Math.min(visibleCount, filteredUrls.length).toLocaleString()} of {filteredUrls.length.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
      {selectedUrl && <InlinksPanel page={selectedUrl} onClose={() => setSelectedUrl(null)} />}
    </div>
  );
}

function PRBadge({ value }) {
  const color =
    value >= 40
      ? "from-emerald-500/30 to-emerald-500/10 text-emerald-200 ring-emerald-500/30"
      : value >= 20
      ? "from-amber-500/30 to-amber-500/10 text-amber-200 ring-amber-500/30"
      : "from-white/[0.06] to-transparent text-white/40 ring-white/10";
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-xs font-bold ring-1 ring-inset ${color}`}>
      {value}
    </span>
  );
}

/* ---------- Inlinks Detail Panel ---------- */
const LINK_TABS = [
  { key: "all", label: "All inlinks", countKey: "allInlinks" },
  { key: "href", label: "Href inlinks", countKey: "hrefInlinks" },
  { key: "redirect", label: "Redirect inlinks", countKey: "redirectInlinks" },
  { key: "canonical", label: "Canonical inlinks", countKey: "canonicalInlinks" },
  { key: "outInternal", label: "Outlinks internal", countKey: "outlinksInternal" },
  { key: "outExternal", label: "Outlinks external", countKey: "outlinksExternal" },
];

function InlinksPanel({ page, onClose }) {
  const [activeTab, setActiveTab] = useState("all");
  const [panelNav, setPanelNav] = useState("overview");
  const [search, setSearch] = useState("");
  const domain = page.url.replace(/https?:\/\//, "").replace(/\/.*/, "");

  const counts = {
    allInlinks: page.incomingLinks?.length || page.inlinks || 0,
    hrefInlinks: page.incomingLinks?.filter((link) => link.type === "Href link").length || 0,
    redirectInlinks: page.incomingLinks?.filter((link) => Number(link.status) >= 300 && Number(link.status) < 400).length || 0,
    canonicalInlinks: page.incomingLinks?.filter((link) => link.type === "Canonical").length || 0,
    outlinksInternal: page.outgoingLinks?.filter((link) => link.internal).length || 0,
    outlinksExternal: page.outgoingLinks?.filter((link) => !link.internal).length || 0,
    imageRes: page.resources?.filter((item) => item.type === "Image").length || 0,
    cssRes: page.resources?.filter((item) => item.type === "CSS").length || 0,
    jsRes: page.resources?.filter((item) => item.type === "JavaScript").length || 0,
  };

  const linkData = useMemo(() => {
    const incoming = page.incomingLinks || [];
    const outgoing = page.outgoingLinks || [];
    if (activeTab === "all") return incoming;
    if (activeTab === "href") return incoming.filter((link) => link.type === "Href link");
    if (activeTab === "redirect") return incoming.filter((link) => Number(link.status) >= 300 && Number(link.status) < 400);
    if (activeTab === "canonical") return incoming.filter((link) => link.type === "Canonical");
    if (activeTab === "outInternal") return outgoing.filter((link) => link.internal);
    if (activeTab === "outExternal") return outgoing.filter((link) => !link.internal);
    return [];
  }, [activeTab, page.incomingLinks, page.outgoingLinks]);

  const isInlink = ["all", "href", "redirect", "canonical"].includes(activeTab);
  const isOutExternal = activeTab === "outExternal";
  const showAnchor = activeTab === "all" || activeTab === "href" || activeTab === "outInternal" || activeTab === "outExternal";
  const showStatus = activeTab !== "canonical";
  const filteredLinks = search ? linkData.filter(l => l.url.toLowerCase().includes(search.toLowerCase())) : linkData;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-[1050px] bg-[#161620] shadow-2xl">
        {/* Header */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 text-[9px] font-bold text-emerald-300">HTML</span>
                <h2 className="truncate text-sm font-semibold text-white">{page.title}</h2>
              </div>
              <a href={page.url} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-brand-300 hover:underline">
                {page.url} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/[0.08]">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar nav */}
            <div className="w-[170px] flex-shrink-0 border-r border-white/10 py-3">
              {["Overview", "Issues"].map(n => (
                <button key={n} onClick={() => setPanelNav(n.toLowerCase())} className={`flex w-full items-center justify-between px-4 py-1.5 text-xs ${panelNav === n.toLowerCase() ? "bg-white/[0.06] text-white font-semibold" : "text-white/60 hover:text-white"}`}>
                  {n}
                  {n === "Issues" && <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">1</span>}
                </button>
              ))}
              <div className="my-2 border-t border-white/10" />
              {LINK_TABS.map(t => (
                <button key={t.key} onClick={() => { setActiveTab(t.key); setPanelNav("links"); }} className={`flex w-full items-center justify-between px-4 py-1.5 text-xs ${activeTab === t.key && panelNav === "links" ? "bg-white/[0.06] text-white font-semibold" : "text-white/60 hover:text-white"}`}>
                  <span className="truncate">{t.label}</span>
                  <span className="ml-1 tabular-nums text-white/40">{counts[t.countKey]}</span>
                </button>
              ))}
              <div className="my-2 border-t border-white/10" />
              {[
                {l:"Hreflangs",c:(page.audit?.hreflangs || page.hreflangs || []).length || 0,k:"hreflangs"},
                {l:"Duplicates",c:Number(page.audit?.duplicateCount || 0),k:"duplicates"},
              ].map(x=>(
                <button key={x.l} onClick={() => setPanelNav(x.k)} className={`flex w-full items-center justify-between px-4 py-1.5 text-xs ${panelNav === x.k ? "bg-white/[0.06] text-white font-semibold" : "text-white/60 hover:text-white"}`}>
                  <span>{x.l}</span><span className="tabular-nums text-white/40">{x.c}</span>
                </button>
              ))}
              <div className="my-2 border-t border-white/10" />
              {[{l:"Image resources",c:counts.imageRes,k:"imageRes"},{l:"CSS resources",c:counts.cssRes,k:"cssRes"},{l:"JavaScript resources",c:counts.jsRes,k:"jsRes"}].map(x=>(
                <button key={x.l} onClick={() => setPanelNav(x.k)} className={`flex w-full items-center justify-between px-4 py-1.5 text-xs ${panelNav === x.k ? "bg-white/[0.06] text-white font-semibold" : "text-white/60 hover:text-white"}`}>
                  <span>{x.l}</span><span className="tabular-nums text-white/40">{x.c}</span>
                </button>
              ))}
              <div className="my-2 border-t border-white/10" />
              <button onClick={() => setPanelNav("structuredData")} className={`flex w-full items-center justify-between px-4 py-1.5 text-xs ${panelNav === "structuredData" ? "bg-white/[0.06] text-white font-semibold" : "text-white/60 hover:text-white"}`}>
                <span>Structured data</span><span className="tabular-nums text-white/40">{(page.audit?.structuredData || []).length || 0}</span>
              </button>
              <div className="my-2 border-t border-white/10" />
              <button onClick={() => setPanelNav("viewSource")} className={`px-4 py-1.5 text-xs ${panelNav === "viewSource" ? "text-white font-semibold" : "text-white/60 hover:text-white"}`}>View source</button>
            </div>

            {/* Right content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {panelNav === "overview" && <OverviewContent page={page} domain={domain} />}
              {panelNav === "issues" && <IssuesContent page={page} />}
              {panelNav === "hreflangs" && <HreflangsContent page={page} />}
              {panelNav === "duplicates" && <DuplicatesContent page={page} domain={domain} />}
              {(panelNav === "imageRes" || panelNav === "cssRes" || panelNav === "jsRes") && <ResourceContent page={page} kind={panelNav} />}
              {panelNav === "structuredData" && <StructuredDataContent page={page} />}
              {panelNav === "viewSource" && <ViewSourceContent page={page} />}
              {panelNav === "links" && (
                <>
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                    <div className="flex items-center gap-2">
                      {(activeTab === "outInternal" || activeTab === "outExternal") && (
                        <>
                          <button className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] text-white/70">Status <ChevronDown className="h-3 w-3" /></button>
                          <button className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] text-white/70">Follow <ChevronDown className="h-3 w-3" /></button>
                        </>
                      )}
                      <div className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                        <Search className="h-3 w-3 text-white/40" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="w-24 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none" />
                      </div>
                    </div>
                    <button className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]">
                      <ExternalLink className="h-3 w-3" /> Open in Link Explorer
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#161620]">
                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                          {isInlink && !showAnchor && <th className="px-4 py-2 font-medium">Source URL</th>}
                          {isInlink && showAnchor && (<><th className="px-4 py-2 font-medium">Link type</th><th className="px-4 py-2 font-medium">Source URL</th><th className="px-4 py-2 font-medium">Anchor</th><th className="px-4 py-2 font-medium">Dofollow</th></>)}
                          {!isInlink && (<><th className="px-4 py-2 font-medium">Target URL</th>{showStatus && <th className="px-4 py-2 font-medium">Status</th>}{showAnchor && <th className="px-4 py-2 font-medium">Anchor</th>}<th className="px-4 py-2 font-medium">Dofollow</th></>)}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLinks.map((l, i) => (
                          <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                            {isInlink && showAnchor && (<><td className="px-4 py-2 text-xs text-white/50">{l.type || "Href link"}</td><td className="px-4 py-2"><a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-300 hover:underline break-all">{l.url} <Search className="h-3 w-3 flex-shrink-0 text-white/30" /></a></td><td className="px-4 py-2 text-xs text-white/70">{l.anchor || <span className="text-white/30">Not captured</span>}</td><td className="px-4 py-2">{l.dofollow ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}</td></>)}
                            {isInlink && !showAnchor && (<td className="px-4 py-2"><span className="flex items-center gap-2 text-xs text-brand-300 break-all">{l.url} <Search className="h-3 w-3 flex-shrink-0 text-white/30" />{l.selfRef && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Self-reference</span>}{l.status === 301 && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">301</span>}</span></td>)}
                            {!isInlink && (<><td className="px-4 py-2"><a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-300 hover:underline break-all">{l.url} {isOutExternal ? <ExternalLink className="h-3 w-3 flex-shrink-0" /> : <Search className="h-3 w-3 flex-shrink-0 text-white/30" />}</a></td>{showStatus && <td className="px-4 py-2">{l.status ? <span className={`rounded px-2 py-0.5 text-xs font-bold ${l.status < 300 ? "bg-emerald-500/15 text-emerald-400" : l.status < 400 ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>{l.status}</span> : <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/50">Not crawled</span>}</td>}{showAnchor && <td className="px-4 py-2 text-xs text-white/70">{l.anchor}</td>}<td className="px-4 py-2">{l.dofollow ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}</td></>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Overview Content ---------- */
function InfoRow({ label, children }) {
  return (
    <div className="flex py-1.5 text-xs">
      <span className="w-[160px] flex-shrink-0 text-right pr-4 text-white/40">{label}</span>
      <span className="text-white/80">{children}</span>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer items-center gap-1 py-2 text-sm font-semibold text-white">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-0 -rotate-90 text-white/40" />
        {title}
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

function OverviewContent({ page }) {
  const canonicalUrl = page.canonicalUrl || "";
  const crawledAt = page.time
    ? new Date(page.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
    : "--";
  const robots = String(page.robotsMeta || "").split(",").map((item) => item.trim()).filter(Boolean);
  const h1s = page.headings?.filter((heading) => heading.tag === "h1").map((heading) => heading.text).filter(Boolean) || [];
  const h2s = page.headings?.filter((heading) => heading.tag === "h2").map((heading) => heading.text).filter(Boolean) || [];
  const ogTags = page.audit?.ogTags || {};
  const twitterTags = page.audit?.twitterTags || {};
  const contentWords = Number(page.audit?.wordCount || 0) || String(page.contentText || "").split(/\s+/).filter(Boolean).length;
  const contentChars = String(page.contentText || "").length;
  const statusClass = page.status >= 200 && page.status < 300
    ? "bg-emerald-500/15 text-emerald-400"
    : page.status >= 300 && page.status < 400
      ? "bg-amber-500/15 text-amber-400"
      : "bg-rose-500/15 text-rose-400";

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <div className="flex items-center gap-6 pb-5 border-b border-white/10 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full border-4 border-purple-500 flex items-center justify-center">
            <span className="text-lg font-bold text-white">PR</span>
          </div>
          <span className="text-3xl font-bold text-white">{page.pr || 0}</span>
        </div>
        <div className="text-center"><div className="text-[10px] uppercase text-white/40">Errors</div><div className="text-xl font-bold text-white">0</div></div>
        <div className="text-center"><div className="text-[10px] uppercase text-white/40">Warnings</div><div className="text-xl font-bold text-amber-400">0</div></div>
        <div className="text-center"><div className="text-[10px] uppercase text-white/40">Notices</div><div className="text-xl font-bold text-blue-400">0</div></div>
        <div className="text-center"><div className="text-[10px] uppercase text-white/40">Crawled</div><div className="text-xs text-white/60">{crawledAt}</div></div>
        <button className="ml-auto flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300"><RotateCcw className="h-3.5 w-3.5" /> Recrawl</button>
      </div>

      <Section title="URL info">
        <InfoRow label="Type">{page.kind === "page" ? "HTML page" : page.kind === "image" ? "Image resource" : "Resource"}</InfoRow>
        <InfoRow label="Internal URL">Yes</InfoRow>
        <InfoRow label="Full URL"><a href={page.url} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">{page.url} <ExternalLink className="inline h-3 w-3" /></a></InfoRow>
        <InfoRow label="HTTP status code"><span className={`rounded px-2 py-0.5 text-xs font-bold ${statusClass}`}>{page.status || "Error"}</span></InfoRow>
        <InfoRow label="First found at">{page.sourceIndex === 0 ? "Seed URL" : "Crawler discovery queue"}</InfoRow>
        <InfoRow label="Content type">{page.ct}</InfoRow>
        <InfoRow label="Depth">{page.depth}</InfoRow>
        <InfoRow label="Is indexable">{page.indexable ? "Yes" : "No"}</InfoRow>
        <InfoRow label="Canonical URL">{canonicalUrl ? <><a href={canonicalUrl} className="text-brand-300 hover:underline">{canonicalUrl} <Search className="inline h-3 w-3 text-white/30" /></a> {sameUrl(canonicalUrl, page.url) && <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Self-reference</span>}</> : <span className="italic text-white/30">Not captured</span>}</InfoRow>
        <InfoRow label="Meta robots">{robots.length ? <ol className="list-decimal list-inside space-y-0.5">{robots.map((robot) => <li key={robot}>{robot}</li>)}</ol> : <span className="italic text-white/30">Not captured</span>}</InfoRow>
        <InfoRow label="X-robots-tag (HTTP header)">{page.xRobotsTag ? page.xRobotsTag : <span className="italic text-white/30">Missing</span>}</InfoRow>
        <InfoRow label="Present in sitemap">{page.audit?.presentInSitemap ? "Yes" : <span className="italic text-white/30">Not captured</span>}</InfoRow>
      </Section>

      <Section title="HTTP headers" defaultOpen={false} />

      <Section title="Performance">
        <InfoRow label="Time to first byte">{page.loadTime || 0} ms</InfoRow>
        <InfoRow label="Loading time">{page.loadTime || 0} ms</InfoRow>
        <InfoRow label="Size">{page.sizeKb || 0} KB</InfoRow>
        <InfoRow label="Compression">{page.audit?.contentEncoding || page.contentEncoding || <span className="italic text-white/30">Not captured</span>}</InfoRow>
      </Section>

      <Section title="Content">
        <InfoRow label="Title">{page.title}</InfoRow>
        <InfoRow label="Meta description">{page.metaDescription || <span className="italic text-white/30">Missing</span>}</InfoRow>
        <InfoRow label="H1">{h1s.length ? <ol className="list-decimal list-inside space-y-0.5">{h1s.map((h1, index) => <li key={`${h1}-${index}`}>{h1}</li>)}</ol> : page.h1 || <span className="italic text-white/30">Missing</span>}</InfoRow>
        <InfoRow label="H2">{h2s.length ? h2s.slice(0, 5).join(", ") : <span className="italic text-white/30">Not captured</span>}</InfoRow>
        <InfoRow label="Content">{contentChars.toLocaleString()} characters {contentWords.toLocaleString()} words</InfoRow>
        <InfoRow label="HTML lang">{page.audit?.htmlLang || page.htmlLang || <span className="italic text-white/30">Not captured</span>}</InfoRow>
      </Section>

      <Section title="Open graph tags">
        {Object.keys(ogTags).length ? Object.entries(ogTags).map(([key, value]) => (
          <InfoRow key={key} label={key}>{String(value) || <span className="italic text-white/30">Empty</span>}</InfoRow>
        )) : <InfoRow label="Open graph"><span className="italic text-white/30">No tags captured</span></InfoRow>}
      </Section>

      <Section title="X (Twitter) card">
        {Object.keys(twitterTags).length ? Object.entries(twitterTags).map(([key, value]) => (
          <InfoRow key={key} label={key}>{String(value) || <span className="italic text-white/30">Empty</span>}</InfoRow>
        )) : <InfoRow label="Twitter card"><span className="italic text-white/30">No tags captured</span></InfoRow>}
      </Section>
    </div>
  );
}
/* ---------- Issues Content ---------- */
function IssuesContent({ page }) {
  const capturedIssues = page.audit?.issues || [];
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/45">
        Page issues
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">
        {capturedIssues.length ? (
          capturedIssues.map((item, index) => (
            <div key={`${item.title || item.slug}-${index}`} className="flex items-center justify-between border-b border-white/[0.04] py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-amber-500/20 text-center text-[9px] font-bold leading-4 text-amber-400">i</span>
                <span className="text-xs text-white/80">{item.title || item.slug}</span>
              </div>
              {item.howToFix && <span className="text-xs text-white/45">{item.howToFix}</span>}
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            No page-level issue list captured for this URL.
          </div>
        )}
      </div>
    </div>
  );
}
/* ---------- Hreflangs Content (empty state) ---------- */
function HreflangsContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mb-4 opacity-40">
        <circle cx="60" cy="85" rx="35" ry="8" fill="#333" />
        <path d="M45 75c0 0-5-15 0-30s20-20 30-15 15 20 10 35" stroke="#555" strokeWidth="2" fill="#2a2a3a" />
        <circle cx="55" cy="50" r="3" fill="#555" />
        <circle cx="70" cy="48" r="2.5" fill="#555" />
        <path d="M52 62c3 3 15 3 18 0" stroke="#555" strokeWidth="1.5" fill="none" />
        <line x1="50" y1="35" x2="45" y2="22" stroke="#555" strokeWidth="1.5" />
        <circle cx="44" cy="20" r="3" fill="#444" />
        <line x1="72" y1="33" x2="78" y2="20" stroke="#555" strokeWidth="1.5" />
        <circle cx="79" cy="18" r="2.5" fill="#444" />
      </svg>
      <p className="text-sm text-white/40">No URLs found</p>
    </div>
  );
}

/* ---------- Duplicates Content ---------- */
function DuplicatesContent({ page }) {
  const duplicateRows = page.audit?.duplicates || [];
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Duplicate evidence</span>
        <button className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]">
          <ExternalLink className="h-3 w-3" /> Open in Page Explorer
        </button>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        <h3 className="mb-3 text-sm font-bold text-white">Target page</h3>
        <InfoRow label="URL"><a href={page.url} className="text-brand-300 hover:underline">{page.url} <Search className="inline h-3 w-3 text-white/30" /></a></InfoRow>
        <InfoRow label="Canonical URL">{page.canonicalUrl ? <a href={page.canonicalUrl} className="text-brand-300 hover:underline">{page.canonicalUrl} <Search className="inline h-3 w-3 text-white/30" /></a> : <span className="italic text-white/30">Not captured</span>}</InfoRow>
        <InfoRow label="Title">{page.title}</InfoRow>
        <InfoRow label="Meta description">{page.metaDescription || <span className="italic text-white/30">Missing</span>}</InfoRow>
        <InfoRow label="H1">{page.h1 || <span className="italic text-white/30">Missing</span>}</InfoRow>

        <div className="my-6 border-t border-white/10" />

        <h3 className="mb-3 text-sm font-bold text-white">Pages with duplicates</h3>
        {duplicateRows.length ? (
          duplicateRows.map((row, index) => (
            <div key={`${row.url}-${index}`} className="mb-4 border-b border-white/[0.06] pb-4">
              <InfoRow label="URL"><a href={row.url} className="text-brand-300 hover:underline">{row.url} <Search className="inline h-3 w-3 text-white/30" /></a></InfoRow>
              <InfoRow label="Element">{row.field || "Content"}</InfoRow>
              <InfoRow label="Match">{row.value || row.reason || "Duplicate value captured"}</InfoRow>
            </div>
          ))
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-white/40">
            No duplicate clusters captured for this URL.
          </div>
        )}
      </div>
    </div>
  );
}
/* ---------- Empty Resource Content (Image/CSS/JS) ---------- */
function EmptyResourceContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mb-4 opacity-40">
        <circle cx="60" cy="85" rx="35" ry="8" fill="#333" />
        <path d="M45 75c0 0-5-15 0-30s20-20 30-15 15 20 10 35" stroke="#555" strokeWidth="2" fill="#2a2a3a" />
        <circle cx="55" cy="50" r="3" fill="#555" />
        <circle cx="70" cy="48" r="2.5" fill="#555" />
        <path d="M52 62c3 3 15 3 18 0" stroke="#555" strokeWidth="1.5" fill="none" />
        <line x1="50" y1="35" x2="45" y2="22" stroke="#555" strokeWidth="1.5" />
        <circle cx="44" cy="20" r="3" fill="#444" />
        <line x1="72" y1="33" x2="78" y2="20" stroke="#555" strokeWidth="1.5" />
        <circle cx="79" cy="18" r="2.5" fill="#444" />
      </svg>
      <p className="text-sm text-white/40">No URLs found</p>
    </div>
  );
}

function ResourceContent({ page, kind }) {
  const typeByKind = {
    imageRes: "Image",
    cssRes: "CSS",
    jsRes: "JavaScript",
  };
  const type = typeByKind[kind];
  const resources = (page.resources || []).filter((item) => item.type === type);

  if (!resources.length) return <EmptyResourceContent />;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2 py-1">
          <Search className="h-3 w-3 text-white/40" />
          <input placeholder="Search" className="w-24 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none" />
        </div>
        <button className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]">
          <ExternalLink className="h-3 w-3" /> Open in Link Explorer
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#161620]">
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-2 font-medium">Link type</th>
              <th className="px-4 py-2 font-medium">Target URL</th>
              <th className="px-4 py-2 font-medium">Target HTTP status code</th>
              {type === "Image" && <th className="px-4 py-2 font-medium">Image type</th>}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource, i) => (
              <tr key={`${resource.url}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-xs text-white/70">{type}</td>
                <td className="px-4 py-2">
                  <a href={resource.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-300 hover:underline break-all">
                    {resource.url} <Search className="h-3 w-3 flex-shrink-0 text-white/30" />
                  </a>
                </td>
                <td className="px-4 py-2">
                  {resource.status ? (
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${resource.status < 300 ? "bg-emerald-500/15 text-emerald-400" : resource.status < 400 ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>
                      {resource.status}
                    </span>
                  ) : (
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/50">Not crawled</span>
                  )}
                </td>
                {type === "Image" && <td className="px-4 py-2 text-xs text-white/70">{resource.imageType || "Content"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Structured Data Content ---------- */
function StructuredDataContent({ page }) {
  const items = page.audit?.structuredData || page.audit?.jsonLd || [];
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/45">
        Structured data
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        {items.length ? (
          items.map((item, index) => (
            <Section key={index} title={item["@type"] || item.type || `Structured item ${index + 1}`}>
              {Object.entries(item).map(([key, value]) => (
                <InfoRow key={key} label={key}>{typeof value === "object" ? JSON.stringify(value) : String(value)}</InfoRow>
              ))}
            </Section>
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Structured data was not captured for this URL.
          </div>
        )}
      </div>
    </div>
  );
}
/* ---------- View Source Content ---------- */
function ViewSourceContent({ page }) {
  const [sourceTab, setSourceTab] = useState("pageText");
  const sourceTabs = [
    { key: "pageText", label: "Page text", color: "bg-orange-500" },
    { key: "raw", label: "Raw HTML" },
    { key: "rendered", label: "Rendered HTML" },
  ];
  const lines = String(page.contentText || "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 500);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-1.5">
          {sourceTabs.map(t => (
            <button key={t.key} onClick={() => setSourceTab(t.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${sourceTab === t.key ? (t.color ? t.color + " text-white" : "bg-white/[0.08] text-white") : "text-white/55 hover:bg-white/[0.04]"}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/45">
          <Code2 className="h-3 w-3" /> Captured crawl row
        </div>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs">
        {sourceTab === "pageText" && lines.length ? (
          lines.map((line, i) => (
            <div key={i} className="flex hover:bg-white/[0.02]">
              <span className="w-10 flex-shrink-0 select-none py-0.5 pr-3 text-right tabular-nums text-white/20">{i + 1}</span>
              <pre className="flex-1 whitespace-pre-wrap break-all py-0.5 text-white/70">{line}</pre>
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/40">
            {sourceTab === "pageText"
              ? "No page text was captured for this URL."
              : "Raw and rendered HTML are not persisted in the current crawl data."}
          </div>
        )}
      </div>
    </div>
  );
}
