export function corsHeaders(methods = "GET, POST, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function emptyResponse(status = 204, headers = {}) {
  return new Response(null, { status, headers });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function errorResponse(error, headers = {}) {
  if ((error?.status || 500) >= 500) console.error(error);
  return jsonResponse(
    { error: error?.message || "Internal server error" },
    error?.status || 500,
    headers
  );
}
