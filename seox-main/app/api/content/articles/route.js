import { onRequest } from "../../../../functions/api/content/articles.js";

export const runtime = "nodejs";

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
