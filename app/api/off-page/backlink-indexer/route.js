import { onRequest } from "../../../../functions/api/off-page/backlink-indexer.js";

export const runtime = "nodejs";

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
