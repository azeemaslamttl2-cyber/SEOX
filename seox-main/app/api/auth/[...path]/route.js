import { onRequestGet, onRequestPost } from "../../../../functions/api/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  return onRequestGet({ request, env: process.env });
}

export async function POST(request) {
  return onRequestPost({ request, env: process.env });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
