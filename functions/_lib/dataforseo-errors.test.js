import test from "node:test";
import assert from "node:assert/strict";
import { describeDataForSeoError } from "./dataforseo-errors.js";

test("insufficient balance is reported as such, by message or HTTP 402", () => {
  const byText = describeDataForSeoError({ httpStatus: 400, statusCode: 40210, statusMessage: "Insufficient funds. Please top up your balance." });
  assert.equal(byText.code, "DATAFORSEO_INSUFFICIENT_BALANCE");
  assert.equal(byText.status, 402);
  assert.match(byText.message, /insufficient balance/i);
  assert.match(byText.message, /billing/);
  assert.equal(describeDataForSeoError({ httpStatus: 402, statusMessage: "Payment Required" }).code, "DATAFORSEO_INSUFFICIENT_BALANCE");
});

test("paused account keeps DataForSEO's explanation", () => {
  const r = describeDataForSeoError({ statusCode: 40201, statusMessage: "We noticed some unusual activity in your DataForSEO account" });
  assert.equal(r.code, "DATAFORSEO_ACCOUNT_PAUSED");
  assert.match(r.message, /unusual activity/);
  assert.match(r.message, /support@dataforseo\.com/);
});

test("auth, rate limit and unknown errors", () => {
  assert.equal(describeDataForSeoError({ httpStatus: 401, statusMessage: "Authorization failed" }).code, "DATAFORSEO_AUTH_FAILED");
  assert.equal(describeDataForSeoError({ httpStatus: 429 }).code, "DATAFORSEO_RATE_LIMITED");
  const other = describeDataForSeoError({ httpStatus: 400, statusCode: 40501, statusMessage: "Invalid Field: 'keyword'" });
  assert.equal(other.code, "DATAFORSEO_ERROR");
  assert.match(other.message, /40501.*Invalid Field/);
  assert.equal(describeDataForSeoError({ httpStatus: 500, fallback: "boom" }).message, "boom");
});
