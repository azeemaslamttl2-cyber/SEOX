import { onRequest } from "../../../functions/api/project-info.js";

export const runtime = "nodejs";

export async function GET(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
