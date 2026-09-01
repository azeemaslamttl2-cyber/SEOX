import {
  firestoreTimestamp,
  getFirestoreDocument,
  patchFirestoreDocument,
  verifyFirebaseIdToken,
} from "../_lib/firebase-rest.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";
import { getStripe } from "../_lib/stripe.js";

const CONNECTIONS_COLLECTION = "stripeConnections";

function getBaseUrl(request, env) {
  const configured = env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  return new URL(request.url).origin;
}

function serializeAccount(account, connection = {}) {
  if (!account) {
    return {
      connected: false,
      accountId: "",
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      requirementsDue: [],
      disabledReason: "",
      email: connection.email || "",
      country: "",
    };
  }

  return {
    connected: Boolean(account.id),
    accountId: account.id,
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
    chargesEnabled: Boolean(account.charges_enabled),
    requirementsDue: account.requirements?.currently_due || [],
    disabledReason: account.requirements?.disabled_reason || "",
    email: account.email || connection.email || "",
    country: account.country || "",
    businessType: account.business_type || "",
  };
}

async function getStripeAccount(stripe, accountId) {
  if (!accountId) return null;

  try {
    return await stripe.accounts.retrieve(accountId);
  } catch (error) {
    if (error?.code === "resource_missing") return null;
    throw error;
  }
}

async function getConnection(env, uid) {
  return getFirestoreDocument(env, CONNECTIONS_COLLECTION, uid);
}

async function handleStatus(env, stripe, decoded) {
  const connection = await getConnection(env, decoded.uid);
  const account = await getStripeAccount(
    stripe,
    connection?.stripeAccountId
  );
  return serializeAccount(account, connection || {});
}

async function handleConnect(request, env, stripe, decoded) {
  const connection = await getConnection(env, decoded.uid);
  let account = await getStripeAccount(stripe, connection?.stripeAccountId);

  if (!account) {
    account = await stripe.accounts.create({
      type: "express",
      email: decoded.email,
      metadata: {
        firebaseUid: decoded.uid,
        firebaseEmail: decoded.email || "",
      },
    });

    const now = firestoreTimestamp();
    await patchFirestoreDocument(env, CONNECTIONS_COLLECTION, decoded.uid, {
      stripeAccountId: account.id,
      email: decoded.email || "",
      createdAt: now,
      updatedAt: now,
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${getBaseUrl(request, env)}/settings/stripe?stripe=refresh`,
    return_url: `${getBaseUrl(request, env)}/settings/stripe?stripe=return`,
    type: "account_onboarding",
  });

  await patchFirestoreDocument(env, CONNECTIONS_COLLECTION, decoded.uid, {
    email: decoded.email || "",
    lastOnboardingLinkAt: firestoreTimestamp(),
    updatedAt: firestoreTimestamp(),
  });

  return { url: accountLink.url };
}

async function handleDashboard(env, stripe, decoded) {
  const connection = await getConnection(env, decoded.uid);
  if (!connection?.stripeAccountId) {
    const error = new Error("Connect Stripe before opening the dashboard");
    error.status = 400;
    throw error;
  }

  const loginLink = await stripe.accounts.createLoginLink(
    connection.stripeAccountId
  );
  return { url: loginLink.url };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(200, headers);
  if (!["GET", "POST"].includes(request.method)) {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    const decoded = await verifyFirebaseIdToken(request, env);
    const stripe = getStripe(env);

    if (request.method === "GET") {
      return jsonResponse(
        await handleStatus(env, stripe, decoded),
        200,
        headers
      );
    }

    const body = await readJson(request);
    const action = body.action || "connect";
    if (action === "connect") {
      return jsonResponse(
        await handleConnect(request, env, stripe, decoded),
        200,
        headers
      );
    }
    if (action === "dashboard") {
      return jsonResponse(
        await handleDashboard(env, stripe, decoded),
        200,
        headers
      );
    }

    return jsonResponse({ error: "Unknown Stripe action" }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
