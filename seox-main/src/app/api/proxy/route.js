import { onRequest } from "../../../../functions/api/proxy.js";

export const runtime = "nodejs";

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
