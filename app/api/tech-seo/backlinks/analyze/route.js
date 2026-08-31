import { onRequest } from "../../../../../functions/api/tech-seo/backlinks/analyze.js";

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
