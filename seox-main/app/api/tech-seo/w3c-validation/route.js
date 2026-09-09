import { onRequest } from "../../../../functions/api/tech-seo/w3c/admin-validation.js";

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
