import { requireAuthenticatedUser } from "../_lib/request-auth.js";
import { fetchPublicHttpUrl, parsePublicHttpUrl } from "../_lib/url-security.js";

// Shared Node-style handler used by the Cloudflare Pages Function wrapper.
const TEXT_TYPES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/xhtml+xml",
  "application/rss+xml",
  "application/atom+xml",
  "image/svg+xml",
];

export default async function handler(req, res) {
  try {
    await requireAuthenticatedUser(req);

    const targetRaw = req.query?.url;
    const targetParam = Array.isArray(targetRaw) ? targetRaw[0] : targetRaw;
    if (!targetParam) {
      sendJson(res, 400, { error: "Missing url parameter" });
      return;
    }

    const target = parsePublicHttpUrl(targetParam);

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetchPublicHttpUrl(target.toString(), {
      maxRedirects: 0,
      signal: controller.signal,
      headers: {
        "user-agent":
          "SEOXBot/1.0 (+https://seox.local/crawler; compatible; site-audit)",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      },
    }).finally(() => clearTimeout(timeout));

    const contentType = response.headers.get("content-type") || "unknown";
    const location = response.headers.get("location");
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = isTextContent(contentType)
      ? bytes.toString("utf8").slice(0, 2_000_000)
      : "";
    const finalUrl = response.url || target.toString();
    const parsed = parseCrawlText(text, contentType, finalUrl);
    if (location) {
      parsed.links = [
        ...new Set(
          [
            ...(parsed.links || []),
            resolveUrl(location, finalUrl),
          ].filter(Boolean)
        ),
      ];
    }

    sendJson(res, 200, {
      url: target.toString(),
      finalUrl,
      status: response.status,
      contentType,
      redirectedTo: location ? resolveUrl(location, finalUrl) : null,
      xRobotsTag: response.headers.get("x-robots-tag") || "",
      sizeKb: Math.round((bytes.length / 1024) * 10) / 10,
      loadTime: Date.now() - started,
      ...parsed,
    });
  } catch (error) {
    const status = error?.name === "AbortError" ? 504 : error?.status || 500;
    sendJson(res, status, {
      error:
        error?.name === "AbortError"
          ? "Crawl request timed out"
          : error?.message || "Crawl request failed",
    });
  }
}

function isTextContent(contentType = "") {
  const lowered = contentType.toLowerCase();
  return TEXT_TYPES.some((type) => lowered.includes(type));
}

function parseCrawlText(text, contentType, baseUrl) {
  const lowered = contentType.toLowerCase();
  if (!text) return { links: [], resources: [], sitemaps: [], disallow: [] };
  if (lowered.includes("xml")) {
    return {
      links: extractSitemapLocs(text, baseUrl),
      resources: [],
      sitemaps: [],
      disallow: [],
    };
  }
  if (baseUrl.endsWith("/robots.txt") || lowered.includes("text/plain")) {
    const robots = parseRobots(text, baseUrl);
    return {
      links: [],
      resources: [],
      sitemaps: robots.sitemaps,
      disallow: robots.disallow,
    };
  }
  return parseHtml(text, baseUrl);
}

function parseHtml(html, baseUrl) {
  const links = new Set();
  const linkDetails = [];
  const resources = new Map();
  const contentSnapshot = extractContentSnapshot(html);

  for (const attrs of matchElements(html, "a")) {
    const url = resolveUrl(attrs.href, baseUrl);
    if (!url) continue;
    links.add(url);
    linkDetails.push({
      url,
      anchor: stripTags(attrs.text || "") || attrs.title || attrs["aria-label"] || "",
      nofollow: String(attrs.rel || "").toLowerCase().split(/\s+/).includes("nofollow"),
      type: "Href link",
    });
  }
  for (const attrs of matchTagBlocks(html, "link").map(parseAttributes)) {
    addResource(resources, attrs.href, baseUrl, resourceTypeFromLink(attrs), "");
  }
  for (const attrs of matchTagBlocks(html, "script").map(parseAttributes)) {
    addResource(resources, attrs.src, baseUrl, "JavaScript", "");
  }
  for (const attrs of matchTagBlocks(html, "img").map(parseAttributes)) {
    addResource(resources, attrs.src, baseUrl, "Image", attrs.alt ? "Content" : "");
  }
  for (const srcset of matchAttributes(html, "source", "srcset")) {
    for (const src of parseSrcSet(srcset)) addResource(resources, src, baseUrl, "Image", "Content");
  }
  for (const srcset of matchAttributes(html, "img", "srcset")) {
    for (const src of parseSrcSet(srcset)) addResource(resources, src, baseUrl, "Image", "Content");
  }

  const resourceDetails = Array.from(resources.values());
  const linkUrls = Array.from(links);
  const resourceUrls = resourceDetails.map((item) => item.url);

  return {
    links: linkDetails.length ? linkDetails : linkUrls,
    resources: resourceDetails,
    sitemaps: [],
    disallow: [],
    contentText: contentSnapshot.text,
    headings: contentSnapshot.headings,
    audit: extractHtmlAudit(html, baseUrl, {
      links: linkUrls,
      resources: resourceUrls,
      wordCount: contentSnapshot.wordCount,
    }),
  };
}

function extractHtmlAudit(html, baseUrl, discovered) {
  const titleTags = matchTags(html, "title").map((tag) => stripTags(tag));
  const h1Tags = matchTags(html, "h1").map((tag) => stripTags(tag));
  const metaTags = matchTagBlocks(html, "meta").map(parseAttributes);
  const linkTags = matchTagBlocks(html, "link").map(parseAttributes);
  const imgTags = matchTagBlocks(html, "img").map(parseAttributes);
  const canonical = linkTags.find((attrs) =>
    String(attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical")
  );
  const robotsMeta = metaTags
    .filter((attrs) => String(attrs.name || "").toLowerCase() === "robots")
    .map((attrs) => String(attrs.content || "").toLowerCase())
    .join(", ");
  const descriptions = metaTags.filter((attrs) =>
    ["description", "og:description", "twitter:description"].includes(
      String(attrs.name || attrs.property || "").toLowerCase()
    )
  );
  const metaDescriptions = metaTags.filter(
    (attrs) => String(attrs.name || "").toLowerCase() === "description"
  );
  const ogTags = Object.fromEntries(
    metaTags
      .filter((attrs) =>
        String(attrs.property || attrs.name || "").toLowerCase().startsWith("og:")
      )
      .map((attrs) => [
        String(attrs.property || attrs.name).toLowerCase(),
        attrs.content || "",
      ])
  );
  const twitterTags = Object.fromEntries(
    metaTags
      .filter((attrs) =>
        String(attrs.name || attrs.property || "")
          .toLowerCase()
          .startsWith("twitter:")
      )
      .map((attrs) => [
        String(attrs.name || attrs.property).toLowerCase(),
        attrs.content || "",
      ])
  );
  const isHttps = baseUrl.startsWith("https:");
  const allDiscovered = [...discovered.links, ...discovered.resources];
  const httpUrls = allDiscovered.filter(
    (url) => url.startsWith("http://") && !isIgnoredMixedContentUrl(url)
  );
  const imageHttpUrls = imgTags
    .map((attrs) => attrs.src)
    .map((src) => (src ? resolveUrl(src, baseUrl) : ""))
    .filter((src) => src && src.startsWith("http://") && !isIgnoredMixedContentUrl(src));
  const missingImageAltUrls = imgTags
    .filter((attrs) => !String(attrs.alt || "").trim())
    .map((attrs) => resolveUrl(attrs.src, baseUrl))
    .filter(Boolean);
  const metaRefresh = matchTagBlocks(html, "meta").find((tag) =>
    /http-equiv\s*=\s*["']?refresh/i.test(tag)
  );

  return {
    titleCount: titleTags.length,
    titleText: titleTags[0] || "",
    titleLength: (titleTags[0] || "").length,
    h1Count: h1Tags.length,
    h1Text: h1Tags[0] || "",
    metaDescriptionCount: metaDescriptions.length,
    metaDescriptionText: metaDescriptions[0]?.content || "",
    metaDescriptionLength: (metaDescriptions[0]?.content || "").length,
    anyDescriptionCount: descriptions.length,
    canonicalUrl: canonical?.href ? resolveUrl(canonical.href, baseUrl) : "",
    robotsMeta,
    noindex: /\bnoindex\b/i.test(robotsMeta),
    nofollow: /\bnofollow\b/i.test(robotsMeta),
    ogTags,
    twitterTags,
    ogMissingCount: countMissing(ogTags, [
      "og:title",
      "og:type",
      "og:image",
      "og:url",
      "og:description",
    ]),
    twitterMissingCount: countMissing(twitterTags, [
      "twitter:card",
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ]),
    ogMissingAll: Object.keys(ogTags).length === 0,
    twitterMissingAll: Object.keys(twitterTags).length === 0,
    imageCount: imgTags.length,
    missingImageAltCount: missingImageAltUrls.length,
    missingImageAltUrls,
    mixedContentCount: isHttps ? httpUrls.length : 0,
    httpImageCount: isHttps ? imageHttpUrls.length : 0,
    metaRefreshRedirect: Boolean(metaRefresh),
    linksCount: discovered.links.length,
    wordCount: discovered.wordCount || stripTags(html).split(/\s+/).filter(Boolean).length,
  };
}

function extractContentSnapshot(html) {
  const withoutNoise = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");
  const body = withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || withoutNoise;
  const headings = ["h1", "h2", "h3", "h4"]
    .flatMap((tag) =>
      matchTags(body, tag).map((value) => ({
        tag,
        text: stripTags(value),
      }))
    )
    .filter((item) => item.text)
    .slice(0, 120);
  const text = stripTags(body);

  return {
    text: text.slice(0, 50000),
    headings,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

function isIgnoredMixedContentUrl(value) {
  const lowered = String(value || "").toLowerCase();
  if (lowered.startsWith("http://www.w3.org/2000/svg")) return true;
  try {
    const url = new URL(value);
    return url.username.includes("@") || /@[^/]*$/.test(url.hostname);
  } catch {
    return /https?:\/\/[^/\s]*@/i.test(lowered);
  }
}

function matchAttributes(html, tag, attr) {
  const matches = [];
  const tagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const attrRe = new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, "i");
  for (const tagMatch of html.matchAll(tagRe)) {
    const attrMatch = tagMatch[0].match(attrRe);
    if (attrMatch?.[2]) matches.push(decodeHtml(attrMatch[2].trim()));
  }
  return matches;
}

function matchElements(html, tag) {
  const matches = [];
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of html.matchAll(re)) {
    matches.push({
      ...parseAttributes(match[1] || ""),
      text: match[2] || "",
    });
  }
  return matches;
}

function matchTags(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  return Array.from(html.matchAll(re), (match) => match[0]);
}

function matchTagBlocks(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  return Array.from(html.matchAll(re), (match) => match[0]);
}

function parseAttributes(tag) {
  const attrs = {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(attrRe)) {
    attrs[match[1].toLowerCase()] = decodeHtml(
      match[2] || match[3] || match[4] || ""
    );
  }
  return attrs;
}

function stripTags(value) {
  return decodeHtml(
    String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );
}

function countMissing(source, keys) {
  return keys.filter((key) => !String(source[key] || "").trim()).length;
}

function parseSrcSet(srcset) {
  return String(srcset)
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function addResource(map, value, baseUrl, type, imageType = "") {
  const url = resolveUrl(value, baseUrl);
  if (!url || map.has(url)) return;
  map.set(url, {
    url,
    type: type || resourceTypeFromUrl(url),
    imageType,
  });
}

function resourceTypeFromLink(attrs) {
  const rel = String(attrs.rel || "").toLowerCase();
  const asType = String(attrs.as || "").toLowerCase();
  const href = attrs.href || "";
  if (rel.includes("stylesheet") || asType === "style" || /\.css(?:[?#]|$)/i.test(href)) return "CSS";
  if (asType === "script" || /\.m?js(?:[?#]|$)/i.test(href)) return "JavaScript";
  if (asType === "image" || /\.(png|jpe?g|webp|gif|svg|ico|avif)(?:[?#]|$)/i.test(href)) return "Image";
  return "Resource";
}

function resourceTypeFromUrl(value) {
  if (/\.css(?:[?#]|$)/i.test(value)) return "CSS";
  if (/\.m?js(?:[?#]|$)/i.test(value)) return "JavaScript";
  if (/\.(png|jpe?g|webp|gif|svg|ico|avif)(?:[?#]|$)/i.test(value)) return "Image";
  return "Resource";
}

function extractSitemapLocs(xml, baseUrl) {
  const urls = new Set();
  for (const match of xml.matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi)) {
    addResolved(urls, decodeHtml(match[1].trim()), baseUrl);
  }
  return Array.from(urls);
}

function parseRobots(text, baseUrl) {
  const sitemaps = new Set();
  const disallow = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const sitemap = line.match(/^sitemap:\s*(.+)$/i);
    if (sitemap) addResolved(sitemaps, sitemap[1].trim(), baseUrl);

    const blocked = line.match(/^disallow:\s*(.+)$/i);
    if (blocked && blocked[1].trim()) disallow.add(blocked[1].trim());
  }

  return { sitemaps: Array.from(sitemaps), disallow: Array.from(disallow) };
}

function addResolved(set, value, baseUrl) {
  if (!value || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return;
  const resolved = resolveUrl(value, baseUrl);
  if (resolved) set.add(resolved);
}

function resolveUrl(value, baseUrl) {
  if (!value || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return "";
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function sendJson(res, status, payload) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
