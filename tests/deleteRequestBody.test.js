import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

const { default: config } = await import("../vite.config.js");

/**
 * Builds a fake Node request stream like the one Connect hands to a Vite
 * middleware, so the real middleware path can be exercised end to end.
 *
 * Whether the middleware drains this stream is the signal these tests use: the
 * body is only forwarded to the API handler if it was read off the request.
 */
function fakeNodeRequest({ method, url = "/", body }) {
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  stream.method = method;
  stream.url = url;
  stream.headers = {
    host: "localhost:3000",
    "content-type": "application/json",
    authorization: "Bearer test-token",
  };
  return stream;
}

function captureResponse() {
  const chunks = [];
  return {
    statusCode: 200,
    headers: {},
    body: () => Buffer.concat(chunks).toString("utf8"),
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      Object.assign(this.headers, headers || {});
    },
    write(chunk) {
      chunks.push(Buffer.from(chunk));
    },
    end(chunk) {
      if (chunk) chunks.push(Buffer.from(chunk));
      this.finished = true;
    },
  };
}

async function callMiddleware(pluginName, mountPath, request) {
  const plugin = config.plugins.find((entry) => entry && entry.name === pluginName);
  assert.ok(plugin, `${pluginName} should be registered`);

  let handler = null;
  plugin.configureServer({
    middlewares: {
      use(path, fn) {
        if (path === mountPath) handler = fn;
      },
    },
  });
  assert.ok(handler, `${mountPath} should be mounted`);

  const res = captureResponse();
  await handler(request, res);
  return res;
}

test("the projects middleware forwards a DELETE body", async () => {
  // Regression: readRawBody skipped DELETE, so /api/projects saw an empty body
  // and rejected every delete with "Project id is required". The request stream
  // going unread is exactly what caused that.
  const request = fakeNodeRequest({
    method: "DELETE",
    body: JSON.stringify({ projectId: "proj_123" }),
  });

  await callMiddleware("seox-projects-api", "/api/projects", request);

  assert.equal(
    request.readableEnded,
    true,
    "the DELETE body should have been read and forwarded to the handler"
  );
});

test("the projects middleware forwards a POST body", async () => {
  const request = fakeNodeRequest({
    method: "POST",
    body: JSON.stringify({ action: "saveMeta" }),
  });

  await callMiddleware("seox-projects-api", "/api/projects", request);

  assert.equal(request.readableEnded, true, "the POST body should have been read");
});

test("a GET request body is not read", async () => {
  const request = fakeNodeRequest({ method: "GET" });

  await callMiddleware("seox-projects-api", "/api/projects", request);

  assert.equal(request.readableEnded, false, "GET carries no body to forward");
});
