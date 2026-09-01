import { requireFirebaseAuthFromNodeRequest } from "../_lib/request-auth.js";
import { parsePublicHttpUrl } from "../_lib/url-security.js";

// Shared Node-style handler used by the Cloudflare Pages Function wrapper.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireFirebaseAuthFromNodeRequest(req);
  } catch (error) {
    return res.status(error?.status || 401).json({ error: error?.message || "Unauthorized" });
  }

  const { url, strategy = "mobile", category } = req.query;
  if (!url) return res.status(400).json({ error: "URL parameter is required" });

  try {
    parsePublicHttpUrl(url);
  } catch (error) {
    return res.status(error?.status || 400).json({ error: error?.message || "Invalid URL format" });
  }

  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "PageSpeed API key not configured on server" });
  }

  let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&key=${apiKey}&strategy=${encodeURIComponent(strategy)}`;

  if (category) {
    String(category)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        apiUrl += `&category=${encodeURIComponent(item)}`;
      });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timeout));

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "PageSpeed API error",
      });
    }
    if (!data.lighthouseResult) {
      return res.status(502).json({
        error: "PageSpeed returned incomplete results. The website may be blocking analysis.",
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error?.name === "AbortError" ? 504 : 500).json({
      error:
        error?.name === "AbortError"
          ? "PageSpeed analysis timed out"
          : error?.message || "Failed to analyze page",
    });
  }
}
