// GET/POST /api/jira/tickets - the ticket list, and the shape it publishes.
//
// This route replaced `POST /api/jira/issues` with `mode: "tickets"`. Two
// things are worth guarding as a result:
//
//   1. the route is reachable in PRODUCTION, not only in dev. Production runs
//      `vite preview`, which serves /api/* from the same middlewares - a route
//      registered for configureServer alone works locally and 404s live, and
//      that has happened in this integration before;
//   2. the ticket objects carry everything the UI renders, including a
//      directly openable `url`, and carry no credential.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { onRequest } from "../functions/api/jira/tickets.js";
import {
  TICKET_FIELDS,
  describeTicket,
  discoverTicketCustomFields,
  flattenAdf,
} from "../functions/_lib/jira-ticket-fields.js";

// --- the route ---------------------------------------------------------------

async function call(url, init) {
  const response = await onRequest({ request: new Request(url, init), env: {} });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

test("a request without an admin_token is refused before any database work", async () => {
  // `env: {}` means no database is configured, so anything that reached a
  // query would fail with a 500 rather than this.
  for (const request of [
    ["http://localhost/api/jira/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["http://localhost/api/jira/tickets", undefined],
  ]) {
    const { status, body } = await call(...request);
    assert.equal(status, 400, request[1]?.method || "GET");
    assert.equal(body.success, false);
    assert.match(body.error, /admin_token/i);
  }
});

test("a blank admin_token is a 400, never an anonymous request", async () => {
  const { status, body } = await call("http://localhost/api/jira/tickets?admin_token=");
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test("OPTIONS is answered without a token, and other verbs are refused", async () => {
  const preflight = await onRequest({
    request: new Request("http://localhost/api/jira/tickets", { method: "OPTIONS" }),
    env: {},
  });
  assert.equal(preflight.status, 204);

  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const { status, body } = await call("http://localhost/api/jira/tickets", { method });
    assert.equal(status, 405, method);
    assert.equal(body.success, false);
  }
});

test("a ticket list is never cacheable", async () => {
  // It is per-credential and changes constantly; a shared cache holding one
  // user's tickets is the worst possible bug here.
  const { headers } = await call("http://localhost/api/jira/tickets");
  assert.match(headers.get("Cache-Control") || "", /no-store/);
});

test("the route is registered for production as well as dev", () => {
  const config = readFileSync("vite.config.js", "utf8");
  assert.ok(config.includes('"/api/jira/tickets": jiraTicketsOnRequest'));
  assert.ok(config.includes('from "./functions/api/jira/tickets.js"'));
  // registerJiraMiddleware walks JIRA_ROUTES, and it is called for BOTH
  // servers. If that ever stops being true, every Jira route 404s in
  // production, so it is asserted rather than assumed.
  assert.ok(config.includes("configurePreviewServer"));
});

test("the route resolves the project mapping rather than reimplementing it", () => {
  const source = readFileSync("functions/api/jira/tickets.js", "utf8");
  assert.ok(
    source.includes("getJiraTicketFeed"),
    "ticket retrieval must go through the existing feed, not a second copy"
  );
  // No Jira URL, project key or credential handling belongs in a route.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/atlassian\.net/.test(code), false, "no hardcoded Jira domain");
  assert.equal(/api_token|apiToken|Basic /.test(code), false, "no credential handling");
});

// --- the ticket shape --------------------------------------------------------

/** A trimmed copy of a real issue from this project's own tenant. */
const ISSUE = {
  id: "122672",
  key: "WZC-190",
  fields: {
    summary: "Review & Finalization of Zero Carbon Website Content",
    description: {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Dear Team," }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "There are " },
            { type: "text", text: "48 pages", marks: [{ type: "strong" }] },
            { type: "text", text: " missing." },
          ],
        },
      ],
    },
    status: {
      id: "10027",
      name: "Stagging",
      statusCategory: { id: 4, key: "indeterminate", colorName: "yellow", name: "In Progress" },
    },
    resolution: null,
    priority: { id: "3", name: "Medium", iconUrl: "https://x/icon.svg" },
    issuetype: { id: "10004", name: "Bug / Incident", subtask: false, hierarchyLevel: 0 },
    assignee: {
      accountId: "70121:ee177bb2",
      displayName: "Asim Ramzan",
      active: true,
      avatarUrls: { "48x48": "https://avatar/48" },
      emailAddress: "should-never-be-forwarded@example.com",
    },
    reporter: { accountId: "63da405d", displayName: "Muhammad Azeem", active: true },
    creator: { accountId: "63da405d", displayName: "Muhammad Azeem", active: true },
    project: { id: "10061", key: "WZC", name: "Web - ZeroCarbon", projectTypeKey: "software" },
    labels: ["seox", "content"],
    components: [{ id: "1", name: "Frontend" }],
    fixVersions: [{ id: "2", name: "v2.0", released: false, releaseDate: "2026-12-01" }],
    duedate: "2026-07-24",
    created: "2026-07-23T14:03:50.246+0500",
    updated: "2026-07-24T17:14:05.788+0500",
    parent: { id: "100", key: "WZC-128", fields: { summary: "Zero Carbon Website Revamp" } },
    comment: {
      total: 3,
      comments: [
        {
          id: "78170",
          author: { accountId: "63da405d", displayName: "Muhammad Azeem" },
          body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Noted." }] }] },
          created: "2026-07-24T09:00:00.000+0500",
          updated: "2026-07-24T09:00:00.000+0500",
        },
      ],
    },
    attachment: [
      {
        id: "75945",
        filename: "image-20260724-101611.png",
        mimeType: "image/png",
        size: 20480,
        author: { accountId: "63da405d", displayName: "Muhammad Azeem" },
        created: "2026-07-24T10:16:11.000+0500",
        content: "https://pgc-edu.atlassian.net/rest/api/3/attachment/content/75945",
      },
    ],
    customfield_10020: [{ id: 42, name: "Sprint 9", state: "active", boardId: 7 }],
    customfield_10028: 5,
  },
};

const CUSTOM = { sprint: "customfield_10020", storyPoints: ["customfield_10028"] };

test("every ticket carries a directly openable Jira URL built from the stored base URL", () => {
  const ticket = describeTicket(ISSUE, { baseUrl: "https://pgc-edu.atlassian.net/" });
  assert.equal(ticket.url, "https://pgc-edu.atlassian.net/browse/WZC-190");

  // A trailing slash on the stored base URL must not produce a double slash.
  assert.equal(
    describeTicket(ISSUE, { baseUrl: "https://pgc-edu.atlassian.net//" }).url,
    "https://pgc-edu.atlassian.net/browse/WZC-190"
  );

  // No base URL is an empty link, never a guessed domain.
  assert.equal(describeTicket(ISSUE, {}).url, "");
});

test("the ticket carries every field the tickets table and detail panel render", () => {
  const t = describeTicket(ISSUE, { baseUrl: "https://x.atlassian.net", customFields: CUSTOM });

  // The screenshot's columns: project, key, summary, type, priority, status,
  // assignee, updated.
  assert.equal(t.project.name, "Web - ZeroCarbon");
  assert.equal(t.key, "WZC-190");
  assert.equal(t.summary, "Review & Finalization of Zero Carbon Website Content");
  assert.equal(t.issueType.name, "Bug / Incident");
  assert.equal(t.priority.name, "Medium");
  assert.equal(t.status.name, "Stagging");
  assert.equal(t.assignee.displayName, "Asim Ramzan");
  assert.equal(t.updated, "2026-07-24T12:14:05.788Z");

  // Status is reported by id, name AND category, because each answers a
  // different question and the category is the only rename-proof one.
  assert.equal(t.status.id, "10027");
  assert.equal(t.status.category, "indeterminate");
  assert.equal(t.status.categoryName, "In Progress");

  // The rest of the detail panel.
  assert.equal(t.id, "122672");
  assert.equal(t.reporter.displayName, "Muhammad Azeem");
  assert.equal(t.creator.displayName, "Muhammad Azeem");
  assert.equal(t.created, "2026-07-23T09:03:50.246Z");
  assert.equal(t.dueDate, "2026-07-24");
  assert.deepEqual(t.labels, ["seox", "content"]);
  assert.deepEqual(t.components, [{ id: "1", name: "Frontend" }]);
  assert.equal(t.fixVersions[0].name, "v2.0");
  assert.equal(t.parent.key, "WZC-128");
  assert.equal(t.parent.url, "https://x.atlassian.net/browse/WZC-128");
  assert.equal(t.resolution, null);
});

test("the due date stays a date and is not shifted by a timezone", () => {
  // Jira stores "2026-07-24" with no time. Parsing it into a UTC midnight
  // timestamp moves it to the 23rd for anyone west of Greenwich.
  const t = describeTicket(ISSUE, { baseUrl: "https://x" });
  assert.equal(t.dueDate, "2026-07-24");
  assert.equal(/T|Z/.test(t.dueDate), false);
});

test("sprint and story points are read through DISCOVERED field ids", () => {
  const withCustom = describeTicket(ISSUE, { baseUrl: "https://x", customFields: CUSTOM });
  assert.equal(withCustom.storyPoints, 5);
  assert.equal(withCustom.sprints[0].name, "Sprint 9");
  assert.equal(withCustom.sprints[0].state, "active");

  // A Jira site without those custom fields yields nothing, not an error -
  // and critically, the ids are not assumed when none were discovered.
  const without = describeTicket(ISSUE, { baseUrl: "https://x" });
  assert.equal(without.storyPoints, null);
  assert.deepEqual(without.sprints, []);
});

test("no custom field id is hardcoded in the shaper", () => {
  // customfield_10020 is Sprint on THIS tenant and something else on the
  // next one. The ids live in test fixtures; they must not live in the code.
  const code = readFileSync("functions/_lib/jira-ticket-fields.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    /customfield_\d+/.test(code),
    false,
    "custom fields must be discovered from /rest/api/3/field, never hardcoded"
  );
});

test("descriptions and comments arrive as text, not as Atlassian markup", () => {
  const t = describeTicket(ISSUE, { baseUrl: "https://x" });
  assert.equal(t.description, "Dear Team,\n\nThere are 48 pages missing.");
  assert.equal(t.comments[0].body, "Noted.");
  // The honest count is Jira's own total, not the length of what was sent.
  assert.equal(t.commentCount, 3);
  assert.equal(t.comments.length, 1);
});

test("flattenAdf survives the shapes that actually break renderers", () => {
  assert.equal(flattenAdf(null), "");
  assert.equal(flattenAdf(undefined), "");
  assert.equal(flattenAdf("already text"), "already text");
  assert.equal(flattenAdf({ type: "doc", content: [] }), "");
  // An unknown node must not throw; its children are still read.
  assert.equal(
    flattenAdf({
      type: "doc",
      content: [{ type: "someFutureMacro", content: [{ type: "text", text: "inner" }] }],
    }),
    "inner"
  );
  // Deep nesting is bounded rather than blowing the stack.
  let deep = { type: "text", text: "bottom" };
  for (let i = 0; i < 200; i += 1) deep = { type: "paragraph", content: [deep] };
  assert.doesNotThrow(() => flattenAdf(deep));
  // And the output is capped.
  const long = { type: "doc", content: [{ type: "text", text: "x".repeat(50000) }] };
  assert.ok(flattenAdf(long).length <= 20000);
});

test("attachments are metadata and a link, never proxied content", () => {
  const t = describeTicket(ISSUE, { baseUrl: "https://x" });
  const [file] = t.attachments;
  assert.equal(file.filename, "image-20260724-101611.png");
  assert.equal(file.size, 20480);
  assert.equal(file.url, "https://pgc-edu.atlassian.net/rest/api/3/attachment/content/75945");
  assert.equal(file.author.displayName, "Muhammad Azeem");
});

// --- what must NOT be in the response ---------------------------------------

test("a Jira user's email address is never forwarded to the browser", () => {
  // The fixture deliberately includes one. Jira omits it on most sites, so
  // code that read it would be broken as often as not - and it is data about
  // someone who never used SEOX.
  const t = describeTicket(ISSUE, { baseUrl: "https://x", customFields: CUSTOM });
  const serialised = JSON.stringify(t);

  assert.equal(serialised.includes("should-never-be-forwarded@example.com"), false);
  assert.equal(/emailAddress/.test(serialised), false);
  // What identifies the person is kept: that is what the assignee column shows.
  assert.equal(t.assignee.displayName, "Asim Ramzan");
  assert.equal(t.assignee.accountId, "70121:ee177bb2");
});

test("Jira's own API URLs are not forwarded as a back channel", () => {
  const t = describeTicket(
    { ...ISSUE, self: "https://x.atlassian.net/rest/api/3/issue/122672" },
    { baseUrl: "https://x.atlassian.net" }
  );
  assert.equal(t.self, "");
  // The browse URL is the one a human can open; the REST URL needs the
  // server's credential and is useless - and misleading - in a browser.
  assert.match(t.url, /\/browse\//);
});

test("the requested field list is explicit and includes what the UI needs", () => {
  // Omitting `fields` returns id and key only, which looks exactly like an
  // issue whose fields are all empty.
  for (const field of [
    "summary",
    "description",
    "status",
    "priority",
    "assignee",
    "reporter",
    "creator",
    "issuetype",
    "labels",
    "components",
    "fixVersions",
    "project",
    "duedate",
    "created",
    "updated",
    "comment",
    "attachment",
  ]) {
    assert.ok(TICKET_FIELDS.includes(field), `${field} must be requested from Jira`);
  }
});

test("custom field discovery degrades to nothing when Jira cannot be asked", async () => {
  // A failure here must never be the reason a ticket list does not load.
  const connection = { id: `test-${Date.now()}`, base_url: "https://x", account_email: "a@b.c" };
  const result = await discoverTicketCustomFields({}, connection);
  assert.deepEqual(result, { sprint: "", storyPoints: [] });
});
