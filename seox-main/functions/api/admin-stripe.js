import {
  assertAdmin,
  listStoredCollection,
  lookupAuthUsers,
} from "../_lib/mysql-storage.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";
import { getStripe } from "../_lib/stripe.js";

function serializeAccount(account, connection, user) {
  return {
    uid: connection.uid,
    email: account?.email || connection.email || user?.email || "",
    name: user?.displayName || account?.business_profile?.name || "",
    accountId: connection.stripeAccountId || account?.id || "",
    connected: Boolean(connection.stripeAccountId),
    detailsSubmitted: Boolean(account?.details_submitted),
    payoutsEnabled: Boolean(account?.payouts_enabled),
    chargesEnabled: Boolean(account?.charges_enabled),
    requirementsDue: account?.requirements?.currently_due || [],
    disabledReason: account?.requirements?.disabled_reason || "",
    country: account?.country || "",
    businessType: account?.business_type || "",
  };
}

async function getStripeAccountSafe(stripe, accountId) {
  if (!accountId) return null;

  try {
    return await stripe.accounts.retrieve(accountId);
  } catch (error) {
    if (error?.code === "resource_missing") return null;
    throw error;
  }
}

async function handleList(env, stripe) {
  const documents = await listStoredCollection(env, "stripeConnections", 500);
  const connections = documents.map((document) => ({
    ...document,
    uid: document.id,
  }));
  const users = await lookupAuthUsers(
    env,
    connections.map((connection) => connection.uid)
  );
  const usersById = new Map(users.map((user) => [user.localId, user]));

  const accounts = await Promise.all(
    connections.map(async (connection) =>
      serializeAccount(
        await getStripeAccountSafe(stripe, connection.stripeAccountId),
        connection,
        usersById.get(connection.uid)
      )
    )
  );

  return {
    accounts,
    summary: {
      total: accounts.length,
      complete: accounts.filter(
        (account) => account.detailsSubmitted && account.payoutsEnabled
      ).length,
      actionNeeded: accounts.filter(
        (account) =>
          account.requirementsDue.length > 0 || account.disabledReason
      ).length,
      payoutsEnabled: accounts.filter((account) => account.payoutsEnabled).length,
    },
  };
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
    await assertAdmin(request, env);
    const stripe = getStripe(env);

    if (request.method === "GET") {
      return jsonResponse(await handleList(env, stripe), 200, headers);
    }

    const body = await readJson(request);
    const action = body.action || "dashboard";
    if (action !== "dashboard") {
      return jsonResponse({ error: "Unknown Stripe admin action" }, 400, headers);
    }
    if (!body.accountId) {
      return jsonResponse(
        { error: "Stripe account id is required" },
        400,
        headers
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(body.accountId);
    return jsonResponse({ url: loginLink.url }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
