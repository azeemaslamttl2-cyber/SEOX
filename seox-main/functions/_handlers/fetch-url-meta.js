import { requireAuthenticatedUser } from "../_lib/request-auth.js";
import { fetchPublicHttpUrl, parsePublicHttpUrl } from "../_lib/url-security.js";

const MAX_HTML_BYTES = 5_000_000;

// Shared Node-style handler used by the Cloudflare Pages Function wrapper.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAuthenticatedUser(req);
  } catch (error) {
    return res.status(error?.status || 401).json({ error: error?.message || "Unauthorized" });
  }

  const params = req.method === "GET" ? req.query || {} : req.body || {};
  const { url, includeMetaDescription, returnHtml } = params;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    parsePublicHttpUrl(url);
  } catch (error) {
    return res.status(error?.status || 400).json({ error: error?.message || "Invalid URL format" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), returnHtml ? 15000 : 10000);
    const response = await fetchPublicHttpUrl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
      },
    }).finally(() => clearTimeout(timeout));

    const statusCode = response.status;
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_BYTES) {
      return res.status(413).json({ error: "Fetched response is too large" });
    }
    const html =
      statusCode >= 200 && statusCode < 300
        ? (await response.text()).slice(0, MAX_HTML_BYTES)
        : "";
    if (returnHtml) {
      return res.status(200).json({
        url,
        statusCode,
        html,
        success: Boolean(html),
        error: html ? undefined : `HTTP ${statusCode}`,
      });
    }

    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const metaDescription = includeMetaDescription
      ? (
          html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
          html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300)
      : "";

    return res.status(200).json({ url, statusCode, title, metaDescription, success: true });
  } catch (error) {
    return res.status(200).json({
      url,
      statusCode: 0,
      title: "",
      metaDescription: "",
      html: returnHtml ? "" : undefined,
      error: error?.name === "AbortError" ? "Timeout" : error?.message,
      success: false,
    });
  }
}
