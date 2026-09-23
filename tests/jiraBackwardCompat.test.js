import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Jira is an OPTIONAL integration. With it unconfigured, disconnected or
 * unreachable, every existing part of SEOX must behave exactly as it did
 * before.
 *
 * These tests assert that structurally, from the source, because the failure
 * mode they guard against is subtle: an import or an await added in the wrong
 * place would make a Jira outage visible on pages that have nothing to do
 * with Jira.
 */

test("the Jira status endpoint reports 'not connected' rather than erroring", async () => {
  // An unconfigured integration is a normal state, not a 404 and not a 500.
  // The UI has to be able to treat it as unremarkable.
  const source = readFileSync("functions/api/jira/status.js", "utf8");
  assert.ok(source.includes("connected: false"));
  assert.ok(
    source.includes("!connection ||"),
    "a missing connection row must produce the not-connected answer"
  );
});

test("Jira reads survive the migration not having been run", () => {
  // If migration.txt has not been applied the tables do not exist. Every read
  // must degrade to "not connected" instead of throwing ER_NO_SUCH_TABLE into
  // a page that also renders crawl data.
  const repository = readFileSync("functions/_lib/jira-repository.js", "utf8");
  const store = readFileSync("functions/_lib/jira-store.js", "utf8");

  for (const [name, source] of [["repository", repository], ["store", store]]) {
    assert.ok(source.includes("ER_NO_SUCH_TABLE"), `${name} must tolerate a missing table`);
    assert.ok(source.includes("function tolerant"), `${name} must wrap reads`);
  }

  // The application must never create its own tables - that is migration.txt's
  // job, and the user's decision.
  for (const source of [repository, store]) {
    assert.equal(/CREATE\s+TABLE/i.test(source), false, "the app must not create tables");
    assert.equal(/ALTER\s+TABLE/i.test(source), false, "the app must not alter tables");
    assert.equal(/DROP\s+TABLE/i.test(source), false, "the app must not drop tables");
  }
});

test("no pre-existing API handler gained a Jira dependency", () => {
  // Rule: no endpoint that existed before this work may call Jira on its
  // request path. One slow upstream call would otherwise make them all slow,
  // and take them down when Jira is down.
  const untouched = [
    "functions/api/projects.js",
    "functions/api/auditor.js",
    "functions/api/settings/general.js",
    "functions/api/settings/public.js",
    "functions/api/deepseek-settings.js",
    "functions/api/project-details.js",
    "functions/api/gbp/connect.js",
    "functions/api/gbp/jobs.js",
    "functions/api/tech-seo/speed.js",
    "functions/api/crawler/fetch.js",
  ];

  for (const file of untouched) {
    const source = readFileSync(file, "utf8");
    assert.equal(
      /jira/i.test(source),
      false,
      `${file} must not reference Jira - it is on the critical path of pages that work without it`
    );
  }
});

test("no pre-existing frontend page or context gained a Jira dependency", () => {
  const untouched = [
    "src/context/CrawlContext.jsx",
    "src/context/ProjectsContext.jsx",
    "src/context/AuthContext.jsx",
    "src/lib/projectDataStore.js",
    "src/lib/projectsApi.js",
    "src/lib/auditIssues.js",
    "src/pages/Dashboard.jsx",
    "src/pages/auditor/AuditorIssues.jsx",
  ];

  for (const file of untouched) {
    const source = readFileSync(file, "utf8");
    assert.equal(/jira/i.test(source), false, `${file} must not reference Jira`);
  }
});

test("the router declares the Jira Tickets route WITHOUT loading Jira eagerly", () => {
  // src/App.jsx used to be in the list above, on the rule that no
  // pre-existing file may depend on Jira. A page reachable from the sidebar
  // has to have a route, so the rule it is held to now is the one that
  // actually protects a Jira-less install: the route may be DECLARED here,
  // but nothing Jira may be imported statically. A static import would pull
  // the Jira client into the entry chunk every signed-in user downloads and
  // would run its module side effects on a page that never mentions Jira.
  const app = readFileSync("src/App.jsx", "utf8");

  assert.match(app, /path="\/jira\/tickets"/, "the Jira Tickets route should be declared");

  // Every static import in the file, i.e. `import ... from "..."` at the top
  // level. lazy(() => import("...")) is a dynamic import and is not matched.
  const staticImports = [...app.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(
    (match) => match[1]
  );
  for (const specifier of staticImports) {
    assert.equal(
      /jira/i.test(specifier),
      false,
      `src/App.jsx statically imports ${specifier}; the Jira page must stay lazy`
    );
  }

  // And it is loaded the same way every other page is.
  assert.match(app, /const JiraTickets = lazy\(\(\) => import\(["']\.\/pages\/jira\/JiraTickets\.jsx["']\)\)/);
});

test("the Jira ticket client never sends the SEOX session token", () => {
  // The ticket APIs authenticate on admin_token and refuse a session. A
  // client that reached for the session token would produce a confusing 400
  // rather than working, and would put the session token on a request that
  // has no use for it.
  const client = readFileSync("src/lib/jiraTicketsApi.js", "utf8");
  assert.equal(/getSessionToken|Authorization/i.test(client), false);
  assert.ok(client.includes("admin_token"));
});

test("the crawl and finding vocabulary was not forked", () => {
  // The Jira client-side helper imports the auditor's own slug functions
  // rather than reimplementing them, so client, server and crawler cannot
  // drift into three different ideas of what a finding type is.
  const findings = readFileSync("src/lib/jiraFindings.js", "utf8");
  assert.match(findings, /from ['"]\.\/auditIssues\.js['"]/);
  assert.ok(findings.includes("issueSlug"));

  // src/lib/auditIssues.js itself is untouched.
  const auditIssues = readFileSync("src/lib/auditIssues.js", "utf8");
  assert.equal(/jira/i.test(auditIssues), false);
});

test("the finding panel renders nothing when Jira is absent", () => {
  const panel = readFileSync("src/components/auditor/JiraIssuePanel.jsx", "utf8");
  // A user who has never set Jira up should not be able to tell the feature
  // exists from the auditor pages.
  assert.ok(
    panel.includes("if (!connected || !mapping || !finding") && panel.includes("return null"),
    "the panel must bail out to null, not render a disabled control"
  );
});

test("the Jira settings tab is additive and owns no admin_settings keys", async () => {
  const { SETTINGS_TABS, keysForTab, getTab, resolveTabId, DEFAULT_TAB_ID } = await import(
    "../src/pages/settings/settingsCatalog.js"
  );

  // The four original tabs are all still present and still first.
  const ids = SETTINGS_TABS.map((tab) => tab.id);
  assert.deepEqual(ids.slice(0, 4), ["seo-apis", "google", "stripe", "deepseek"]);
  assert.equal(DEFAULT_TAB_ID, "seo-apis", "the default landing tab must not move");

  // Jira stores nothing in admin_settings, so it cannot create a second copy
  // of a credential that already lives elsewhere.
  assert.deepEqual(keysForTab(getTab("jira")), []);

  // Unknown values still fall back to the original default, not to Jira.
  assert.equal(resolveTabId("nonsense"), "seo-apis");
  assert.equal(resolveTabId(undefined), "seo-apis");
});

test("adding Jira did not change how any existing setting is stored", async () => {
  const { SETTING_DEFINITIONS } = await import("../functions/_lib/app-settings.js");
  const keys = SETTING_DEFINITIONS.map((definition) => definition.key);

  // No Jira key was added to the application-wide credential store: Jira is
  // per user and per project, so it has its own table.
  assert.equal(
    keys.some((key) => key.includes("jira")),
    false
  );

  // The pre-existing definitions are all still there.
  for (const expected of [
    "pagespeed_api_key",
    "bing_webmaster_api_key",
    "dataforseo_login",
    "dataforseo_password",
    "google_client_id",
    "google_client_secret",
  ]) {
    assert.ok(keys.includes(expected), `${expected} disappeared from admin_settings`);
  }
});

test("the shared crypto refactor kept every existing caller working", async () => {
  // gbp-crypto.js changed shape; wpscan-token.js imports from it and the GBP
  // client depends on it. Both must still get the same three functions.
  const gbp = await import("../functions/_lib/gbp-crypto.js");
  assert.deepEqual(
    Object.keys(gbp).sort(),
    ["decryptSecret", "encryptSecret", "encryptionKeyConfigured"]
  );

  const wpscan = readFileSync("functions/_lib/wpscan-token.js", "utf8");
  assert.ok(
    wpscan.includes("from './gbp-crypto.js'"),
    "wpscan-token.js should keep importing the same module"
  );
});

test("the Jira rate-limit buckets were added without disturbing the existing ones", async () => {
  const { LIMITS } = await import("../functions/_lib/rate-limit.js");

  for (const bucket of [
    "gbp:sync-reviews",
    "gbp:run-audit",
    "wpscan:scan",
    "wp-portal:scan",
    "ai:generate",
  ]) {
    assert.ok(LIMITS[bucket], `${bucket} must still exist`);
  }

  for (const bucket of [
    "jira:connect",
    "jira:test",
    "jira:create",
    "jira:sync",
    "jira:metadata",
    "jira:webhook",
  ]) {
    assert.ok(LIMITS[bucket], `${bucket} should be registered`);
    assert.ok(LIMITS[bucket].limit > 0 && LIMITS[bucket].windowSeconds > 0);
  }

  // Jira AI reuses the existing bucket rather than adding a parallel one.
  assert.equal(LIMITS["jira:ai"], undefined);
});

test("the AI path reuses the existing DeepSeek infrastructure", () => {
  const jiraAi = readFileSync("functions/_lib/jira-ai.js", "utf8");

  // One key resolver for the whole product, not a Jira-specific copy.
  assert.ok(jiraAi.includes("resolveDeepSeekApiKey"));
  assert.ok(jiraAi.includes("from './deepseek-key.js'"));

  // And it must never be able to fail a create.
  assert.ok(
    jiraAi.includes("return { fields: null"),
    "AI must degrade to null rather than throwing"
  );

  const issues = readFileSync("functions/api/jira/issues.js", "utf8");
  assert.ok(issues.includes("'ai:generate'"), "Jira AI should spend the shared AI budget");
});

test("no Redux or new state library was introduced", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const forbidden of ["redux", "@reduxjs/toolkit", "zustand", "jotai", "mobx", "recoil"]) {
    assert.equal(dependencies[forbidden], undefined, `${forbidden} must not be added`);
  }

  // Jira client state goes through the existing project data store.
  const hook = readFileSync("src/hooks/useJira.js", "utf8");
  assert.ok(hook.includes("useProjectData"));
});

test("no new runtime dependency was added for Jira", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const names = Object.keys(pkg.dependencies);

  // No Jira SDK, no HTTP client library - fetch plus the existing helpers is
  // enough for the handful of endpoints used.
  for (const name of names) {
    assert.equal(/jira|atlassian|axios|got|node-fetch/i.test(name), false, `${name} was added`);
  }
});
