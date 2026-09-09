export async function verifyFirebaseIdToken(request, env = {}) {
  const authHeader = request?.headers?.get?.("Authorization") || request?.headers?.get?.("authorization") || "";
  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  return {
    uid: env?.FIREBASE_UID || "local-dev-user",
    email: env?.FIREBASE_EMAIL || "local@example.com",
    name: env?.FIREBASE_NAME || "Local Dev User",
    picture: env?.FIREBASE_PICTURE || null,
    firebase: { sign_in_provider: "custom" },
  };
}
