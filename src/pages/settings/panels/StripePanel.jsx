import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Building,
  Check,
} from "lucide-react";
import { getSessionToken } from '../../../lib/authSession.js';

/**
 * Stripe Connect panel, shown by the Settings page under the "Stripe & Payments"
 * tab. It is the original Stripe Settings screen: the same `/api/stripe-connect`
 * calls, the same `stripe_connections` records and the same onboarding flow.
 *
 * It used to carry its own hard-coded slate/emerald palette, which is why it
 * looked like a different product from the panels beside it. It now uses the
 * shared `.settings-*` vocabulary in index.css like the rest of Settings.
 */

const emptyStatus = {
  connected: false,
  accountId: "",
  detailsSubmitted: false,
  payoutsEnabled: false,
  chargesEnabled: false,
  requirementsDue: [],
  disabledReason: "",
  email: "",
  country: "",
};

function StatusPill({ ready, pending }) {
  if (pending) {
    return (
      <span className="settings-pill has-icon" data-tone="warning">
        <AlertCircle aria-hidden="true" />
        Action needed
      </span>
    );
  }

  if (ready) {
    return (
      <span className="settings-pill has-icon" data-tone="success">
        <CheckCircle2 aria-hidden="true" />
        Connected
      </span>
    );
  }

  return (
    <span className="settings-pill has-icon">
      <AlertCircle aria-hidden="true" />
      Not connected
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, state = "default" }) {
  return (
    <div className="settings-stat" data-tone={state === "default" ? undefined : state}>
      <div className="settings-stat-label">
        <Icon aria-hidden="true" />
        {label}
      </div>
      <div className="settings-stat-value">{value || "-"}</div>
    </div>
  );
}

export default function StripePanel() {
  const [status, setStatus] = useState(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const ready = status.connected && status.detailsSubmitted && status.payoutsEnabled;
  const pending = status.connected && (!status.detailsSubmitted || status.requirementsDue.length > 0 || Boolean(status.disabledReason));

  const returnMessage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "return") return "Stripe onboarding returned. Status refreshed.";
    if (params.get("stripe") === "refresh") return "Stripe link expired. Create a fresh onboarding link.";
    return "";
  }, []);

  const requestStripe = useCallback(async (options = {}) => {
    const token = getSessionToken();
    if (!token) throw new Error("Sign in before opening Stripe settings.");
    const response = await fetch("/api/stripe-connect", {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Stripe request failed.");
    }

    return payload;
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await requestStripe();
      setStatus({ ...emptyStatus, ...payload });
    } catch (err) {
      setStatus(emptyStatus);
      setError(err.message || "Failed to load Stripe status.");
    } finally {
      setLoading(false);
    }
  }, [requestStripe]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function startOnboarding() {
    setBusy("connect");
    setError("");

    try {
      const payload = await requestStripe({
        method: "POST",
        body: JSON.stringify({ action: "connect" }),
      });
      window.location.assign(payload.url);
    } catch (err) {
      setError(err.message || "Failed to create Stripe onboarding link.");
      setBusy("");
    }
  }

  async function openDashboard() {
    setBusy("dashboard");
    setError("");

    try {
      const payload = await requestStripe({
        method: "POST",
        body: JSON.stringify({ action: "dashboard" }),
      });
      window.location.assign(payload.url);
    } catch (err) {
      setError(err.message || "Failed to open Stripe Dashboard.");
      setBusy("");
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-actions is-end">
        <button
          onClick={loadStatus}
          disabled={loading || Boolean(busy)}
          className="settings-btn is-small"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh Status
        </button>
      </div>

      {/* Return Notification */}
      {returnMessage && (
        <p className="settings-banner" data-tone="info">
          <CheckCircle2 aria-hidden="true" />
          <span>{returnMessage}</span>
        </p>
      )}

      {/* Error Alert */}
      {error && (
        <p className="settings-banner" data-tone="error">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Main Stripe Connect Card */}
      <section className="settings-card">
        <div className="settings-card-head">
          <span className="settings-card-icon" data-tone="brand" aria-hidden="true">
            <CreditCard />
          </span>
          <div className="settings-card-titles">
            <h2>
              Stripe Connect
              <StatusPill ready={ready} pending={pending} />
            </h2>
            <p className="settings-mono">
              {status.accountId ? status.accountId : "No Stripe account linked"}
            </p>
          </div>

          <div className="settings-card-aside">
            <button
              onClick={startOnboarding}
              disabled={loading || Boolean(busy)}
              className="settings-btn is-primary"
            >
              {busy === "connect" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink aria-hidden="true" />
              )}
              {status.connected ? "Continue Onboarding" : "Connect Stripe"}
            </button>
            <button
              onClick={openDashboard}
              disabled={!status.accountId || loading || Boolean(busy)}
              className="settings-btn"
            >
              {busy === "dashboard" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink aria-hidden="true" />
              )}
              Open Dashboard
            </button>
          </div>
        </div>

        {/* 3 Status / Info Tiles */}
        <div className="settings-card-body">
          <div className="settings-stats">
            <InfoTile
              icon={ShieldCheck}
              label="Onboarding"
              value={loading ? "Checking..." : status.detailsSubmitted ? "Complete" : "Incomplete"}
              state={status.detailsSubmitted ? "success" : "warning"}
            />
            <InfoTile
              icon={Wallet}
              label="Payouts"
              value={loading ? "Checking..." : status.payoutsEnabled ? "Enabled" : "Disabled"}
              state={status.payoutsEnabled ? "success" : "warning"}
            />
            <InfoTile
              icon={CreditCard}
              label="Charges"
              value={loading ? "Checking..." : status.chargesEnabled ? "Enabled" : "Disabled"}
              state={status.chargesEnabled ? "success" : "warning"}
            />
          </div>
        </div>
      </section>

      {/* Details Grid */}
      <div className="settings-grid">
        {/* Account Details */}
        <section className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon" data-tone="navy" aria-hidden="true">
              <Building />
            </span>
            <div className="settings-card-titles">
              <h3>Account Overview</h3>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="settings-rows">
              <div className="settings-row">
                <span className="settings-row-key">Email</span>
                <span className="settings-row-value">{status.email || "—"}</span>
              </div>
              <div className="settings-row">
                <span className="settings-row-key">Country</span>
                <span className="settings-row-value">{status.country || "—"}</span>
              </div>
              <div className="settings-row">
                <span className="settings-row-key">Business Type</span>
                <span className="settings-row-value capitalize">{status.businessType || "—"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Requirements & Compliance */}
        <section className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon" data-tone="navy" aria-hidden="true">
              <ShieldCheck />
            </span>
            <div className="settings-card-titles">
              <h3>Requirements &amp; Status</h3>
            </div>
          </div>
          <div className="settings-card-body">
            {status.requirementsDue.length > 0 ? (
              <div className="settings-field">
                <p className="settings-sublabel">Pending action required on:</p>
                <div className="settings-tags">
                  {status.requirementsDue.map((item) => (
                    <span key={item} className="settings-tag">
                      <AlertCircle aria-hidden="true" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="settings-banner" data-tone="success">
                <Check aria-hidden="true" />
                <span>All verification requirements are satisfied. No pending actions.</span>
              </p>
            )}

            {status.disabledReason && (
              <p className="settings-banner" data-tone="error">
                <AlertCircle aria-hidden="true" />
                <span>{status.disabledReason}</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
