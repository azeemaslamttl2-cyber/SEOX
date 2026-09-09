import { onRequest } from "../../../../functions/api/keywords/research.js";

export const runtime = "nodejs";

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}