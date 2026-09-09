import { verifyAccessToken } from "./mysql-storage.js";

export function authHeadersFromNodeRequest(req) {
  const headers = new Headers();
  const authorization = req?.headers?.authorization || req?.headers?.Authorization;
  if (authorization) headers.set("authorization", authorization);
  return headers;
}

export async function requireAuthenticatedUser(req, env = process.env) {
  const authorization = req?.headers?.authorization || req?.headers?.Authorization;
  if (!authorization && (process.env.NODE_ENV === "development" || process.env.VITE_DEV === "true")) {
    return { uid: "local-dev-user", email: "dev@example.com" };
  }

  return verifyAccessToken(
    new Request("https://seox.local/auth", {
      headers: authHeadersFromNodeRequest(req),
    }),
    env
  );
}
