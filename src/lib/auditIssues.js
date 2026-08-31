const ISSUE_URL_LIMIT = 250;

const HTML_RE = /text\/html|application\/xhtml/i;
const CSS_RE = /text\/css/i;
const JS_RE = /javascript|ecmascript/i;
const IMAGE_RE = /image\//i;

const SLUG_ALIASES = {
  "meta-description-tag-missing-or-empty": "meta-description-missing",
  "open-graph-tags-incomplete": "og-tags-incomplete",
  "x-twitter-card-incomplete": "twitter-card-incomplete",
};

export function slugifyIssueTitle(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/googlebot's/g, "googlebots")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function issueSlug(row) {
  const rawSlug = row.slug || slugifyIssueTitle(row.title);
  return SLUG_ALIASES[rawSlug] || rawSlug;
}

export function buildFindingsFromCrawl(result, row, session) {
  const findings = [];
  const audit = result.audit || {};
  const url = row.url;
  const status = Number(row.status || 0);
  const contentType = String(row.contentType || "");
  const isHtml = HTML_RE.test(contentType);
  const isSuccessfulHtml = isHtml && status >= 200 && status < 300;
  const isSitemapUrl = session.sitemapUrls?.has(normalizeEvidenceUrl(url));
  const xRobots = String(result.xRobotsTag || "").toLowerCase();
  const noindexHeader = /\bnoindex\b/.test(xRobots);
  const nofollowHeader = /\bnofollow\b/.test(xRobots);
  const noindex = Boolean(audit.noindex || noindexHeader);
  const nofollow = Boolean(audit.nofollow || nofollowHeader);

  const add = (slug, title, severity = "warning", extras = {}) => {
    findings.push({
      slug,
      title,
      severity,
      fixable: ["error", "warning"].includes(severity),
      url: {
        pr: Math.max(0, Math.min(99, Math.round(60 - findings.length * 3))),
        title: audit.titleText || title,
        url,
        traffic: 0,
        status,
        indexable: isHtml && status >= 200 && status < 300 && !noindex,
        noindex,
        nofollow,
        robots: [
          noindex ? "noindex" : "index",
          nofollow ? "nofollow" : "follow",
        ],
        headers: result.xRobotsTag || "",
        ...extras,
      },
    });
  };

  const addTitleMissingIssue = () => {
    const missing = Number(audit.titleCount || 0) === 0;
    add("title-tag-missing-or-empty", "Title tag missing or empty", "error", {
      title: pageLabelFromUrl(url),
      titleTag: "",
      titleTagStatus: missing ? "Missing" : "Empty",
      titleCount: Number(audit.titleCount || 0),
      titleLength: 0,
    });
  };

  if (status === 0) add("timed-out", "Timed out", "error");
  if (status === 404) add("404-page", "404 page", "error");
  if (status >= 400 && status < 500) add("4xx-page", "4XX page", "error");
  if (status >= 500) add("5xx-page", "5XX page", "error");
  if (status >= 300 && status < 400) {
    add("3xx-redirect", "3XX redirect", "warning");
    if (status === 302) add("302-redirect", "302 redirect", "warning");
    if (isSitemapUrl) add("3xx-redirect-sitemap", "3XX redirect in sitemap", "error");
  }

  if (isResource(contentType, url, "css")) {
    if (status >= 400 || status === 0) {
      add("css-broken", "CSS broken", "warning");
      add("page-has-broken-css", "Page has broken CSS", "warning");
    }
    if (status >= 300 && status < 400) add("css-redirects", "CSS redirects", "warning");
    if (Number(row.sizeKb || 0) > 250) add("css-file-size-too-large", "CSS file size too large", "warning");
  }

  if (isResource(contentType, url, "js")) {
    if (status >= 400 || status === 0) {
      add("javascript-broken", "JavaScript broken", "error");
      add("page-has-broken-javascript", "Page has broken JavaScript", "error");
    }
    if (status >= 300 && status < 400) add("javascript-redirects", "JavaScript redirects", "warning");
  }

  if (isResource(contentType, url, "image")) {
    if (status >= 400 || status === 0) {
      add("image-broken", "Image broken", "error");
      add("page-has-broken-image", "Page has broken image", "error");
    }
    if (status >= 300 && status < 400) add("image-redirects", "Image redirects", "warning");
    if (Number(row.sizeKb || 0) > 500) add("image-file-size-too-large", "Image file size too large", "error");
  }

  if (!isHtml) return findings;

  // Redirect and error responses can be HTML, but their bodies are not the
  // destination page. Keep those out of page-content checks such as title tags.
  if (!isSuccessfulHtml) return findings;

  if (audit.mixedContentCount > 0 && !isExcludedEvidenceUrl(url)) {
    add("https-http-mixed-content", "HTTPS/HTTP mixed content", "warning");
  }
  if (audit.httpImageCount > 0) add("https-page-links-to-http-image", "HTTPS page links to HTTP image", "warning");
  if (audit.metaRefreshRedirect) add("meta-refresh-redirect", "Meta refresh redirect", "notice");
  if (Number(row.sizeKb || 0) > 2048) {
    add("page-size-exceeds-googlebots-2-mb-crawl-limit", "Page size exceeds Googlebot's 2 MB crawl limit", "error");
  }

  if (noindex) {
    add("noindex-page", "Noindex page", "warning");
    if (isSitemapUrl) add("noindex-page-sitemap", "Noindex page in sitemap", "error");
    if (!nofollow) add("noindex-follow-page", "Noindex follow page", "warning");
  }
  if (audit.noindex && noindexHeader) add("noindex-in-html-and-http-header", "Noindex in HTML and HTTP header", "warning");
  if (nofollow) add("nofollow-page", "Nofollow page", "warning");
  if (audit.nofollow && nofollowHeader) add("nofollow-in-html-and-http-header", "Nofollow in HTML and HTTP header", "warning");

  if (audit.canonicalUrl) {
    const canonical = normalizeEvidenceUrl(audit.canonicalUrl);
    const current = normalizeEvidenceUrl(url);
    if (canonical !== current) {
      add("non-canonical-page-specified-as-canonical-one", "Non-canonical page specified as canonical one", "warning");
    }
    if (url.startsWith("http://") && audit.canonicalUrl.startsWith("https://")) {
      add("canonical-from-http-to-https", "Canonical from HTTP to HTTPS", "notice");
    }
    if (url.startsWith("https://") && audit.canonicalUrl.startsWith("http://")) {
      add("canonical-from-https-to-http", "Canonical from HTTPS to HTTP", "notice");
    }
  }

  const titleEvidence = {
    titleTag: audit.titleText || "",
    titleCount: Number(audit.titleCount || 0),
    titleLength: Number(audit.titleLength || 0),
  };

  if (audit.titleCount > 1) {
    add("multiple-title-tags", "Multiple title tags", "error", {
      ...titleEvidence,
      titleTagStatus: "Multiple",
    });
  }
  if (audit.titleCount === 0 || !audit.titleText) addTitleMissingIssue();
  if (audit.titleText && audit.titleLength < 15) {
    add("title-too-short", "Title too short", "warning", titleEvidence);
  }
  if (audit.titleLength > 70) {
    add("title-too-long", "Title too long", "warning", titleEvidence);
  }

  if (audit.metaDescriptionCount > 1) add("multiple-meta-description-tags", "Multiple meta description tags", "error");
  if (audit.metaDescriptionCount === 0 || !audit.metaDescriptionText) {
    add("meta-description-missing", "Meta description tag missing or empty", "warning");
  }
  if (audit.h1Count === 0 || !audit.h1Text) add("h1-tag-missing-or-empty", "H1 tag missing or empty", "warning");

  if (audit.ogMissingAll) add("open-graph-tags-missing", "Open Graph tags missing", "notice");
  if (audit.ogMissingCount > 0 && !audit.ogMissingAll) add("og-tags-incomplete", "Open Graph tags incomplete", "warning");
  if (audit.canonicalUrl && audit.ogTags?.["og:url"] && normalizeEvidenceUrl(audit.ogTags["og:url"]) !== normalizeEvidenceUrl(audit.canonicalUrl)) {
    add("open-graph-url-not-matching-canonical", "Open Graph URL not matching canonical", "warning");
  }
  if (audit.twitterMissingAll) add("x-twitter-card-missing", "X (Twitter) card missing", "notice");
  if (audit.twitterMissingCount > 0 && !audit.twitterMissingAll) add("twitter-card-incomplete", "X (Twitter) card incomplete", "warning");

  if (audit.missingImageAltCount > 0) {
    add("missing-alt-text", "Missing alt text", "warning", {
      linkedImagesWithoutAltAttribute: audit.missingImageAltUrls || [],
      missingAltImageCount: audit.missingImageAltCount,
    });
  }
  if (audit.linksCount === 0) add("page-has-no-outgoing-links", "Page has no outgoing links", "error");

  return findings;
}

export function mergeIssueFindings(stats, findings) {
  if (!findings.length) return stats;
  const auditIssues = { ...(stats.auditIssues || {}) };

  findings.forEach((finding) => {
    const current = auditIssues[finding.slug] || {
      slug: finding.slug,
      title: finding.title,
      severity: finding.severity,
      fixable: finding.fixable,
      count: 0,
      urls: [],
    };
    const hasUrl = current.urls.some((item) => item.url === finding.url.url);
    auditIssues[finding.slug] = {
      ...current,
      title: finding.title || current.title,
      severity: finding.severity || current.severity,
      fixable: finding.fixable ?? current.fixable,
      count: current.count + (hasUrl ? 0 : 1),
      urls: hasUrl
        ? current.urls
        : [finding.url, ...current.urls].slice(0, ISSUE_URL_LIMIT),
    };
  });

  return { ...stats, auditIssues };
}

export function normalizeEvidenceUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

function isExcludedEvidenceUrl(value = "") {
  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();
    return pathname.startsWith("/wp-json/") || pathname === "/xmlrpc.php";
  } catch {
    return false;
  }
}

function isResource(contentType, url, type) {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (type === "css") return CSS_RE.test(contentType) || pathname.endsWith(".css");
  if (type === "js") return JS_RE.test(contentType) || /\.(js|mjs)$/.test(pathname);
  if (type === "image") return IMAGE_RE.test(contentType) || /\.(png|jpe?g|webp|gif|svg|ico|avif)$/.test(pathname);
  return false;
}

function pageLabelFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.replace(/^\/|\/$/g, "");
    if (!path) return url.hostname;
    return path
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" / ")
      .replace(/[-_]+/g, " ");
  } catch {
    return rawUrl || "Untitled page";
  }
}
