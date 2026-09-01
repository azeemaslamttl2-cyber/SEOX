import process from "node:process";

function exposeEnvironment(env) {
  for (const [key, value] of Object.entries(env || {})) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseQuery(url) {
  const query = {};

  for (const [key, value] of url.searchParams) {
    if (query[key] === undefined) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }

  return query;
}

async function parseBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(await request.text());
    return Object.fromEntries(form);
  }

  const text = await request.text();
  return text || undefined;
}

function createResponseAdapter() {
  let statusCode = 200;
  let body = null;
  const headers = new Headers();

  const response = {
    status(code) {
      statusCode = code;
      return response;
    },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        headers.set(name, value.join(", "));
      } else {
        headers.set(name, String(value));
      }
      return response;
    },
    json(payload) {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
      body = JSON.stringify(payload);
      return response;
    },
    send(payload) {
      if (payload !== undefined && payload !== null) {
        body =
          typeof payload === "string" || payload instanceof ArrayBuffer
            ? payload
            : JSON.stringify(payload);
      }
      return response;
    },
    end(payload) {
      if (payload !== undefined && payload !== null) body = payload;
      return response;
    },
    toResponse() {
      return new Response(body, { status: statusCode, headers });
    },
  };

  Object.defineProperty(response, "statusCode", {
    get: () => statusCode,
    set: (value) => {
      statusCode = value;
    },
  });

  return response;
}

export async function runNodeHandler(context, handler) {
  exposeEnvironment(context.env);

  const url = new URL(context.request.url);
  const headers = Object.fromEntries(
    Array.from(context.request.headers.entries()).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
  const req = {
    method: context.request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    query: parseQuery(url),
    body: await parseBody(context.request.clone()),
  };
  const res = createResponseAdapter();

  try {
    await handler(req, res);
    return res.toResponse();
  } catch (error) {
    console.error("Pages Function handler error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      {
        status: error?.status || 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
}
