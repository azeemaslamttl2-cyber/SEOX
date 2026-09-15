import { corsHeaders, emptyResponse, errorResponse, jsonResponse } from "../../_lib/http.js";
import { getPublicAppSettings } from "../../_lib/app-settings.js";

/**
 * Non-sensitive configuration the browser genuinely needs.
 *
 * Only settings flagged `public` in the settings service are exposed here: the
 * Google OAuth client id and the redirect URIs.  Both are public by design -
 * they appear in the browser's address bar during an OAuth redirect.  Client
 * secrets, API keys and the DataForSEO password are never included, and are not
 * reachable through this route.
 */
export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    const settings = await getPublicAppSettings(env);
    return jsonResponse(
      {
        googleClientId: settings.google_client_id || "",
        googleGscRedirectUri: settings.google_gsc_redirect_uri || "",
        googleAuthRedirectUri: settings.google_auth_redirect_uri || "",
        googleGbpRedirectUri: settings.google_gbp_redirect_uri || "",
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
