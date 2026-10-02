import { getJiraAdminToken } from "./jiraAdminToken.js";

const ENDPOINT = "/api/off-page/backlink-indexer";

/**
 * Client for the Google Indexing API endpoint. Authenticates with the same
 * admin_token the Jira pages store; Google credentials never reach the browser.
 */
async function call(action, payload = {}, signal) {
  const token = getJiraAdminToken();
  if (!token) throw Object.assign(new Error("Enter your admin token to use the Google Indexing API."), { code: "NO_TOKEN" });
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action, admin_token: token }),
      signal,
    });
  } catch (caught) {
    if (caught?.name === "AbortError") throw caught;
    throw Object.assign(new Error("Could not reach the server. Check your connection and try again."), { code: "NETWORK" });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const message =
      response.status === 401
        ? "The admin token was rejected. Re-enter a valid admin token."
        : body?.error || `The server returned HTTP ${response.status}.`;
    throw Object.assign(new Error(message), { code: body?.code || `HTTP_${response.status}`, status: response.status });
  }
  return body.data;
}

export const fetchIndexingStatus = (signal) => call("status", {}, signal);
export const validateIndexingUrls = (urls, signal) => call("validate", { urls }, signal);
export const fetchIndexingHistory = ({ limit = 50, offset = 0 } = {}, signal) => call("history", { limit, offset }, signal);
export const submitIndexingUrls = ({ urls, type = "URL_UPDATED", force = false }, signal) =>
  call("submit", { urls, type, force }, signal);
