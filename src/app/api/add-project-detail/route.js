import { onRequest } from "../../../../functions/api/project-details.js";

export const runtime = "nodejs";

export function POST(request) {
  return onRequest({ request, env: process.env });
}

export function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
