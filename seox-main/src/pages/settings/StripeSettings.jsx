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
import { getSessionToken } from '../../lib/authSession.js';

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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700 shadow-sm">
        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        Action needed
      </span>
    );
  }

  if (ready) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        Connected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
      <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
      Not connected
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, state = "default" }) {
  const stateStyles = {
    success: "text-emerald-700 bg-emerald-50/60 border-emerald-100",
    warning: "text-amber-700 bg-amber-50/60 border-amber-100",
    default: "text-slate-800 bg-slate-50/80 border-slate-100",
  };

  const currentStyle = stateStyles[state] || stateStyles.default;

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${currentStyle}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Icon className="h-4 w-4 text-brand-500" />
        {label}
      </div>
      <div className="mt-2 truncate font-display text-base font-bold text-slate-800">
        {value || "-"}
      </div>
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
    <div className="stripe-settings-workspace w-full space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Stripe Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect payouts, manage payment credentials, and check Stripe account status.
          </p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading || Boolean(busy)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-brand-500" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* Return Notification */}
      {returnMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <span>{returnMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Stripe Connect Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(45,43,111,0.06)]">
        <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 border border-brand-100 flex-shrink-0">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-slate-900">Stripe Connect</h2>
                <StatusPill ready={ready} pending={pending} />
              </div>
              <p className="mt-1 text-xs font-mono text-slate-500">
                {status.accountId ? status.accountId : "No Stripe account linked"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={startOnboarding}
              disabled={loading || Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-brand-glow transition hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {status.connected ? "Continue Onboarding" : "Connect Stripe"}
            </button>
            <button
              onClick={openDashboard}
              disabled={!status.accountId || loading || Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "dashboard" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open Dashboard
            </button>
          </div>
        </div>

        {/* 3 Status / Info Tiles */}
        <div className="grid grid-cols-1 gap-3.5 pt-6 sm:grid-cols-3">
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

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(45,43,111,0.06)]">
          <div className="flex items-center gap-2.5 mb-4">
            <Building className="h-4 w-4 text-brand-500" />
            <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
              Account Overview
            </h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-500">Email</span>
              <span className="truncate font-medium text-slate-800">{status.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-500">Country</span>
              <span className="font-medium text-slate-800">{status.country || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-xs font-semibold text-slate-500">Business Type</span>
              <span className="font-medium text-slate-800 capitalize">{status.businessType || "—"}</span>
            </div>
          </div>
        </div>

        {/* Requirements & Compliance */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(45,43,111,0.06)]">
          <div className="flex items-center gap-2.5 mb-4">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider">
              Requirements & Status
            </h3>
          </div>
          <div>
            {status.requirementsDue.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-700 font-medium">Pending action required on:</p>
                <div className="flex flex-wrap gap-2">
                  {status.requirementsDue.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 p-3.5 text-xs font-semibold text-emerald-800">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>All verification requirements are satisfied. No pending actions.</span>
              </div>
            )}

            {status.disabledReason && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{status.disabledReason}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
