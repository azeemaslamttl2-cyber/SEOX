import { requireAuthenticatedUser } from "../_lib/request-auth.js";
import { parsePublicHttpUrl, resolvePublicRedirect } from "../_lib/url-security.js";

// Shared Node-style handler used by the Cloudflare Pages Function wrapper.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await requireAuthenticatedUser(req);
  } catch (error) {
    return res.status(error?.status || 401).json({ error: error?.message || "Unauthorized" });
  }

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL parameter is required" });

  try {
    let currentUrl = parsePublicHttpUrl(url).toString();
    const redirects = [];

    for (let i = 0; i < 10; i += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "SEOXBot/1.0" },
      }).finally(() => clearTimeout(timeout));

      if (response.status >= 300 && response.status < 400) {
        redirects.push({ status: response.status, url: currentUrl });
        const location = response.headers.get("location");
        if (!location) break;
        currentUrl = resolvePublicRedirect(location, currentUrl).toString();
        continue;
      }

      return res.status(200).json({
        originalUrl: url,
        finalUrl: currentUrl,
        finalStatus: response.status,
        redirects,
        redirectCount: redirects.length,
      });
    }

    return res.status(200).json({
      originalUrl: url,
      finalUrl: currentUrl,
      finalStatus: 0,
      redirects,
      redirectCount: redirects.length,
      error: "Max redirects reached",
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: "Failed to check URL",
      message: error?.message,
      originalUrl: url,
      finalStatus: 0,
      redirects: [],
      redirectCount: 0,
    });
  }
}
