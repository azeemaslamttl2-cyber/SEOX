// The Jira Tickets page's project auto-selection, tested away from React.
//
// The page shows the Jira board mapped to whichever SEOX project is chosen in
// the top selector. What makes that worth a test file is not the happy path
// but the four ways it can fail to resolve - and the fact that the four
// inputs arrive at different times, so "not mapped" and "not answered yet"
// are constantly one render apart.
//
// The rule every case below enforces: a key is returned ONLY when it is the
// mapped one. There is no fallback to the first available board, because
// showing project B's tickets under project A's name is worse than showing
// none - that fallback is the bug this resolution replaced.

import test from "node:test";
import assert from "node:assert/strict";

import { resolveMappedJiraProject } from "../src/lib/jiraProjectMapping.js";
import { presentState } from "../src/lib/jiraTicketStates.js";

const JIRA_PROJECTS = [
  { base_url: "https://x.atlassian.net", id: "10055", key: "WUCP", name: "Web - UCP" },
  { base_url: "https://x.atlassian.net", id: "10061", key: "ZC", name: "Zero Carbon" },
  { base_url: "https://x.atlassian.net", id: "10077", key: "EBD", name: "Elias - Big Commerce" },
];

const LIST_OK = { ok: true, code: "OK", message: "3 Jira projects available." };

/** A fully resolved, healthy lookup; each test overrides only what it is about. */
function input(overrides = {}) {
  return {
    projectSelectionSettled: true,
    seoxProjectId: "p-zero-carbon",
    seoxProjectName: "https://stg-zerocarbon-staging.kinsta.cloud",
    mappingFetchStatus: "success",
    mappingError: null,
    jiraConnected: true,
    mappedJiraKey: "ZC",
    mappedJiraName: "Zero Carbon",
    jiraProjects: JIRA_PROJECTS,
    jiraProjectsState: LIST_OK,
    loadingProjects: false,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------
 * 1. The project has a Jira mapping.
 * ---------------------------------------------------------------------- */

test("a mapped project resolves to its own Jira key", () => {
  const result = resolveMappedJiraProject(input());
  assert.equal(result.status, "ready");
  assert.equal(result.key, "ZC");
  assert.equal(result.state, null);
});

test("the resolved key is the mapping's, never the first in the list", () => {
  // WUCP is first and would have been selected by the old `jiraProjects[0]`.
  const result = resolveMappedJiraProject(input({ mappedJiraKey: "EBD", mappedJiraName: "Elias" }));
  assert.equal(result.key, "EBD");
  assert.notEqual(result.key, JIRA_PROJECTS[0].key);
});

/* -------------------------------------------------------------------------
 * 2. The project has no Jira mapping - nothing is selected.
 * ---------------------------------------------------------------------- */

test("an unmapped project selects nothing and says why", () => {
  const result = resolveMappedJiraProject(input({ mappedJiraKey: "", mappedJiraName: "" }));
  assert.equal(result.status, "blocked");
  assert.equal(result.key, "", "no board may be selected for an unmapped project");
  assert.equal(result.state.code, "JIRA_PROJECT_MAPPING_MISSING");
  assert.match(result.state.message, /No Jira project is mapped to/);
  // The message names the project, so a user with several open tabs can tell
  // which one it is about.
  assert.match(result.state.message, /stg-zerocarbon-staging/);
});

test("a project without a Jira connection is told THAT, not that it is unmapped", () => {
  const result = resolveMappedJiraProject(
    input({ jiraConnected: false, mappedJiraKey: "", mappedJiraName: "" })
  );
  assert.equal(result.state.code, "JIRA_NOT_CONFIGURED");
  // Different problem, different screen: connect first, map second.
  assert.equal(presentState(result.state).action.href, "/settings/general?tab=jira");
});

/* -------------------------------------------------------------------------
 * 3. Switching projects: the answer follows the new project's mapping.
 * ---------------------------------------------------------------------- */

test("switching project switches the resolved board", () => {
  const a = resolveMappedJiraProject(
    input({ seoxProjectId: "p-ucp", seoxProjectName: "https://ucp.edu.pk/", mappedJiraKey: "WUCP" })
  );
  const b = resolveMappedJiraProject(input());

  assert.equal(a.key, "WUCP");
  assert.equal(b.key, "ZC");
  assert.notEqual(a.key, b.key, "project B must not inherit project A's board");
});

test("a project switch whose mapping has not been read yet resolves to nothing at all", () => {
  // The render right after the switch: the new project's mapping request has
  // not even started. Returning the previous key here is precisely the race
  // the page guards against.
  const result = resolveMappedJiraProject(
    input({ seoxProjectId: "p-other", mappingFetchStatus: "idle", mappedJiraKey: "" })
  );
  assert.equal(result.status, "waiting");
  assert.equal(result.key, "");
  assert.equal(result.state, null, "waiting must not render an error");
});

/* -------------------------------------------------------------------------
 * 4. Page refresh / direct navigation: wait, do not accuse.
 * ---------------------------------------------------------------------- */

test("nothing is decided until the project selection itself has loaded", () => {
  // A refresh on /jira/tickets: the inventory and the restored selection are
  // both still in flight, so `seoxProjectId` is empty for reasons that have
  // nothing to do with the user.
  const result = resolveMappedJiraProject(
    input({ projectSelectionSettled: false, seoxProjectId: "", mappedJiraKey: "" })
  );
  assert.equal(result.status, "waiting");
  assert.notEqual(result.status, "blocked", "a refresh must not report 'no project selected'");
});

test("once settled with no project at all, the user is asked to choose one", () => {
  const result = resolveMappedJiraProject(
    input({ seoxProjectId: "", mappedJiraKey: "", jiraConnected: false })
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.state.code, "SEOX_PROJECT_NOT_SELECTED");
});

test("a mapping that is known but whose board list is still loading waits", () => {
  const result = resolveMappedJiraProject(
    input({ loadingProjects: true, jiraProjects: [], jiraProjectsState: null })
  );
  assert.equal(result.status, "waiting");
  assert.equal(result.key, "", "a board cannot be selected before the list exists");
});

test("a refreshing mapping keeps resolving from the value it already has", () => {
  // 'refreshing' means the cache holds a good answer and a background request
  // is under way. Treating it as pending would blank the page every 5 minutes.
  const result = resolveMappedJiraProject(input({ mappingFetchStatus: "refreshing" }));
  assert.equal(result.status, "ready");
  assert.equal(result.key, "ZC");
});

/* -------------------------------------------------------------------------
 * 5. The mapped Jira project is not available.
 * ---------------------------------------------------------------------- */

test("a mapped board the credential cannot see is an error, not a substitution", () => {
  const result = resolveMappedJiraProject(
    input({ mappedJiraKey: "GONE", mappedJiraName: "Retired Board" })
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.key, "", "must not fall back to any other board");
  assert.equal(result.state.code, "JIRA_MAPPED_PROJECT_UNAVAILABLE");
  assert.match(result.state.message, /GONE/);
  assert.match(result.state.message, /Retired Board/);

  const presented = presentState(result.state);
  assert.equal(presented.tone, "error", "this may never be presented as an empty backlog");
  assert.equal(presented.action.href, "/settings/general?tab=jira");
});

test("a failed board list is not blamed on the mapping", () => {
  // The list request itself failed. The page renders that failure on its own;
  // claiming the mapping is broken too would send the user to fix the wrong
  // thing.
  const result = resolveMappedJiraProject(
    input({
      jiraProjects: [],
      jiraProjectsState: { ok: false, code: "JIRA_API_UNAVAILABLE", message: "Jira timed out." },
    })
  );
  assert.equal(result.status, "waiting");
  assert.notEqual(result.state?.code, "JIRA_MAPPED_PROJECT_UNAVAILABLE");
});

test("an unreadable mapping is reported as unreadable and is retryable", () => {
  const result = resolveMappedJiraProject(
    input({ mappingFetchStatus: "error", mappingError: new Error("HTTP 503 from SEOX.") })
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.state.code, "JIRA_MAPPING_UNREADABLE");
  assert.match(result.state.message, /503/);
  assert.equal(presentState(result.state).retryable, true);
});

/* -------------------------------------------------------------------------
 * 6. The invariant, over every case above.
 * ---------------------------------------------------------------------- */

test("no outcome ever returns a key that is not the mapped one", () => {
  const cases = [
    input(),
    input({ mappedJiraKey: "" }),
    input({ mappedJiraKey: "GONE" }),
    input({ jiraConnected: false }),
    input({ mappingFetchStatus: "idle" }),
    input({ mappingFetchStatus: "error", mappingError: new Error("boom") }),
    input({ projectSelectionSettled: false }),
    input({ seoxProjectId: "" }),
    input({ loadingProjects: true, jiraProjectsState: null }),
    input({ jiraProjectsState: { ok: false, code: "JIRA_API_ERROR", message: "nope" } }),
    input({ jiraProjects: [] }),
  ];

  for (const args of cases) {
    const { status, key } = resolveMappedJiraProject(args);
    if (key) {
      assert.equal(status, "ready");
      assert.equal(key, args.mappedJiraKey, "the only key ever returned is the mapped key");
    }
  }
});

test("every blocked outcome carries a code the page can explain", () => {
  const blocked = [
    input({ seoxProjectId: "" }),
    input({ mappedJiraKey: "" }),
    input({ jiraConnected: false }),
    input({ mappedJiraKey: "GONE" }),
    input({ mappingFetchStatus: "error", mappingError: new Error("boom") }),
  ].map((args) => resolveMappedJiraProject(args));

  for (const result of blocked) {
    assert.equal(result.status, "blocked");
    const presented = presentState(result.state);
    assert.equal(presented.tone, "error");
    // FALLBACK's title. Hitting it would mean the state reached the screen
    // without a written explanation, which is the whole thing these codes
    // exist to prevent.
    assert.notEqual(presented.title, "Jira tickets could not be loaded");
  }
});

/* -------------------------------------------------------------------------
 * 7. A partial board list proves nothing about the mapping.
 *
 * The server walks Jira's pagination and reports `complete: false` when it
 * could not finish. Before that flag existed, a board past the old page cap
 * was simply absent from the list, and this resolver would have convicted a
 * perfectly good mapping of pointing at a deleted project.
 * ---------------------------------------------------------------------- */

test("a board missing from an INCOMPLETE list is not called unavailable", () => {
  const result = resolveMappedJiraProject(
    input({ mappedJiraKey: "FARDOWN", mappedJiraName: "Far Down The Alphabet", jiraProjectsComplete: false })
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.state.code, "JIRA_PROJECT_LIST_INCOMPLETE");
  assert.notEqual(
    result.state.code,
    "JIRA_MAPPED_PROJECT_UNAVAILABLE",
    "an unfinished list must not be evidence that the board is gone"
  );
  // No "re-map it" instruction, because the mapping is probably fine.
  assert.match(result.state.message, /may well be fine/);
  assert.equal(presentState(result.state).retryable, true);
});

test("a board PRESENT in an incomplete list still resolves normally", () => {
  // Incompleteness only matters when the board is missing. If it is there,
  // it is there.
  const result = resolveMappedJiraProject(input({ jiraProjectsComplete: false }));
  assert.equal(result.status, "ready");
  assert.equal(result.key, "ZC");
});

test("a complete list is still allowed to convict a missing board", () => {
  const result = resolveMappedJiraProject(
    input({ mappedJiraKey: "GONE", jiraProjectsComplete: true })
  );
  assert.equal(result.state.code, "JIRA_MAPPED_PROJECT_UNAVAILABLE");
});
