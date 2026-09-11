import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessionToken } from "../../lib/authSession.js";

/**
 * Shared state for every `admin_settings`-backed settings tab.
 *
 * One instance is created by the Settings page and handed to whichever
 * credential tab is showing, so switching tabs neither refetches nor discards
 * edits that have not been saved yet.
 *
 * Secret values are never sent to the browser: the API reports only whether a
 * secret is configured plus a masked preview. Leaving a secret field blank
 * keeps the stored value; "Clear" removes it.
 */
export function useAppSettings() {
  const [settings, setSettings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [cleared, setCleared] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");

  const byKey = useMemo(() => {
    const map = new Map();
    settings.forEach((item) => map.set(item.key, item));
    return map;
  }, [settings]);

  const requestSettings = useCallback(async (options = {}) => {
    const token = getSessionToken();
    if (!token) throw new Error("Sign in with an administrator account to manage these settings.");

    const response = await fetch("/api/settings/general", {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      const failure = new Error(payload.error || "Failed to load general settings.");
      failure.fieldErrors = payload.errors || {};
      throw failure;
    }
    return payload;
  }, []);

  const applyPayload = useCallback((payload) => {
    const next = payload.settings || [];
    setSettings(next);
    // Non-secret values are editable in place; secrets always start blank.
    setDrafts(
      Object.fromEntries(next.map((item) => [item.key, item.secret ? "" : item.value || ""]))
    );
    setCleared({});
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setFieldErrors({});
    try {
      applyPayload(await requestSettings());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyPayload, requestSettings]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setDraft = useCallback((key, value) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  }, []);

  const setClearedKey = useCallback((key, value) => {
    setCleared((current) => ({ ...current, [key]: value }));
  }, []);

  /**
   * Saves only the keys the visible tab owns. Keys belonging to another tab are
   * left untouched, so a save can never overwrite a field the admin cannot see.
   */
  const save = useCallback(
    async (keys) => {
      const owned = new Set(keys);
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});

      try {
        const payload = await requestSettings({
          method: "POST",
          body: {
            settings: Object.fromEntries(
              Object.entries(drafts).filter(([key]) => owned.has(key))
            ),
            cleared: Object.keys(cleared).filter((key) => cleared[key] && owned.has(key)),
          },
        });
        applyPayload(payload);
        setSuccess("Settings saved. New values take effect immediately.");
      } catch (err) {
        setError(err.message);
        setFieldErrors(err.fieldErrors || {});
      } finally {
        setSaving(false);
      }
    },
    [applyPayload, cleared, drafts, requestSettings]
  );

  return {
    settings,
    byKey,
    drafts,
    cleared,
    loading,
    saving,
    error,
    fieldErrors,
    success,
    setDraft,
    setCleared: setClearedKey,
    reload,
    save,
  };
}
