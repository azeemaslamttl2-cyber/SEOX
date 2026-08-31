import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
} from "../_lib/http.js";

function parseGoogleSuggestions(value) {
  try {
    const data = JSON.parse(value);
    if (!Array.isArray(data) || !Array.isArray(data[1])) return [];

    return data[1]
      .map((item) => {
        if (typeof item === "string") return item;
        if (Array.isArray(item) && typeof item[0] === "string") return item[0];
        return "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function onRequest({ request }) {
  const headers = {
    ...corsHeaders("GET, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const hl = url.searchParams.get("hl") || "en";
  const gl = url.searchParams.get("gl") || "US";

  if (!query) {
    return jsonResponse({ error: 'Query parameter "q" is required' }, 400, headers);
  }

  try {
    const params = new URLSearchParams({
      q: query,
      hl,
      gl,
      client: "chrome",
      xhr: "t",
    });

    const response = await fetch(`https://www.google.com/complete/search?${params}`, {
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": `${hl},en;q=0.8`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return jsonResponse(
        { error: `Google autocomplete returned HTTP ${response.status}` },
        502,
        headers
      );
    }

    const text = await response.text();
    return jsonResponse(
      {
        query,
        hl,
        gl,
        suggestions: parseGoogleSuggestions(text),
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
