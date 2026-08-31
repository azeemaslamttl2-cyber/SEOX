import { onRequest } from "../../../../functions/api/pagespeed.js";

export const runtime = "nodejs";

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const GET = handle;
export const OPTIONS = handle;
