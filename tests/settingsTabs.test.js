import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SETTING_DEFINITIONS } from "../functions/_lib/app-settings.js";
import { formatSettingDate } from "../src/pages/settings/formatSettingDate.js";
import {
  CREDENTIAL_SECTIONS,
  DEFAULT_TAB_ID,
  SETTINGS_TABS,
  getTab,
  keysForTab,
  resolveTabId,
} from "../src/pages/settings/settingsCatalog.js";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const sidebarSource = fs.readFileSync(
  new URL("../src/components/dashboard/DashboardSidebar.jsx", import.meta.url),
  "utf8"
);
const stripeApiSource = fs.readFileSync(
  new URL("../functions/api/stripe-connect.js", import.meta.url),
  "utf8"
);

test("every admin_settings credential is reachable from exactly one tab", () => {
  // Reorganising the UI must not strand a setting: each key defined by the
  // settings service has to appear in one - and only one - tab.
  const owners = new Map();
  for (const tab of SETTINGS_TABS) {
    for (const key of keysForTab(tab)) {
      assert.ok(!owners.has(key), `${key} is claimed by both ${owners.get(key)} and ${tab.id}`);
      owners.set(key, tab.id);
    }
  }

  for (const definition of SETTING_DEFINITIONS) {
    assert.ok(owners.has(definition.key), `${definition.key} has no tab`);
  }
  assert.equal(owners.size, SETTING_DEFINITIONS.length);
});

test("every credential section is placed on a tab", () => {
  const placed = new Set(SETTINGS_TABS.flatMap((tab) => tab.sections || []));
  for (const section of CREDENTIAL_SECTIONS) {
    assert.ok(placed.has(section.id), `section ${section.id} is not on any tab`);
  }
});

test("the settings categories are not collapsed back into three tabs", () => {
  // The old layout was General / Stripe / DeepSeek. The point of the change is
  // that the General page's own categories are separated too.
  assert.ok(SETTINGS_TABS.length >= 4);
  const ids = SETTINGS_TABS.map((tab) => tab.id);
  // The first four are the original split and their order is load-bearing:
  // "seo-apis" is the default tab every unknown value falls back to. Jira was
  // appended as an optional integration panel; further integrations belong on
  // the end too, not interleaved.
  assert.deepEqual(ids.slice(0, 4), ["seo-apis", "google", "stripe", "deepseek"]);
  assert.deepEqual(ids, ["seo-apis", "google", "stripe", "deepseek", "jira"]);
});

test("the integration tabs render their existing panels rather than new storage", () => {
  const stripe = getTab("stripe");
  const deepseek = getTab("deepseek");
  const jira = getTab("jira");
  assert.equal(stripe.panel, "stripe");
  assert.equal(deepseek.panel, "deepseek");
  assert.equal(jira.panel, "jira");
  // An integration tab owns no admin_settings keys, so it cannot create a
  // second copy of a credential that already lives in its own table.
  assert.deepEqual(keysForTab(stripe), []);
  assert.deepEqual(keysForTab(deepseek), []);
  assert.deepEqual(keysForTab(jira), []);
});

test("unknown, legacy and empty tab values resolve to a real tab", () => {
  assert.equal(resolveTabId(undefined), DEFAULT_TAB_ID);
  assert.equal(resolveTabId(""), DEFAULT_TAB_ID);
  assert.equal(resolveTabId("does-not-exist"), DEFAULT_TAB_ID);
  // Names the previous layout used, and the ones the URLs suggest.
  assert.equal(resolveTabId("general"), "seo-apis");
  assert.equal(resolveTabId("api"), "seo-apis");
  assert.equal(resolveTabId("dataforseo"), "seo-apis");
  assert.equal(resolveTabId("oauth"), "google");
  assert.equal(resolveTabId("gsc"), "google");
  assert.equal(resolveTabId("payments"), "stripe");
  assert.equal(resolveTabId("ai"), "deepseek");
  assert.equal(resolveTabId("STRIPE"), "stripe");
});

test("the old settings URLs redirect to their tab instead of 404ing", () => {
  assert.match(appSource, /path="\/settings" element=\{<Navigate to="\/settings\/general"/);
  assert.match(appSource, /path="\/settings\/general" element=\{<SettingsPage \/>\}/);
  assert.match(appSource, /path="\/settings\/stripe" element=\{<LegacySettingsRedirect tab="stripe"/);
  assert.match(
    appSource,
    /path="\/settings\/deepseek" element=\{<LegacySettingsRedirect tab="deepseek"/
  );
});

test("the sidebar links one settings page, never per-category routes", () => {
  // The rule being pinned is that per-category settings ROUTES stay gone -
  // /settings/stripe, /settings/deepseek and the rest were collapsed into
  // tabs, and LegacySettingsRedirect exists to keep their bookmarks working.
  // A `?tab=` deep link is not a reintroduction of that: it is the same
  // route and the same component, with a tab preselected.
  const section = sidebarSource.slice(sidebarSource.indexOf('section: "Settings"'));
  const links = [...section.matchAll(/to: "(\/settings[^"]*)"/g)].map((match) => match[1]);

  for (const link of links) {
    const [path] = link.split("?");
    assert.equal(path, "/settings/general", `${link} must not be a separate settings route`);
  }
  assert.ok(links.includes("/settings/general"), "the settings page itself must stay linked");
});

test("the selected tab stays visually distinct from the unselected ones", () => {
  // Two global rules fight this component and both have bitten it already:
  //
  //  - bucket 1 of the application-wide button colour hierarchy paints any
  //    button with no bg-* utility solid brand red, border included, which
  //    turned every unselected tab into a red pill;
  //  - that bucket's hover rule scores (0,2,1), so an unscoped
  //    `.settings-tab:hover` loses to it and the tab reddens on hover.
  //
  // Scoping under `.settings-tabs` and stating background/border explicitly
  // is what keeps the selected tab readable, so it is pinned here.
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf(".settings-tabs {"));
  assert.ok(block.length, "settings tab styles are missing from index.css");

  assert.match(block, /\.settings-tabs \.settings-tab \{[^}]*background: transparent !important;/);
  assert.match(
    block,
    /\.settings-tabs \.settings-tab \{[^}]*border: 1px solid transparent !important;/
  );
  // Hover and selected must be parent-scoped to outrank the global bucket.
  assert.match(block, /\.settings-tabs \.settings-tab:hover:not\(:disabled\) \{/);
  assert.match(block, /\.settings-tabs \.settings-tab\[aria-selected="true"\]/);
  // Hovering the selected tab must not drop it back to the unselected look.
  assert.match(
    block,
    /\.settings-tabs \.settings-tab\[aria-selected="true"\]:hover:not\(:disabled\)/
  );

  const selected = /\.settings-tabs \.settings-tab\[aria-selected="true"\][^{]*\{([^}]*)\}/.exec(block);
  assert.ok(selected, "no selected-tab rule");
  assert.match(selected[1], /background: var\(--brand-blue\) !important/);
  assert.match(selected[1], /color: #ffffff !important/);
});

test("the settings page marks the active tab for assistive tech and CSS", () => {
  const page = fs.readFileSync(new URL("../src/pages/settings/SettingsPage.jsx", import.meta.url), "utf8");
  // The selected style keys off aria-selected, so the two cannot drift apart.
  assert.match(page, /aria-selected=\{isActive\}/);
  assert.match(page, /className="settings-tabs"/);
  assert.match(page, /className="settings-tab"/);
});

test("an updated_at timestamp renders as a date, never as raw machine output", () => {
  // mysql2 maps datetime columns to Date objects, so the settings service can
  // hand over either shape. The old formatter only handled the SQL string and
  // printed "Thu Sep 10 2026 12:24:56 GMT+0500 (Pakistan Standard Time)" in the
  // UI for the other one.
  const fromSql = formatSettingDate("2026-09-10 12:24:56");
  assert.match(fromSql, /10 Sept? 2026, \d{2}:\d{2}/);
  assert.doesNotMatch(fromSql, /GMT|Standard Time/);

  const fromDate = formatSettingDate(String(new Date("2026-09-10T12:24:56")));
  assert.match(fromDate, /10 Sept? 2026, \d{2}:\d{2}/);
  assert.doesNotMatch(fromDate, /GMT|Standard Time/);

  // Unusable input is hidden rather than dumped on screen.
  assert.equal(formatSettingDate(""), "");
  assert.equal(formatSettingDate(null), "");
  assert.equal(formatSettingDate("not a date"), "");
});

test("settings inputs carry a surface of their own, not an inherited one", () => {
  // This used to pin the opposite arrangement: the fields wore `bg-white/*`
  // utilities purely so the "FORM CONTROL SURFACES" compatibility rules would
  // recognise and repaint them, and a field that drifted off that recipe (an
  // earlier `bg-black/20`) rendered as an unstyled grey slab.
  //
  // `.settings-input` now states its own background, border and focus ring, so
  // the rule to protect is the reverse: the panels name the class, and the
  // class is a real control surface rather than a hook for something else.
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf("input.settings-input,"));
  assert.ok(block.length, "settings input styles are missing from index.css");
  assert.match(block, /background: var\(--surface\)/);
  assert.match(block, /border: 1px solid var\(--border\)/);
  assert.match(block, /input\.settings-input:focus/);

  for (const file of [
    "../src/pages/settings/panels/AppCredentialsPanel.jsx",
    "../src/pages/settings/panels/DeepSeekPanel.jsx",
  ]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /bg-black\//, `${file} uses an unstyled input surface`);
    assert.match(source, /className="settings-input"/, `${file} input is off-recipe`);
  }
});

test("the quiet actions are not painted as primary buttons", () => {
  // Bucket 1 of the button colour hierarchy paints any button with no bg-*
  // utility solid brand red, which made Reset look as loud as Save. The quiet
  // variant now says so by name, and `.settings-btn` restates its own colours
  // with !important - the only thing that beats that bucket.
  const source = fs.readFileSync(
    new URL("../src/pages/settings/panels/AppCredentialsPanel.jsx", import.meta.url),
    "utf8"
  );
  const reset = /onClick=\{reload\}[\s\S]{0,400}?className="([^"]+)"/.exec(source);
  assert.ok(reset, "no reset button found");
  assert.match(reset[1], /(^|\s)settings-btn(\s|$)/);
  assert.doesNotMatch(reset[1], /is-primary/, "Reset must not be the primary action");
  // Save is, so the two stay distinguishable.
  assert.match(source, /type="submit"[\s\S]{0,200}?className="settings-btn is-primary"/);

  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf(".settings-btn {"));
  assert.match(block, /\.settings-btn \{[^}]*background: var\(--surface\) !important;/);
  assert.match(block, /\.settings-btn\.is-primary \{[^}]*background: var\(--brand-red\) !important;/);
});

test("Stripe onboarding returns to the Stripe tab of the settings page", () => {
  assert.match(stripeApiSource, /\/settings\/general\?tab=stripe&stripe=return/);
  assert.match(stripeApiSource, /\/settings\/general\?tab=stripe&stripe=refresh/);
});
