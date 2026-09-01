import { verifyFirebaseIdToken } from "./firebase-rest.js";

export function authHeadersFromNodeRequest(req) {
  const headers = new Headers();
  const authorization = req?.headers?.authorization || req?.headers?.Authorization;
  if (authorization) headers.set("authorization", authorization);
  return headers;
}

export async function requireFirebaseAuthFromNodeRequest(req, env = process.env) {
  return verifyFirebaseIdToken(
    new Request("https://ai-smart-seo.local/auth", {
      headers: authHeadersFromNodeRequest(req),
    }),
    env
  );
}
