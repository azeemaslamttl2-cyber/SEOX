import { onRequest } from "../../../../functions/api/content/helpful-content.js";

export const runtime = "nodejs";

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const POST = handle;
export const OPTIONS = handle;
