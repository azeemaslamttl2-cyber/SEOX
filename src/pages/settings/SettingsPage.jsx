import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { SETTINGS_TABS, getTab, keysForTab, resolveTabId } from "./settingsCatalog.js";
import { useAppSettings } from "./useAppSettings.js";
import AppCredentialsPanel from "./panels/AppCredentialsPanel.jsx";
import StripePanel from "./panels/StripePanel.jsx";
import DeepSeekPanel from "./panels/DeepSeekPanel.jsx";

const PANELS = {
  stripe: StripePanel,
  deepseek: DeepSeekPanel,
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
 *
 * The active tab lives in the query string, so a tab can be linked to directly
 * and survives a refresh.
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
    <div className="space-y-6 pb-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Administrator
        </div>
        <h1 className="mt-3 font-display text-3xl font-black text-white">General Settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/45">
          Every application setting in one place. Credentials are stored on the server and read by
          the integrations that need them; secrets are never sent back to the browser.
        </p>
      </div>

      {/* Selected/unselected styling lives in `.settings-tab` in index.css, not
          in utility classes: the legacy dark-utility compatibility layer
          rewrites `text-white*` and `border-white*` with !important, which
          flattened the two states into near-identical greys. */}
      <div
        role="tablist"
        aria-label="Settings categories"
        className="settings-tabs flex flex-wrap items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5"
      >
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
              className="settings-tab flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 transition"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${activeId}`}
        aria-labelledby={`settings-tab-${activeId}`}
      >
        <p className="mb-5 max-w-3xl text-sm text-white/45">{activeTab.description}</p>

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
