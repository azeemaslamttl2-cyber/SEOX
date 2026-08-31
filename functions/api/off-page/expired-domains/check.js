import { checkExpiredDomains } from "../../../../src/lib/expiredDomainChecker.js";

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

function validateAdminToken(value) {
  const adminToken = typeof value === "string" ? value.trim() : "";
  if (!adminToken) return error("admin_token is required.", 400);
  if (adminToken.length > 512) return error("admin_token is too long.", 400);
  return null;
}

function domainsFromBody(body) {
  if (Array.isArray(body?.domains)) return body.domains.join("\n");
  if (typeof body?.domains === "string") return body.domains;
  if (typeof body?.domainList === "string") return body.domainList;
  return "";
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const body = await request.json().catch(() => null);
    const tokenError = validateAdminToken(body?.admin_token);
    if (tokenError) return tokenError;

    const domains = domainsFromBody(body);
    if (!domains.trim()) return error("Domain list is required.", 400);

    const checked = checkExpiredDomains(domains);
    if (!checked.normalized.length) {
      return error("No valid domains were provided.", 422);
    }

    return json({
      success: true,
      data: checked.results,
      normalizedDomains: checked.normalized,
      rejectedDomains: checked.rejected,
      removedCount: checked.rejected.length,
      available: checked.results.filter((result) => result.available).length,
      taken: checked.results.filter((result) => !result.available).length,
    });
  } catch (caught) {
    return error(caught?.message || "Expired domain check failed.", caught?.status || 500);
  }
}
