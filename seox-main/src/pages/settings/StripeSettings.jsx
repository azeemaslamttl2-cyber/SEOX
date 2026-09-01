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
} from "lucide-react";
import { auth } from "../../lib/firebase.js";

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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
        <AlertCircle className="h-3.5 w-3.5" />
        Action needed
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-white/45"}`}>
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {ready ? "Connected" : "Not connected"}
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, accent = "text-brand-400" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/35">
        <Icon className={`h-4 w-4 ${accent}`} />
        {label}
      </div>
      <div className="mt-3 truncate font-display text-lg font-bold text-white">{value || "-"}</div>
    </div>
  );
}

export default function StripeSettings() {
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
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in before opening Stripe settings.");

    const token = await user.getIdToken();
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
    <section className="mx-auto max-w-6xl pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Stripe Settings
          </h1>
          <p className="mt-1 text-sm text-white/45">Connect payouts and billing through Stripe.</p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading || Boolean(busy)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {returnMessage && (
        <div className="mt-5 rounded-2xl border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
          {returnMessage}
        </div>
      )}
      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-brand-500/[0.04]">
        <div className="flex flex-col gap-5 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold text-white">Stripe Connect</h2>
                <StatusPill ready={ready} pending={pending} />
              </div>
              <p className="mt-1 text-xs text-white/40">
                {status.accountId ? status.accountId : "No Stripe account linked"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={startOnboarding}
              disabled={loading || Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {status.connected ? "Continue onboarding" : "Connect Stripe"}
            </button>
            <button
              onClick={openDashboard}
              disabled={!status.accountId || loading || Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy === "dashboard" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          <InfoTile icon={ShieldCheck} label="Onboarding" value={loading ? "Loading..." : status.detailsSubmitted ? "Complete" : "Incomplete"} accent={status.detailsSubmitted ? "text-emerald-400" : "text-amber-400"} />
          <InfoTile icon={Wallet} label="Payouts" value={loading ? "Loading..." : status.payoutsEnabled ? "Enabled" : "Disabled"} accent={status.payoutsEnabled ? "text-emerald-400" : "text-amber-400"} />
          <InfoTile icon={CreditCard} label="Charges" value={loading ? "Loading..." : status.chargesEnabled ? "Enabled" : "Disabled"} accent={status.chargesEnabled ? "text-emerald-400" : "text-amber-400"} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="font-display text-sm font-bold text-white">Account</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <span className="text-white/40">Email</span>
              <span className="truncate text-white/75">{status.email || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <span className="text-white/40">Country</span>
              <span className="text-white/75">{status.country || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/40">Business type</span>
              <span className="text-white/75">{status.businessType || "-"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="font-display text-sm font-bold text-white">Requirements</h3>
          <div className="mt-4">
            {status.requirementsDue.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {status.requirementsDue.map((item) => (
                  <span key={item} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/45">No pending requirements</p>
            )}
            {status.disabledReason && (
              <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {status.disabledReason}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
