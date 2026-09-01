import { assertAdmin } from "../_lib/firebase-rest.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
} from "../_lib/http.js";

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
    const decoded = await assertAdmin(request, env);
    return jsonResponse(
      {
        isAdmin: true,
        email: decoded.email || "",
        uid: decoded.uid || "",
      },
      200,
      headers
    );
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return jsonResponse({ isAdmin: false }, 200, headers);
    }
    return errorResponse(error, headers);
  }
}
