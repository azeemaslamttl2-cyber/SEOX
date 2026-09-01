export function getAhrefsApiToken(env = process.env) {
  return String(env?.AHREFS_API_TOKEN || "").trim();
}
