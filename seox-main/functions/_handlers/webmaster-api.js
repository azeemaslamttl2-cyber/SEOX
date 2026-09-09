import {
  deleteStoredDocument,
  getStoredDocument,
  upsertStoredDocument,
} from "../_lib/mysql-storage.js";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
const YANDEX_API_BASE = "https://api.webmaster.yandex.net/v4";
const YANDEX_TOKEN_ENDPOINT = "https://oauth.yandex.ru/token";
const YANDEX_USERINFO_ENDPOINT = "https://login.yandex.ru/info";

function runtimeEnv(req) {
  return req?.env || (typeof process !== "undefined" ? process.env : {}) || {};
}

function getBingApiKey(req) {
  const env = runtimeEnv(req);
  return (
    req?.query?.apikey ||
    req?.body?.apikey ||
    env.BING_WEBMASTER_API_KEY ||
    env.BING_API_KEY ||
    env.VITE_BING_WEBMASTER_API_KEY ||
    ""
  );
}

function yandexTokenCollection(userId) {
  return `users/${userId}/yandexConnection`;
}

function getYandexConfig(env) {
  return {
    clientId: env.YANDEX_CLIENT_ID || env.VITE_YANDEX_CLIENT_ID,
    clientSecret: env.YANDEX_CLIENT_SECRET,
  };
}

function scopedUserId(req, requestedUserId) {
  const authUserId = req?.user?.uid || req?.user?.sub || "";
  const userId = requestedUserId || authUserId;
  if (authUserId && requestedUserId && requestedUserId !== authUserId) {
    const error = new Error("Cannot access Yandex tokens for another user");
    error.status = 403;
    throw error;
  }
  return userId;
}

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

function jsonOrRaw(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getDateRange(days = 30) {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - Number(days || 30));
  return {
    date_from: dateFrom.toISOString().split("T")[0],
    date_to: dateTo.toISOString().split("T")[0],
  };
}

async function fetchYandexUserInfo(accessToken) {
  let yandexEmail = null;
  let yandexUserId = null;

  const userInfoResponse = await fetch(`${YANDEX_USERINFO_ENDPOINT}?format=json`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (userInfoResponse.ok) {
    const userInfo = await userInfoResponse.json().catch(() => ({}));
    yandexEmail = userInfo.default_email || userInfo.emails?.[0] || null;
    yandexUserId = userInfo.id || null;
  }

  const webmasterUserResponse = await fetch(`${YANDEX_API_BASE}/user`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (webmasterUserResponse.ok) {
    const webmasterUser = await webmasterUserResponse.json().catch(() => ({}));
    yandexUserId = webmasterUser.user_id || yandexUserId;
  }

  return { yandexEmail, yandexUserId };
}

async function refreshYandexToken(env, userId, refreshToken, clientId, clientSecret) {
  if (!refreshToken || !clientId || !clientSecret) return { success: false };

  const refreshResponse = await fetch(YANDEX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const tokens = await refreshResponse.json().catch(() => ({}));
  if (!refreshResponse.ok || !tokens.access_token) {
    await deleteStoredDocument(env, yandexTokenCollection(userId), "tokens");
    return { success: false };
  }

  const expiresAt = Date.now() + Number(tokens.expires_in || 365 * 24 * 60 * 60) * 1000;
  await upsertStoredDocument(env, yandexTokenCollection(userId), "tokens", {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresAt,
    updatedAt: new Date().toISOString(),
  });

  return {
    success: true,
    accessToken: tokens.access_token,
    expiresAt,
  };
}

async function readStoredYandexToken(env, req, requestedUserId) {
  const userId = scopedUserId(req, requestedUserId);
  if (!userId) return null;

  const storedTokens = await getStoredDocument(
    env,
    yandexTokenCollection(userId),
    "tokens"
  );
  if (!storedTokens?.accessToken) return null;

  const { clientId, clientSecret } = getYandexConfig(env);
  if (Number(storedTokens.expiresAt || 0) <= Date.now() + 120000) {
    const refresh = await refreshYandexToken(
      env,
      userId,
      storedTokens.refreshToken,
      clientId,
      clientSecret
    );
    if (!refresh.success) return null;
    return {
      ...storedTokens,
      accessToken: refresh.accessToken,
      expiresAt: refresh.expiresAt,
    };
  }

  return storedTokens;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { service, action } = req.query || {};
  if (!service) return res.status(400).json({ error: "Service is required" });
  if (!action) return res.status(400).json({ error: "Action is required" });

  try {
    if (service === "bing") return handleBing(req, res, action);
    if (service === "yandex") return handleYandex(req, res, action);
    return res.status(400).json({ error: 'Invalid service. Use "bing" or "yandex".' });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error?.message || "Webmaster API request failed",
    });
  }
}

async function handleBing(req, res, action) {
  const { siteUrl } = req.query || {};
  const apiKey = getBingApiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: "Bing Webmaster API key is required" });
  }

  let endpoint = "";
  if (action === "getSites") {
    endpoint = `${BING_API_BASE}/GetUserSites?apikey=${encodeURIComponent(apiKey)}`;
  } else if (action === "getStats") {
    if (!siteUrl) return res.status(400).json({ error: "siteUrl is required for getStats" });
    endpoint = `${BING_API_BASE}/GetQueryStats?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  } else if (action === "getPageStats") {
    if (!siteUrl) return res.status(400).json({ error: "siteUrl is required for getPageStats" });
    endpoint = `${BING_API_BASE}/GetPageStats?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  } else if (action === "getCrawlStats") {
    if (!siteUrl) return res.status(400).json({ error: "siteUrl is required for getCrawlStats" });
    endpoint = `${BING_API_BASE}/GetCrawlStats?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  } else {
    return res.status(400).json({ error: "Invalid Bing action" });
  }

  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  const text = await response.text();
  const payload = jsonOrRaw(text);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({ error: "Invalid or unauthorized Bing Webmaster API key" });
    }
    return res.status(response.status).json({
      error: `Bing API error: HTTP ${response.status}`,
      details: payload,
    });
  }

  return res.status(200).json(payload);
}

async function handleYandex(req, res, action) {
  const env = runtimeEnv(req);
  const params = req.method === "POST" ? { ...(req.query || {}), ...(req.body || {}) } : (req.query || {});

  if (action.startsWith("oauth-")) {
    return handleYandexOAuth(req, res, action, env, params);
  }

  let token = params.token || "";
  let yandexUserId = params.yandexUserId || "";
  const userId = params.userId ? scopedUserId(req, params.userId) : scopedUserId(req, "");
  const requestBody = params.body || {};

  if (!token && userId) {
    const storedTokens = await readStoredYandexToken(env, req, userId);
    token = storedTokens?.accessToken || "";
    yandexUserId = yandexUserId || storedTokens?.yandexUserId || "";
  }

  if (!token) {
    return res.status(400).json({ error: "OAuth token is required. Please connect your Yandex account." });
  }

  const requestedDays = requestBody.days || 30;
  const { date_from, date_to } = getDateRange(requestedDays);
  let endpoint = "";
  let method = "GET";
  let fetchBody = null;

  if (action === "getUserId") {
    endpoint = `${YANDEX_API_BASE}/user`;
  } else if (action === "getSites") {
    if (!yandexUserId) {
      const userResponse = await fetch(`${YANDEX_API_BASE}/user`, {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (userResponse.ok) {
        const userData = await userResponse.json().catch(() => ({}));
        yandexUserId = userData.user_id || "";
      }
    }
    if (!yandexUserId) return res.status(400).json({ error: "Could not determine Yandex user ID" });
    endpoint = `${YANDEX_API_BASE}/user/${encodeURIComponent(yandexUserId)}/hosts`;
  } else if (action === "getStats") {
    if (!yandexUserId || !params.hostId) {
      return res.status(400).json({ error: "yandexUserId and hostId are required" });
    }
    const query = new URLSearchParams();
    query.append("date_from", date_from);
    query.append("date_to", date_to);
    query.append("query_indicator", "TOTAL_SHOWS");
    query.append("query_indicator", "TOTAL_CLICKS");
    query.append("query_indicator", "AVG_SHOW_POSITION");
    endpoint = `${YANDEX_API_BASE}/user/${encodeURIComponent(yandexUserId)}/hosts/${encodeURIComponent(params.hostId)}/search-queries/all/history?${query.toString()}`;
  } else if (action === "getTopQueries") {
    if (!yandexUserId || !params.hostId) {
      return res.status(400).json({ error: "yandexUserId and hostId are required" });
    }
    const query = new URLSearchParams({
      order_by: requestBody.sort_by === "IMPRESSIONS" ? "TOTAL_SHOWS" : "TOTAL_CLICKS",
      date_from,
      date_to,
      limit: String(requestBody.limit || 50),
    });
    query.append("query_indicator", "TOTAL_SHOWS");
    query.append("query_indicator", "TOTAL_CLICKS");
    query.append("query_indicator", "AVG_SHOW_POSITION");
    endpoint = `${YANDEX_API_BASE}/user/${encodeURIComponent(yandexUserId)}/hosts/${encodeURIComponent(params.hostId)}/search-queries/popular?${query.toString()}`;
  } else if (action === "getTopPages") {
    if (!yandexUserId || !params.hostId) {
      return res.status(400).json({ error: "yandexUserId and hostId are required" });
    }
    method = "POST";
    endpoint = `${YANDEX_API_BASE}/user/${encodeURIComponent(yandexUserId)}/hosts/${encodeURIComponent(params.hostId)}/query-analytics/list`;
    fetchBody = JSON.stringify({
      offset: 0,
      limit: Number(requestBody.limit || 50),
      device_type_indicator: requestBody.device_type_indicator || "ALL",
      text_indicator: "URL",
    });
  } else {
    return res.status(400).json({ error: "Invalid Yandex action" });
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `OAuth ${token}`,
      ...(fetchBody ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
    },
    ...(fetchBody ? { body: fetchBody } : {}),
  });
  const text = await response.text();
  const payload = jsonOrRaw(text);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({ error: "Invalid OAuth token or unauthorized." });
    }
    return res.status(response.status).json({
      error: `Yandex API error: HTTP ${response.status}`,
      details: payload,
    });
  }

  return res.status(200).json(payload);
}

async function handleYandexOAuth(req, res, action, env, params) {
  const { clientId, clientSecret } = getYandexConfig(env);
  const userId = scopedUserId(req, params.userId);

  if (action === "oauth-exchange") {
    const { code } = params;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Yandex OAuth credentials are not configured" });
    }
    if (!code || !userId) {
      return res.status(400).json({ error: "Missing required parameters: code and userId" });
    }

    const tokenResponse = await fetch(YANDEX_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.access_token) {
      return res.status(400).json({ error: "Token exchange failed", details: tokens });
    }

    const previous = await getStoredDocument(env, yandexTokenCollection(userId), "tokens");
    const userInfo = await fetchYandexUserInfo(tokens.access_token).catch(() => ({}));
    const expiresAt = Date.now() + Number(tokens.expires_in || 365 * 24 * 60 * 60) * 1000;

    await upsertStoredDocument(
      env,
      yandexTokenCollection(userId),
      "tokens",
      cleanFields({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || previous?.refreshToken || null,
        expiresAt,
        yandexEmail: userInfo.yandexEmail || previous?.yandexEmail || null,
        yandexUserId: userInfo.yandexUserId || previous?.yandexUserId || null,
        updatedAt: new Date().toISOString(),
      })
    );

    return res.status(200).json({
      success: true,
      connected: true,
      accessToken: tokens.access_token,
      expiresAt,
      yandexEmail: userInfo.yandexEmail || previous?.yandexEmail || null,
      yandexUserId: userInfo.yandexUserId || previous?.yandexUserId || null,
    });
  }

  if (action === "oauth-get") {
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const storedTokens = await readStoredYandexToken(env, req, userId);
    if (!storedTokens?.accessToken) return res.status(200).json({ connected: false });

    return res.status(200).json({
      connected: true,
      accessToken: storedTokens.accessToken,
      expiresAt: storedTokens.expiresAt,
      yandexEmail: storedTokens.yandexEmail || null,
      yandexUserId: storedTokens.yandexUserId || null,
    });
  }

  if (action === "oauth-refresh") {
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const storedTokens = await getStoredDocument(env, yandexTokenCollection(userId), "tokens");
    const refresh = await refreshYandexToken(
      env,
      userId,
      storedTokens?.refreshToken,
      clientId,
      clientSecret
    );
    if (!refresh.success) return res.status(400).json({ error: "Token refresh failed" });
    return res.status(200).json(refresh);
  }

  if (action === "oauth-disconnect") {
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    await deleteStoredDocument(env, yandexTokenCollection(userId), "tokens");
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Invalid OAuth action" });
}
