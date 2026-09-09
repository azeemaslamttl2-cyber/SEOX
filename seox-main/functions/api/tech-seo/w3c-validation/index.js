import { onRequest } from "../w3c/admin-validation.js";

export { onRequest };

export async function GET(request) {
  return onRequest({ request, env: process.env });
}

export async function POST(request) {
  return onRequest({ request, env: process.env });
}

export async function OPTIONS(request) {
  return onRequest({ request, env: process.env });
}
