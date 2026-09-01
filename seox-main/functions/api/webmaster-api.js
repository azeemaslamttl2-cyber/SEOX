import handler from "../_handlers/webmaster-api.js";
import { verifyFirebaseIdToken } from "../_lib/firebase-rest.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  const headers = new Headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept, Authorization",
  });

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    var decoded = await verifyFirebaseIdToken(context.request, context.env);
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Unauthorized" }), {
      status: error?.status || 401,
      headers,
    });
  }

  let statusCode = 200;
  let body = "";
  const res = {
    setHeader(name, value) {
      headers.set(name, value);
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      headers.set("content-type", "application/json; charset=utf-8");
      body = JSON.stringify(payload);
      return this;
    },
    end(payload = "") {
      body = payload;
      return this;
    },
  };

  const requestBody = ["POST", "PUT", "PATCH"].includes(context.request.method)
    ? await context.request.json().catch(() => ({}))
    : {};

  await handler(
    {
      method: context.request.method,
      query,
      body: requestBody,
      env: context.env,
      user: decoded,
    },
    res
  );
  return new Response(body, { status: statusCode, headers });
}
