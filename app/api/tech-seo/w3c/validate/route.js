import { onRequest } from "../../../../../functions/api/tech-seo/w3c/validate.js";

export async function GET(request) {
  return onRequest({ request, env: process.env });
}

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
