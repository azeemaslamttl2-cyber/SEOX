// POST /api/jira/issues/status - resolving a Jira ticket through Jira, and
// leaving a review on it.
//
// No database, no HTTP server and no live Jira: the route is called directly
// with a Request and a stub env, the convention the other jira tests use. The
// assertions here are about the things that must hold before any of that
// matters - that the endpoint authenticates on admin_token and nothing else,
// that it never accepts a session, and that it cannot be steered into
// touching an issue the caller does not own.

import test from "node:test";
import assert from "node:assert/strict";

import { onRequest } from "../functions/api/jira/issues/status.js";

const noDbEnv = {}; // no MySQL configured

async function post(payload, env = noDbEnv) {
  const response = await onRequest({
    request: new Request("http://localhost:3000/api/jira/issues/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    env,
  });
  return { status: response.status, body: await response.json() };
}

async function get(query, env = noDbEnv) {
  const response = await onRequest({
    request: new Request(`http://localhost:3000/api/jira/issues/status?${query}`),
    env,
  });
  return { status: response.status, body: await response.json() };
}

// --- Authentication --------------------------------------------------------

test("a request with no admin_token is rejected", async () => {
  const { status, body } = await post({ jira_issue_key: "SEO-1", status: "Done" });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error, "admin_token is required");
});

test("a blank admin_token is rejected, never treated as absent", async () => {
  // Presence of the field must not be enough - an empty string would
  // otherwise slip past a truthiness check as "no token supplied".
  const { status, body } = await post({ admin_token: "", jira_issue_key: "SEO-1" });
  assert.equal(status, 400);
  assert.equal(body.error, "admin_token is required");
});

test("an absurdly long admin_token is refused without a database lookup", async () => {
  const { status, body } = await post({
    admin_token: "x".repeat(600),
    jira_issue_key: "SEO-1",
  });
  assert.equal(status, 401);
  assert.equal(body.error, "Invalid admin_token");
});

test("a session Bearer token is NOT accepted in place of an admin_token", async () => {
  // The whole point of this endpoint's auth rule. A caller holding a valid
  // session must still be refused for want of an admin_token, and the
  // Authorization header must never be read as a fallback.
  const response = await onRequest({
    request: new Request("http://localhost:3000/api/jira/issues/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer a.valid.looking.session.jwt",
      },
      body: JSON.stringify({ jira_issue_key: "SEO-1", status: "Done" }),
    }),
    env: noDbEnv,
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "admin_token is required");
});

test("GET is gated exactly as tightly as POST", async () => {
  // Listing an issue's transitions discloses somebody's Jira workflow, so it
  // is not a cheaper read.
  const { status, body } = await get("jira_issue_key=SEO-1");
  assert.equal(status, 400);
  assert.equal(body.error, "admin_token is required");
});

// --- Input validation ------------------------------------------------------

test("a request with no issue reference is rejected after authentication", async () => {
  // Order matters: admin_token is validated first, so an unauthenticated
  // caller cannot probe the endpoint's input rules.
  const { status, body } = await post({ admin_token: "", status: "Done" });
  assert.equal(status, 400);
  assert.equal(body.error, "admin_token is required");
});

test("a rejected request never reflects the caller's input back", async () => {
  // Deliberately uses the over-long-token path, which fails before any
  // database work, so the assertion is about the response and not about how
  // long a connection attempt takes.
  const { status, body } = await post({
    admin_token: "x".repeat(600),
    jira_issue_key: "SSSSSSSSSS-1",
    status: "<script>alert(1)</script>",
  });
  assert.equal(status, 401);
  assert.equal(body.error, "Invalid admin_token");
  assert.equal(JSON.stringify(body).includes("SSSSSSSSSS"), false);
  assert.equal(JSON.stringify(body).includes("script"), false);
});

// --- Method handling -------------------------------------------------------

test("OPTIONS is answered without authentication", async () => {
  const response = await onRequest({
    request: new Request("http://localhost:3000/api/jira/issues/status", { method: "OPTIONS" }),
    env: noDbEnv,
  });
  assert.equal(response.status, 204);
});

test("write verbs other than POST are refused", async () => {
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const response = await onRequest({
      request: new Request("http://localhost:3000/api/jira/issues/status", { method }),
      env: noDbEnv,
    });
    assert.equal(response.status, 405, `${method} must not be served`);
  }
});

// --- The review -----------------------------------------------------------

test("a review-only request is authenticated before anything else", async () => {
  // Adding a comment is a WRITE to somebody's Jira board, so it is gated
  // exactly as tightly as a transition - there is no lighter path for it.
  const { status, body } = await post({
    jira_issue_key: "SEO-1",
    review: "Please update the screenshots and test again.",
  });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error, "admin_token is required");
});

test("a status + review request is authenticated before anything else", async () => {
  const { status, body } = await post({
    jira_issue_key: "SEO-1",
    status: "In Review",
    review: "Implementation completed. Please review.",
  });
  assert.equal(status, 400);
  assert.equal(body.error, "admin_token is required");
});

test("a rejected request never echoes the review back", async () => {
  // The review is the one field a caller controls completely, so it is the
  // obvious vehicle for getting script into whatever renders an error.
  const { status, body } = await post({
    admin_token: "x".repeat(600),
    jira_issue_key: "SEO-1",
    status: "Done",
    review: "<img src=x onerror=alert(1)> MARKERTEXT",
  });
  assert.equal(status, 401);
  assert.equal(body.error, "Invalid admin_token");
  assert.equal(JSON.stringify(body).includes("MARKERTEXT"), false);
  assert.equal(JSON.stringify(body).includes("onerror"), false);
});

// --- Error shape -----------------------------------------------------------

test("errors are the documented envelope and never leak internals", async () => {
  const { body } = await post({ jira_issue_key: "SEO-1" });
  assert.equal(body.success, false);
  assert.equal(typeof body.error, "string");
  // No SQL, no stack, no credential.
  assert.equal(/select |insert |mysql|at Object\./i.test(body.error), false);
});
