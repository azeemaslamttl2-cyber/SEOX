import { onRequest } from "../../../../functions/api/keywords/ubersuggest.js";

export const runtime = "nodejs";

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
