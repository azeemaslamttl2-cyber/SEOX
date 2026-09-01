import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { onRequest as autocompleteOnRequest } from "./functions/api/autocomplete.js";
import { onRequest as gscTokenOnRequest } from "./functions/api/gsc-token.js";
import { onRequest as projectsOnRequest } from "./functions/api/projects.js";
import { onRequest as aiToolsOnRequest } from "./functions/api/ai-tools.js";
import { onRequest as localLeadsOnRequest } from "./functions/api/local-leads.js";
import { onRequest as localExpiredFinderOnRequest } from "./functions/api/local-expired-finder.js";
import fetchUrlMetaHandler from "./functions/_handlers/fetch-url-meta.js";
import webmasterApiHandler from "./functions/_handlers/webmaster-api.js";
import { verifyFirebaseIdToken } from "./functions/_lib/firebase-rest.js";
import { fetchPublicHttpUrl, parsePublicHttpUrl } from "./functions/_lib/url-security.js";

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

async function verifyDevApiRequest(req) {
  const headers = new Headers();
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (authorization) headers.set("authorization", authorization);
  return verifyFirebaseIdToken(
    new Request("http://127.0.0.1/auth", { headers }),
    process.env
  );
}

function parseEnvFile(pathname) {
  if (!fs.existsSync(pathname)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(pathname, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

function loadDevApiEnv() {
  return {
    ...process.env,
    ...loadEnv("development", process.cwd(), ""),
    ...parseEnvFile(".dev.vars"),
  };
}

function sendUnauthorized(res, error) {
  sendJson(res, error?.status || 401, {
    error: error?.message || "Unauthorized",
  });
}

/* ── Proxy API middleware (for content tools to fetch external URLs) ── */
function proxyApiPlugin() {
  return {
    name: "ai-smart-seo-proxy-api",
    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        try {
          try {
            await verifyDevApiRequest(req);
          } catch (error) {
            return sendUnauthorized(res, error);
          }

          const requestUrl = new URL(req.url || "", "http://127.0.0.1");
          const targetUrl = requestUrl.searchParams.get("url");
          if (!targetUrl) {
            return sendJson(res, 400, { error: "URL parameter is required" });
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetchPublicHttpUrl(targetUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
              "Accept-Language": "en-US,en;q=0.5",
              Connection: "keep-alive",
              "Upgrade-Insecure-Requests": "1",
            },
          }).finally(() => clearTimeout(timeoutId));

          const contentType = response.headers.get("content-type") || "";
          const text = await response.text();

          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", contentType || "text/html");
          res.statusCode = response.status;
          res.end(text);
        } catch (error) {
          sendJson(res, error?.status || 500, {
            error: "Failed to fetch URL",
            message: error?.message || "Unknown error",
          });
        }
      });
    },
  };
}

/* ── DeepSeek API middleware (for AI-powered content tools) ── */
function deepseekApiPlugin() {
  return {
    name: "ai-smart-seo-deepseek-api",
    configureServer(server) {
      server.middlewares.use("/api/deepseek", async (req, res) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          return res.end();
        }

        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "Method not allowed" });
        }

        try {
          await verifyDevApiRequest(req);
        } catch (error) {
          return sendUnauthorized(res, error);
        }

        // Read env using dotenv-style loading
        const env = loadEnv("development", process.cwd(), "");
        const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

        if (!apiKey) {
          return sendJson(res, 500, {
            error:
              "DeepSeek API key not configured. Add DEEPSEEK_API_KEY to your .env file.",
          });
        }

        // Parse JSON body
        const body = await new Promise((resolve) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({});
            }
          });
        });

        const {
          prompt,
          systemInstruction,
          responseMimeType,
          temperature = 0.7,
          maxTokens = 8192,
        } = body;

        if (!prompt) {
          return sendJson(res, 400, { error: "Prompt is required" });
        }

        try {
          const wantsJson = responseMimeType === "application/json";
          const systemMessages = [];
          if (systemInstruction) systemMessages.push(systemInstruction);
          if (wantsJson) systemMessages.push("Return valid JSON only.");

          const messages = [];
          if (systemMessages.length > 0) {
            messages.push({
              role: "system",
              content: systemMessages.join("\n\n"),
            });
          }
          messages.push({ role: "user", content: prompt });

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const response = await fetch(
            "https://api.deepseek.com/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "deepseek-chat",
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: false,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return sendJson(res, response.status, {
              error:
                errorData.error?.message ||
                `DeepSeek API error: ${response.status}`,
            });
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";

          sendJson(res, 200, {
            text,
            usage: data.usage,
            model: data.model,
          });
        } catch (error) {
          console.error("DeepSeek API error:", error);
          sendJson(res, 500, {
            error: error?.message || "Failed to call DeepSeek API",
          });
        }
      });
    },
  };
}

/* ── Crawler API middleware (existing) ── */
function crawlerApiPlugin() {
  return {
    name: "ai-smart-seo-crawler-api",
    configureServer(server) {
      registerCrawlerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerCrawlerMiddleware(server);
    },
  };
}

function fetchUrlMetaApiPlugin() {
  return {
    name: "ai-smart-seo-fetch-url-meta-api",
    configureServer(server) {
      registerFetchUrlMetaMiddleware(server);
    },
    configurePreviewServer(server) {
      registerFetchUrlMetaMiddleware(server);
    },
  };
}

function webmasterApiPlugin() {
  return {
    name: "ai-smart-seo-webmaster-api",
    configureServer(server) {
      registerWebmasterApiMiddleware(server);
    },
    configurePreviewServer(server) {
      registerWebmasterApiMiddleware(server);
    },
  };
}

function autocompleteApiPlugin() {
  return {
    name: "ai-smart-seo-autocomplete-api",
    configureServer(server) {
      registerAutocompleteMiddleware(server);
    },
    configurePreviewServer(server) {
      registerAutocompleteMiddleware(server);
    },
  };
}

function gscTokenApiPlugin() {
  return {
    name: "ai-smart-seo-gsc-token-api",
    configureServer(server) {
      registerGscTokenMiddleware(server);
    },
    configurePreviewServer(server) {
      registerGscTokenMiddleware(server);
    },
  };
}

function projectsApiPlugin() {
  return {
    name: "ai-smart-seo-projects-api",
    configureServer(server) {
      registerProjectsMiddleware(server);
    },
    configurePreviewServer(server) {
      registerProjectsMiddleware(server);
    },
  };
}

function importedSemanticsxApiPlugin() {
  return {
    name: "ai-smart-seo-semanticsx-api",
    configureServer(server) {
      registerPagesFunctionMiddleware(server, "/api/ai-tools", aiToolsOnRequest);
      registerPagesFunctionMiddleware(server, "/api/local-leads", localLeadsOnRequest);
      registerPagesFunctionMiddleware(server, "/api/local-expired-finder", localExpiredFinderOnRequest);
    },
    configurePreviewServer(server) {
      registerPagesFunctionMiddleware(server, "/api/ai-tools", aiToolsOnRequest);
      registerPagesFunctionMiddleware(server, "/api/local-leads", localLeadsOnRequest);
      registerPagesFunctionMiddleware(server, "/api/local-expired-finder", localExpiredFinderOnRequest);
    },
  };
}

function registerPagesFunctionMiddleware(server, mountPath, onRequest) {
  server.middlewares.use(mountPath, async (req, res) => {
    try {
      const request = await createWebRequest(req, mountPath);
      const response = await onRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        error: "API request failed",
        message: error?.message || "Unknown error",
      });
    }
  });
}

function mountedUrl(req, mountPath) {
  const raw = req.url || "";
  if (raw.startsWith(mountPath)) return `http://127.0.0.1${raw}`;
  if (raw.startsWith("/?")) return `http://127.0.0.1${mountPath}${raw.slice(1)}`;
  if (raw.startsWith("?")) return `http://127.0.0.1${mountPath}${raw}`;
  if (!raw || raw === "/") return `http://127.0.0.1${mountPath}`;
  return `http://127.0.0.1${mountPath}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function registerFetchUrlMetaMiddleware(server) {
  server.middlewares.use("/api/fetch-url-meta", async (req, res) => {
    const requestUrl = new URL(req.url || "", "http://127.0.0.1");
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    const body = ["POST", "PUT", "PATCH"].includes(req.method || "")
      ? await readJsonBody(req)
      : {};

    await fetchUrlMetaHandler(
      { method: req.method || "GET", headers: req.headers, query, body },
      createNodeJsonResponse(res)
    );
  });
}

function registerAutocompleteMiddleware(server) {
  server.middlewares.use("/api/autocomplete", async (req, res) => {
    try {
      const response = await autocompleteOnRequest({
        request: new Request(mountedUrl(req, "/api/autocomplete"), {
          method: req.method || "GET",
          headers: req.headers,
        }),
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, 500, {
        error: "Autocomplete request failed",
        message: error?.message || "Unknown error",
      });
    }
  });
}

function registerGscTokenMiddleware(server) {
  server.middlewares.use("/api/gsc-token", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/gsc-token");
      const response = await gscTokenOnRequest({
        request,
        env: loadDevApiEnv(),
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        error: "GSC token request failed",
        message: error?.message || "Unknown error",
      });
    }
  });
}

function registerProjectsMiddleware(server) {
  server.middlewares.use("/api/projects", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/projects");
      const response = await projectsOnRequest({
        request,
        env: loadDevApiEnv(),
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        error: "Projects request failed",
        message: error?.message || "Unknown error",
      });
    }
  });
}

function registerWebmasterApiMiddleware(server) {
  server.middlewares.use("/api/webmaster-api", async (req, res) => {
    let decoded;
    try {
      decoded = await verifyDevApiRequest(req);
    } catch (error) {
      return sendUnauthorized(res, error);
    }

    const requestUrl = new URL(req.url || "", "http://127.0.0.1");
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    const body = ["POST", "PUT", "PATCH"].includes(req.method || "")
      ? await readJsonBody(req)
      : {};

    await webmasterApiHandler(
      {
        method: req.method || "GET",
        query,
        body,
        env: loadDevApiEnv(),
        user: decoded,
      },
      createNodeJsonResponse(res)
    );
  });
}

function registerCrawlerMiddleware(server) {
  server.middlewares.use("/api/crawler/fetch", async (req, res) => {
    try {
      try {
        await verifyDevApiRequest(req);
      } catch (error) {
        sendUnauthorized(res, error);
        return;
      }

      const requestUrl = new URL(req.url || "", "http://127.0.0.1");
      const targetRaw = requestUrl.searchParams.get("url");
      if (!targetRaw) {
        sendJson(res, 400, { error: "Missing url parameter" });
        return;
      }

      const target = parsePublicHttpUrl(targetRaw);

      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetchPublicHttpUrl(target.toString(), {
        maxRedirects: 0,
        signal: controller.signal,
        headers: {
          "user-agent":
            "AISmartSeoBot/1.0 (+https://ai-smart-seo.local/crawler; compatible; site-audit)",
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
          ...new Set([
            ...(parsed.links || []),
            resolveUrl(location, finalUrl),
          ].filter(Boolean)),
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
  });
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
  const resources = new Set();

  for (const href of matchAttributes(html, "a", "href")) {
    addResolved(links, href, baseUrl);
  }
  for (const href of matchAttributes(html, "link", "href")) {
    addResolved(resources, href, baseUrl);
  }
  for (const src of matchAttributes(html, "script", "src")) {
    addResolved(resources, src, baseUrl);
  }
  for (const src of matchAttributes(html, "img", "src")) {
    addResolved(resources, src, baseUrl);
  }
  for (const srcset of matchAttributes(html, "source", "srcset")) {
    for (const src of parseSrcSet(srcset)) addResolved(resources, src, baseUrl);
  }
  for (const srcset of matchAttributes(html, "img", "srcset")) {
    for (const src of parseSrcSet(srcset)) addResolved(resources, src, baseUrl);
  }

  return {
    links: Array.from(links),
    resources: Array.from(resources),
    sitemaps: [],
    disallow: [],
    audit: extractHtmlAudit(html, baseUrl, {
      links: Array.from(links),
      resources: Array.from(resources),
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
  const metaDescriptions = metaTags.filter((attrs) =>
    String(attrs.name || "").toLowerCase() === "description"
  );
  const ogTags = Object.fromEntries(
    metaTags
      .filter((attrs) => String(attrs.property || attrs.name || "").toLowerCase().startsWith("og:"))
      .map((attrs) => [String(attrs.property || attrs.name).toLowerCase(), attrs.content || ""])
  );
  const twitterTags = Object.fromEntries(
    metaTags
      .filter((attrs) => String(attrs.name || attrs.property || "").toLowerCase().startsWith("twitter:"))
      .map((attrs) => [String(attrs.name || attrs.property).toLowerCase(), attrs.content || ""])
  );
  const isHttps = baseUrl.startsWith("https:");
  const allDiscovered = [...discovered.links, ...discovered.resources];
  const httpUrls = allDiscovered.filter((url) => url.startsWith("http://"));
  const imageHttpUrls = imgTags
    .map((attrs) => attrs.src)
    .filter((src) => src && resolveUrl(src, baseUrl)?.startsWith("http://"));
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
    ogMissingCount: countMissing(ogTags, ["og:title", "og:type", "og:image", "og:url", "og:description"]),
    twitterMissingCount: countMissing(twitterTags, ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]),
    ogMissingAll: Object.keys(ogTags).length === 0,
    twitterMissingAll: Object.keys(twitterTags).length === 0,
    imageCount: imgTags.length,
    missingImageAltCount: imgTags.filter((attrs) => !String(attrs.alt || "").trim()).length,
    mixedContentCount: isHttps ? httpUrls.length : 0,
    httpImageCount: isHttps ? imageHttpUrls.length : 0,
    metaRefreshRedirect: Boolean(metaRefresh),
    linksCount: discovered.links.length,
    wordCount: stripTags(html).split(/\s+/).filter(Boolean).length,
  };
}

function matchAttributes(html, tag, attr) {
  const matches = [];
  const tagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const attrRe = new RegExp(`${attr}\\s*=\\s*([\"'])(.*?)\\1`, "i");
  for (const tagMatch of html.matchAll(tagRe)) {
    const attrMatch = tagMatch[0].match(attrRe);
    if (attrMatch?.[2]) matches.push(decodeHtml(attrMatch[2].trim()));
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
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
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

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function createWebRequest(req, mountPath) {
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, String(value));
  });

  const method = req.method || "GET";
  const init = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    init.body = await readRawBody(req);
  }

  return new Request(mountedUrl(req, mountPath), init);
}

function createNodeJsonResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    status(statusCode) {
      res.statusCode = statusCode;
      return this;
    },
    json(payload) {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
      return this;
    },
    end(payload) {
      res.end(payload);
      return this;
    },
  };
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default defineConfig({
  plugins: [react(), proxyApiPlugin(), deepseekApiPlugin(), fetchUrlMetaApiPlugin(), webmasterApiPlugin(), autocompleteApiPlugin(), gscTokenApiPlugin(), projectsApiPlugin(), importedSemanticsxApiPlugin(), crawlerApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
