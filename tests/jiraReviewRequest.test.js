// What the browser actually POSTs to /api/jira/issues/status.
//
// THE RULE THIS FILE EXISTS FOR: the server reads a request that names no
// transition, status or intent as "resolve" - that is what the bare Resolve
// POST has always meant, and it must keep meaning it. So the client's
// fallback `action: 'resolve'` is a loaded gun pointed at the review-only
// case: a user who types a review, leaves the status dropdown alone and
// presses Update must NOT have their ticket closed for them.
//
// The other half is the same rule from the other side: a request with no
// review must still carry the fallback, or the Resolve button stops working.
//
// No network and no React - `fetch` and `window` are stubbed, and the
// assertions are about the body that would have gone over the wire.

import test from "node:test";
import assert from "node:assert/strict";

import { updateJiraTicketStatus } from "../src/lib/jiraTicketsApi.js";

const TOKEN = "admin-token-for-tests";

// jiraAdminToken.js reads window.localStorage and returns '' without a
// window, which would make every call throw before building a body.
globalThis.window = { localStorage: { getItem: () => TOKEN, setItem() {}, removeItem() {} } };

/** Run one call and hand back the JSON body it tried to send. */
async function bodyOf(args) {
  let sent = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await updateJiraTicketStatus(args);
  } finally {
    globalThis.fetch = realFetch;
  }
  return sent;
}

test("a review on its own does NOT ask the server to resolve the ticket", async () => {
  // The whole point. `action` must be absent, so the server takes the request
  // as comment-only rather than as its default intent.
  const { body } = await bodyOf({ issueKey: "SEO-1", review: "Please fix the validation." });
  assert.equal(body.review, "Please fix the validation.");
  assert.equal("action" in body, false);
  assert.equal("status" in body, false);
  assert.equal("transition_id" in body, false);
});

test("a bare call still means resolve, exactly as it always has", async () => {
  const { body } = await bodyOf({ issueKey: "SEO-1" });
  assert.equal(body.action, "resolve");
  assert.equal("review" in body, false);
});

test("a blank review does not suppress the resolve fallback", async () => {
  // Whitespace is not a review, so this is a bare call wearing a textarea.
  for (const review of ["", "   ", "\n\t"]) {
    const { body } = await bodyOf({ issueKey: "SEO-1", review });
    assert.equal(body.action, "resolve", `${JSON.stringify(review)} must not read as a review`);
    assert.equal("review" in body, false);
  }
});

test("a transition and a review travel in one request", async () => {
  const { body } = await bodyOf({
    issueKey: "SEO-1",
    transitionId: "31",
    review: "Implementation completed.",
  });
  assert.equal(body.transition_id, "31");
  assert.equal(body.review, "Implementation completed.");
  // A transition id is explicit; nothing else may compete with it.
  assert.equal("action" in body, false);
  assert.equal("status" in body, false);
});

test("an explicit intent survives alongside a review", async () => {
  const { body } = await bodyOf({ issueKey: "SEO-1", intent: "resolve", review: "Shipped." });
  assert.equal(body.action, "resolve");
  assert.equal(body.review, "Shipped.");
});

test("a status name and a review travel in one request", async () => {
  const { body } = await bodyOf({ issueKey: "SEO-1", status: "In Review", review: "Ready." });
  assert.equal(body.status, "In Review");
  assert.equal(body.review, "Ready.");
  assert.equal("action" in body, false);
});

test("the review is trimmed before it is sent", async () => {
  const { body } = await bodyOf({ issueKey: "SEO-1", transitionId: "31", review: "  Done.  " });
  assert.equal(body.review, "Done.");
});

test("every call carries the admin token and the issue, and goes to the status route", async () => {
  const { url, body } = await bodyOf({ issueKey: "SEO-1", projectId: "42", review: "Note." });
  assert.equal(url, "/api/jira/issues/status");
  assert.equal(body.admin_token, TOKEN);
  assert.equal(body.jira_issue_key, "SEO-1");
  assert.equal(body.project_id, "42");
});
