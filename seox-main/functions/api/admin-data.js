import {
  assertAdmin,
  listAuthUsers,
  readFirstCollection,
} from "../_lib/firebase-rest.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
} from "../_lib/http.js";

function formatDate(value) {
  if (!value) return "";

  const normalized =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseClaims(user) {
  try {
    return JSON.parse(user.customAttributes || "{}");
  } catch {
    return {};
  }
}

function normalizeTier(value) {
  const tier = String(value || "free").trim().toLowerCase();

  if (tier === "admin") return "admin";
  if (tier === "enterprise") return "enterprise";
  if (["professional", "proffesional", "pro", "premium"].includes(tier)) {
    return "professional";
  }

  return "free";
}

function normalizeUser(user) {
  const claims = parseClaims(user);
  const rawPlan =
    claims.level ||
    claims.plan ||
    claims.planName ||
    claims.subscription ||
    claims.subscriptionLevel ||
    "free";
  const level = claims.admin ? "admin" : normalizeTier(rawPlan);

  return {
    id: user.localId,
    name: user.displayName || user.email?.split("@")[0] || "Unnamed user",
    email: user.email || "",
    level,
    tenure: claims.tenure || claims.billingCycle || null,
    geo: Boolean(claims.geo || claims.geoAccess || claims.geo_enabled),
    joined: formatDate(user.createdAt),
    createdAt: user.createdAt || "",
    lastSignIn: formatDate(user.lastLoginAt),
    disabled: Boolean(user.disabled),
  };
}

function normalizePayment(doc) {
  return {
    id: doc.id,
    user:
      doc.user || doc.userName || doc.displayName || doc.email || "Unknown user",
    email: doc.email || doc.userEmail || "",
    plan: doc.plan || doc.level || doc.package || "Upgrade",
    amount: doc.amountFormatted || doc.amount || doc.value || "",
    date: formatDate(doc.date || doc.createdAt || doc.submittedAt || doc.updatedAt),
    status: String(doc.status || "pending").toLowerCase(),
  };
}

function normalizeNiche(doc) {
  return {
    id: doc.id,
    user:
      doc.user || doc.userName || doc.displayName || doc.email || "Unknown user",
    email: doc.email || doc.userEmail || "",
    niche: doc.niche || doc.name || doc.topic || "Untitled niche",
    status: String(doc.status || "pending").toLowerCase(),
    submitted: formatDate(doc.submitted || doc.createdAt || doc.submittedAt),
    keywords: Number(doc.keywords || doc.keywordCount || doc.totalKeywords || 0),
  };
}

function normalizeAffiliate(doc) {
  return {
    id: doc.id,
    name:
      doc.name ||
      doc.userName ||
      doc.displayName ||
      doc.email ||
      "Unknown affiliate",
    email: doc.email || doc.userEmail || "",
    code: doc.code || doc.referralCode || doc.affiliateCode || "",
    referrals: Number(doc.referrals || doc.referralCount || 0),
    earnings: Number(doc.earnings || doc.totalEarnings || doc.commission || 0),
    conversionRate: Number(doc.conversionRate || doc.conversion || 0),
    status: String(doc.status || "active").toLowerCase(),
    joined: formatDate(doc.joined || doc.createdAt),
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(200, headers);
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    await assertAdmin(request, env);

    const [users, payments, niches, affiliates] = await Promise.all([
      listAuthUsers(env),
      readFirstCollection(env, "ADMIN_PAYMENTS_COLLECTION", [
        "paymentRequests",
        "payments",
        "upgradeRequests",
      ]),
      readFirstCollection(env, "ADMIN_NICHES_COLLECTION", [
        "nicheSubmissions",
        "niches",
        "userNiches",
      ]),
      readFirstCollection(env, "ADMIN_AFFILIATES_COLLECTION", [
        "affiliates",
        "affiliateUsers",
        "referrals",
      ]),
    ]);

    const normalizedUsers = users
      .map(normalizeUser)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    return jsonResponse(
      {
        users: normalizedUsers,
        payments: payments.map(normalizePayment),
        niches: niches.map(normalizeNiche),
        affiliates: affiliates.map(normalizeAffiliate),
        generatedAt: new Date().toISOString(),
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
