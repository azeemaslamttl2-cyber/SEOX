import { onRequest } from "../../../functions/api/deepseek-settings.js";

export const runtime = "nodejs";

export async function GET(request) {
  return onRequest({ request, env: process.env });
}

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
