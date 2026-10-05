// Turns a DataForSEO failure into a message the user can act on.
//
// proxy.js hands back { error, status_code, status_message } where the generic
// `error` ("DataforSEO request failed") hides the real reason. DataForSEO's own
// status_message is the source of truth, so match on it as well as the code:
// the numeric codes are not stable enough to rely on alone.

const BILLING_URL = "https://app.dataforseo.com/billing";

export function describeDataForSeoError({ httpStatus = 400, statusCode, statusMessage = "", fallback = "" } = {}) {
  const text = String(statusMessage || "").trim();
  const code = Number(statusCode) || 0;

  if (httpStatus === 402 || code === 40200 || /insufficient|not enough|balance|funds|payment required|top up|credit/i.test(text)) {
    return {
      code: "DATAFORSEO_INSUFFICIENT_BALANCE",
      status: 402,
      message: `Your DataForSEO account has insufficient balance to run this request. Top up your balance at ${BILLING_URL} and try again.${text ? ` (DataForSEO: ${text})` : ""}`,
    };
  }
  if (code === 40201 || /paused|unusual activity|suspended|blocked|disabled/i.test(text)) {
    return {
      code: "DATAFORSEO_ACCOUNT_PAUSED",
      status: 503,
      message: `DataForSEO has paused or restricted this account. Contact support@dataforseo.com to restore access. (DataForSEO: ${text || `code ${code}`})`,
    };
  }
  if (httpStatus === 401 || code === 40100 || code === 40101 || /authori[sz]ation|authentication|invalid (login|password|credentials)|unauthori[sz]ed/i.test(text)) {
    return {
      code: "DATAFORSEO_AUTH_FAILED",
      status: 502,
      message: "DataForSEO rejected the saved login or password. Check the DataForSEO credentials in Settings.",
    };
  }
  if (httpStatus === 429 || code === 40202 || /rate limit|too many requests|requests per minute/i.test(text)) {
    return {
      code: "DATAFORSEO_RATE_LIMITED",
      status: 429,
      message: "DataForSEO rate limit reached. Wait a minute and try again.",
    };
  }
  return {
    code: "DATAFORSEO_ERROR",
    status: httpStatus >= 400 ? httpStatus : 502,
    message: text ? `DataForSEO error${code ? ` ${code}` : ""}: ${text}` : fallback || "Keyword research failed.",
  };
}
