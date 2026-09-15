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
  assert.deepEqual(ids, ["seo-apis", "google", "stripe", "deepseek"]);
});

test("the integration tabs render their existing panels rather than new storage", () => {
  const stripe = getTab("stripe");
  const deepseek = getTab("deepseek");
  assert.equal(stripe.panel, "stripe");
  assert.equal(deepseek.panel, "deepseek");
  // An integration tab owns no admin_settings keys, so it cannot create a
  // second copy of a credential that already lives in its own table.
  assert.deepEqual(keysForTab(stripe), []);
  assert.deepEqual(keysForTab(deepseek), []);
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

test("the sidebar offers one settings entry point", () => {
  const section = sidebarSource.slice(sidebarSource.indexOf('section: "Settings"'));
  const links = [...section.matchAll(/to: "(\/settings[^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(links, ["/settings/general"]);
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
  assert.match(page, /className="settings-tabs/);
  assert.match(page, /className="settings-tab /);
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

test("settings inputs use the recipe the form-control styles actually cover", () => {
  // "FORM CONTROL SURFACES" in index.css keys off bg-white/* and bg-ink-*.
  // bg-black/20 matches neither, so the fields rendered as grey slabs.
  for (const file of [
    "../src/pages/settings/panels/AppCredentialsPanel.jsx",
    "../src/pages/settings/panels/DeepSeekPanel.jsx",
  ]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /bg-black\//, `${file} uses an unstyled input surface`);
    assert.match(source, /settings-input[^"]*bg-white\//, `${file} input is off-recipe`);
  }
});

test("the quiet actions are not painted as primary buttons", () => {
  // Bucket 1 of the button colour hierarchy paints any button with no bg-*
  // utility solid brand red, which made Reset look as loud as Save.
  const source = fs.readFileSync(
    new URL("../src/pages/settings/panels/AppCredentialsPanel.jsx", import.meta.url),
    "utf8"
  );
  const reset = /onClick=\{reload\}[\s\S]{0,400}?className="([^"]+)"/.exec(source);
  assert.ok(reset, "no reset button found");
  assert.match(reset[1], /bg-white\//);
});

test("Stripe onboarding returns to the Stripe tab of the settings page", () => {
  assert.match(stripeApiSource, /\/settings\/general\?tab=stripe&stripe=return/);
  assert.match(stripeApiSource, /\/settings\/general\?tab=stripe&stripe=refresh/);
});
