import { useSearchParams } from "react-router-dom";
import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import { SETTINGS_TABS, getTab, keysForTab, resolveTabId } from "./settingsCatalog.js";
import { useAppSettings } from "./useAppSettings.js";
import AppCredentialsPanel from "./panels/AppCredentialsPanel.jsx";
import StripePanel from "./panels/StripePanel.jsx";
import DeepSeekPanel from "./panels/DeepSeekPanel.jsx";
import JiraPanel from "./panels/JiraPanel.jsx";

const PANELS = {
  stripe: StripePanel,
  deepseek: DeepSeekPanel,
  jira: JiraPanel,
};

/**
 * The one settings screen: `/settings/general?tab=<id>`.
 *
 * Each tab shows an existing settings UI unchanged and keeps talking to the API
 * and the storage it already used, so nothing is duplicated:
 *
 *   SEO APIs / Google -> /api/settings/general  -> admin_settings
 *   Stripe & Payments -> /api/stripe-connect    -> stripe_connections
 *   DeepSeek AI       -> /api/deepseek-settings -> deepseek_api_settings
 *   Jira              -> /api/jira/*            -> jira_connections
 *
 * The active tab lives in the query string, so a tab can be linked to directly
 * and survives a refresh.
 *
 * Presentation is carried by the `.settings-*` rules in index.css — one
 * vocabulary shared by all four panels, on the same token surfaces as the
 * dashboard.
 */
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = resolveTabId(searchParams.get("tab"));
  const activeTab = getTab(activeId);

  // One shared load/save cycle for every admin_settings-backed tab: moving
  // between the SEO APIs and Google tabs neither refetches nor drops edits.
  const credentials = useAppSettings();

  function selectTab(id) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  }

  const Panel = activeTab.panel ? PANELS[activeTab.panel] : null;

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <span className="settings-hero-icon" aria-hidden="true">
          <SlidersHorizontal />
        </span>
        <div className="settings-hero-copy">
          <p className="settings-hero-eyebrow">
            <ShieldCheck aria-hidden="true" />
            Administrator
          </p>
          <h1>General Settings</h1>
          <p className="settings-hero-sub">
            Every application setting in one place. Credentials are stored on the server and read by
            the integrations that need them; secrets are never sent back to the browser.
          </p>
        </div>
      </header>

      {/* Selected/unselected styling lives in `.settings-tab` in index.css, not
          in utility classes: the legacy dark-utility compatibility layer
          rewrites `text-white*` and `border-white*` with !important, which
          flattened the two states into near-identical greys. */}
      <div role="tablist" aria-label="Settings categories" className="settings-tabs">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className="settings-tab"
            >
              <Icon aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${activeId}`}
        aria-labelledby={`settings-tab-${activeId}`}
        className="settings-panel"
      >
        <p className="settings-lede">{activeTab.description}</p>

        {Panel ? (
          <Panel />
        ) : (
          <AppCredentialsPanel
            sectionIds={activeTab.sections}
            keys={keysForTab(activeTab)}
            state={credentials}
          />
        )}
      </div>
    </div>
  );
}
