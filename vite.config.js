import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { onRequest as autocompleteOnRequest } from "./functions/api/autocomplete.js";
import { onRequest as gscTokenOnRequest } from "./functions/api/gsc-token.js";
import { onRequest as pagespeedOnRequest } from "./functions/api/pagespeed.js";
import { onRequest as screamingFrogOnRequest } from "./functions/api/tech-seo/screaming-frog.js";
import { onRequest as screamingFrogReportDownloadOnRequest } from "./functions/api/tech-seo/screaming-frog/report-download.js";
import { onRequest as projectsOnRequest } from "./functions/api/projects.js";
import { onRequest as projectDetailsOnRequest } from "./functions/api/project-details.js";
import { onRequest as backlinksAnalyzeOnRequest } from "./functions/api/tech-seo/backlinks/analyze.js";
import { onRequest as w3cValidateOnRequest } from "./functions/api/tech-seo/w3c/validate.js";
import { onRequest as adminW3cValidateOnRequest } from "./functions/api/tech-seo/w3c/admin-validation.js";
import { onRequest as expiredDomainsCheckOnRequest } from "./functions/api/off-page/expired-domains/check.js";
import { onRequest as backlinkCleanerOnRequest } from "./functions/api/off-page/backlink-cleaner.js";
import { onRequest as backlinkIndexerOnRequest } from "./functions/api/off-page/backlink-indexer.js";
import { onRequest as keywordResearchOnRequest } from "./functions/api/keywords/research.js";
import { onRequest as ubersuggestOnRequest } from "./functions/api/keywords/ubersuggest.js";
import { onRequest as contentOutlineOnRequest } from "./functions/api/content/outline.js";
import { onRequestGet as authOnRequestGet, onRequestPost as authOnRequestPost } from "./functions/api/auth.js";
import fetchUrlMetaHandler from "./functions/_handlers/fetch-url-meta.js";
import webmasterApiHandler from "./functions/_handlers/webmaster-api.js";
import { verifyFirebaseIdToken } from "./functions/_lib/firebase-rest.js";
import { runNodeHandler } from "./functions/_lib/node-handler-adapter.js";
import proxyHandler from "./functions/_handlers/proxy.js";
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
    loadDevApiEnv()
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
  const merged = {
    ...process.env,
    ...loadEnv("development", process.cwd(), ""),
    ...parseEnvFile(".env"),
    ...parseEnvFile(".dev.vars"),
  };

  if (merged.PAGESPEED_API_KEY === undefined || merged.PAGESPEED_API_KEY === "") {
    const envFilePath = fs.existsSync(".env") ? ".env" : null;
    if (envFilePath) {
      const parsed = parseEnvFile(envFilePath);
      if (parsed.PAGESPEED_API_KEY) merged.PAGESPEED_API_KEY = parsed.PAGESPEED_API_KEY;
    }
  }

  return merged;
}

function sendUnauthorized(res, error) {
  sendJson(res, error?.status || 401, {
    error: error?.message || "Unauthorized",
  });
}

async function readRawBody(req) {
  if (!req || !["POST", "PUT", "PATCH"].includes(req.method)) return undefined;

  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    // Request bodies can be multipart uploads. Returning UTF-8 text here
    // corrupts arbitrary ZIP bytes before Request.formData() sees them.
    const finish = () => {
      const body = Buffer.concat(chunks);
      resolve(body.length ? body : undefined);
    };
    req.on("end", finish);
    req.on("error", finish);
  });
}

/* ── Proxy API middleware (for content tools to fetch external URLs) ── */
function proxyApiPlugin() {
  return {
    name: "seox-proxy-api",
    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        try {
          try {
            await verifyDevApiRequest(req);
          } catch (error) {
            if (process.env.NODE_ENV !== "development") {
              return sendUnauthorized(res, error);
            }
          }

          const requestUrl = new URL(req.url || "", "http://127.0.0.1");
          const rawBody = await readRawBody(req);
          const headers = new Headers();
          Object.entries(req.headers || {}).forEach(([key, value]) => {
            if (Array.isArray(value)) headers.set(key, value.join(", "));
            else if (value !== undefined) headers.set(key, String(value));
          });

          const request = new Request(`http://127.0.0.1${requestUrl.pathname}${requestUrl.search}`, {
            method: req.method,
            headers,
            body: rawBody ? rawBody : undefined,
          });

          const response = await runNodeHandler({ request, env: loadDevApiEnv() }, proxyHandler);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          res.end(await response.text());
        } catch (error) {
          sendJson(res, error?.status || 500, {
            error: "Failed to process proxy request",
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
    name: "seox-deepseek-api",
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
    name: "seox-crawler-api",
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
    name: "seox-fetch-url-meta-api",
    configureServer(server) {
      registerFetchUrlMetaMiddleware(server);
    },
    configurePreviewServer(server) {
      registerFetchUrlMetaMiddleware(server);
    },
  };
}

function pagespeedApiPlugin() {
  return {
    name: "seox-pagespeed-api",
    configureServer(server) {
      registerPagespeedMiddleware(server);
    },
    configurePreviewServer(server) {
      registerPagespeedMiddleware(server);
    },
  };
}

function screamingFrogApiPlugin() {
  return {
    name: "seox-screaming-frog-api",
    configureServer(server) {
      registerScreamingFrogMiddleware(server);
    },
    configurePreviewServer(server) {
      registerScreamingFrogMiddleware(server);
    },
  };
}

function webmasterApiPlugin() {
  return {
    name: "seox-webmaster-api",
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
    name: "seox-autocomplete-api",
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
    name: "seox-gsc-token-api",
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
    name: "seox-projects-api",
    configureServer(server) {
      registerProjectsMiddleware(server);
    },
    configurePreviewServer(server) {
      registerProjectsMiddleware(server);
    },
  };
}

function projectDetailsApiPlugin() {
  return {
    name: "seox-project-details-api",
    configureServer(server) {
      registerProjectDetailsMiddleware(server);
    },
    configurePreviewServer(server) {
      registerProjectDetailsMiddleware(server);
    },
  };
}

function backlinksAnalyzeApiPlugin() {
  return {
    name: "seox-backlinks-analyze-api",
    configureServer(server) {
      registerBacklinksAnalyzeMiddleware(server);
    },
    configurePreviewServer(server) {
      registerBacklinksAnalyzeMiddleware(server);
    },
  };
}

function w3cValidationApiPlugin() {
  return {
    name: "seox-w3c-validation-api",
    configureServer(server) {
      registerW3CValidationMiddleware(server);
      registerAdminW3CValidationMiddleware(server);
    },
    configurePreviewServer(server) {
      registerW3CValidationMiddleware(server);
      registerAdminW3CValidationMiddleware(server);
    },
  };
}

function expiredDomainsCheckApiPlugin() {
  return {
    name: "seox-expired-domains-check-api",
    configureServer(server) {
      registerExpiredDomainsCheckMiddleware(server);
    },
    configurePreviewServer(server) {
      registerExpiredDomainsCheckMiddleware(server);
    },
  };
}

function backlinkCleanerApiPlugin() {
  return {
    name: "seox-backlink-cleaner-api",
    configureServer(server) {
      registerBacklinkCleanerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerBacklinkCleanerMiddleware(server);
    },
  };
}

function backlinkIndexerApiPlugin() {
  return {
    name: "seox-backlink-indexer-api",
    configureServer(server) {
      registerBacklinkIndexerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerBacklinkIndexerMiddleware(server);
    },
  };
}

function keywordResearchApiPlugin() {
  return {
    name: "seox-keyword-research-api",
    configureServer(server) {
      registerKeywordResearchMiddleware(server);
    },
    configurePreviewServer(server) {
      registerKeywordResearchMiddleware(server);
    },
  };
}

function ubersuggestApiPlugin() {
  return {
    name: "seox-ubersuggest-api",
    configureServer(server) {
      registerUbersuggestMiddleware(server);
    },
    configurePreviewServer(server) {
      registerUbersuggestMiddleware(server);
    },
  };
}

function authApiPlugin() {
  return {
    name: "seox-auth-api",
    configureServer(server) {
      registerAuthMiddleware(server);
    },
    configurePreviewServer(server) {
      registerAuthMiddleware(server);
    },
  };
}

function contentOutlineApiPlugin() {
  return {
    name: "seox-content-outline-api",
    configureServer(server) {
      registerContentOutlineMiddleware(server);
    },
    configurePreviewServer(server) {
      registerContentOutlineMiddleware(server);
    },
  };
}

function mountedUrl(req, mountPath) {
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  const host = /^[a-z0-9.:[\]-]+$/i.test(forwardedHost) ? forwardedHost : "127.0.0.1:3000";
  const forwardedProtocol = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const protocol = forwardedProtocol === "https" ? "https" : "http";
  const origin = `${protocol}://${host}`;
  const raw = req.url || "";
  if (raw.startsWith(mountPath)) return `${origin}${raw}`;
  if (raw.startsWith("/?")) return `${origin}${mountPath}${raw.slice(1)}`;
  if (raw.startsWith("?")) return `${origin}${mountPath}${raw}`;
  if (!raw || raw === "/") return `${origin}${mountPath}`;
  return `${origin}${mountPath}${raw.startsWith("/") ? raw : `/${raw}`}`;
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

function registerPagespeedMiddleware(server) {
  server.middlewares.use("/api/pagespeed", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/pagespeed");
      const response = await pagespeedOnRequest({
        request,
        env: loadDevApiEnv(),
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        error: "PageSpeed request failed",
        message: error?.message || "Unknown error",
      });
    }
  });
}

function registerScreamingFrogMiddleware(server) {
  server.middlewares.use("/api/tech-seo/screaming-frog/report-download", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/tech-seo/screaming-frog/report-download");
      const response = await screamingFrogReportDownloadOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, { status: "error", success: false, message: error?.message || "Screaming Frog report download failed." });
    }
  });
  server.middlewares.use("/api/tech-seo/screaming-frog", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/tech-seo/screaming-frog");
      const response = await screamingFrogOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        status: "error",
        success: false,
        message: error?.message || "Screaming Frog request failed.",
        errors: [],
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

function registerProjectDetailsMiddleware(server) {
  const handleProjectDetailsRequest = async (req, res, mountPath) => {
    try {
      const request = await createWebRequest(req, mountPath);
      const response = await projectDetailsOnRequest({
        request,
        env: loadDevApiEnv(),
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, 500, {
        error: "Project details request failed",
        message: error?.message || "Unknown error",
      });
    }
  };

  server.middlewares.use("/api/project-details", async (req, res) => {
    await handleProjectDetailsRequest(req, res, "/api/project-details");
  });

  server.middlewares.use("/api/add-project-detail", async (req, res) => {
    await handleProjectDetailsRequest(req, res, "/api/add-project-detail");
  });
}

function registerBacklinksAnalyzeMiddleware(server) {
  server.middlewares.use("/api/tech-seo/backlinks/analyze", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/tech-seo/backlinks/analyze");
      const response = await backlinksAnalyzeOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "Backlink analysis request failed.",
      });
    }
  });
}

function registerW3CValidationMiddleware(server) {
  server.middlewares.use("/api/tech-seo/w3c/validate", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/tech-seo/w3c/validate");
      const response = await w3cValidateOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "W3C validation request failed.",
      });
    }
  });
}

function registerAdminW3CValidationMiddleware(server) {
  server.middlewares.use("/api/tech-seo/w3c-validation", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/tech-seo/w3c-validation");
      const response = await adminW3cValidateOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "W3C validation request failed.",
      });
    }
  });
}

function registerExpiredDomainsCheckMiddleware(server) {
  server.middlewares.use("/api/off-page/expired-domains/check", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/off-page/expired-domains/check");
      const response = await expiredDomainsCheckOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "Expired domain check request failed.",
      });
    }
  });
}

function registerBacklinkCleanerMiddleware(server) {
  server.middlewares.use("/api/off-page/backlink-cleaner", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/off-page/backlink-cleaner");
      const response = await backlinkCleanerOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "Backlink cleaner request failed.",
      });
    }
  });
}

function registerBacklinkIndexerMiddleware(server) {
  server.middlewares.use("/api/off-page/backlink-indexer", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/off-page/backlink-indexer");
      const response = await backlinkIndexerOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "Backlink indexer request failed.",
      });
    }
  });
}

function registerKeywordResearchMiddleware(server) {
  server.middlewares.use("/api/keywords/research", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/keywords/research");
      const response = await keywordResearchOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "Keyword research request failed.",
      });
    }
  });
}

function registerUbersuggestMiddleware(server) {
  server.middlewares.use("/api/keywords/ubersuggest", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/keywords/ubersuggest");
      const response = await ubersuggestOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        error: error?.message || "Ubersuggest request failed.",
      });
    }
  });
}

function registerAuthMiddleware(server) {
  server.middlewares.use("/api/auth", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/auth");
      const handler = request.method === "GET" ? authOnRequestGet : authOnRequestPost;
      const response = await handler({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        ok: false,
        error: error?.message || "Authentication request failed",
      });
    }
  });
}

function registerContentOutlineMiddleware(server) {
  server.middlewares.use("/api/content/outline", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/content/outline");
      const response = await contentOutlineOnRequest({ request, env: loadDevApiEnv() });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        success: false,
        message: error?.message || "Outline generation request failed.",
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
  plugins: [react(), proxyApiPlugin(), deepseekApiPlugin(), fetchUrlMetaApiPlugin(), pagespeedApiPlugin(), screamingFrogApiPlugin(), webmasterApiPlugin(), autocompleteApiPlugin(), gscTokenApiPlugin(), projectsApiPlugin(), projectDetailsApiPlugin(), backlinksAnalyzeApiPlugin(), w3cValidationApiPlugin(), expiredDomainsCheckApiPlugin(), backlinkCleanerApiPlugin(), backlinkIndexerApiPlugin(), keywordResearchApiPlugin(), ubersuggestApiPlugin(), authApiPlugin(), contentOutlineApiPlugin(), crawlerApiPlugin()],
  server: {
    port: 3000,
    host: true,
  },
});
