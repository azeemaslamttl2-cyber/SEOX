import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { auth } from "../../lib/firebase.js";
import { formatNumber } from "../../hooks/useAdminData.js";

function StatCard({ icon: Icon, value, label, color, iconBg }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-all duration-300 hover:border-brand-500/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(249,115,22,0.2)]">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg mb-2" style={{ background: iconBg }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

function StatusBadge({ account }) {
  const needsAction = account.requirementsDue?.length > 0 || account.disabledReason;
  const ready = account.detailsSubmitted && account.payoutsEnabled;

  if (needsAction) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
        <AlertCircle className="h-3 w-3" />
        Action needed
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ready ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-white/50"}`}>
      {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {ready ? "Ready" : "Incomplete"}
    </span>
  );
}

export default function AdminStripe() {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, complete: 0, actionNeeded: 0, payoutsEnabled: 0 });
  const [loading, setLoading] = useState(true);
  const [busyAccount, setBusyAccount] = useState("");
  const [busyConnect, setBusyConnect] = useState(false);
  const [error, setError] = useState("");

  const requestAdminStripe = useCallback(async (options = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in before opening Stripe Management.");

    const token = await user.getIdToken();
    const response = await fetch("/api/admin-stripe", {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load Stripe management data.");
    }

    return payload;
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await requestAdminStripe();
      setAccounts(payload.accounts || []);
      setSummary({ total: 0, complete: 0, actionNeeded: 0, payoutsEnabled: 0, ...(payload.summary || {}) });
    } catch (err) {
      setAccounts([]);
      setError(err.message || "Failed to load Stripe accounts.");
    } finally {
      setLoading(false);
    }
  }, [requestAdminStripe]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  async function openDashboard(accountId) {
    setBusyAccount(accountId);
    setError("");

    try {
      const payload = await requestAdminStripe({
        method: "POST",
        body: JSON.stringify({ action: "dashboard", accountId }),
      });
      window.location.assign(payload.url);
    } catch (err) {
      setError(err.message || "Failed to open Stripe dashboard.");
      setBusyAccount("");
    }
  }

  async function connectStripe() {
    setBusyConnect(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in before connecting Stripe.");

      const token = await user.getIdToken();
      const response = await fetch("/api/stripe-connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "connect" }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create Stripe onboarding link.");
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err.message || "Failed to connect Stripe.");
      setBusyConnect(false);
    }
  }

  return (
    <section>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-brand-400" />
            Stripe Management
          </h1>
          <p className="mt-1 text-sm text-white/45">Monitor connected Stripe accounts and payout readiness</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={connectStripe}
            disabled={busyConnect}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-brand-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyConnect ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
            Connect Stripe
          </button>
          <button onClick={loadAccounts} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/[0.10] via-white/[0.03] to-amber-500/[0.06] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">Connect Stripe and enter payout details</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/45">
                Click Connect Stripe to open Stripe's secure onboarding page. Bank, business, tax, and identity details are entered in Stripe, not stored in this admin panel.
              </p>
            </div>
          </div>
          <button
            onClick={connectStripe}
            disabled={busyConnect}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyConnect ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Start Stripe onboarding
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={CreditCard} value={formatNumber(summary.total)} label="Connected" color="#fb923c" iconBg="rgba(251,146,60,0.15)" />
        <StatCard icon={CheckCircle2} value={formatNumber(summary.complete)} label="Ready" color="#22c55e" iconBg="rgba(34,197,94,0.15)" />
        <StatCard icon={Wallet} value={formatNumber(summary.payoutsEnabled)} label="Payouts Enabled" color="#3b82f6" iconBg="rgba(59,130,246,0.15)" />
        <StatCard icon={AlertCircle} value={formatNumber(summary.actionNeeded)} label="Action Needed" color="#f59e0b" iconBg="rgba(245,158,11,0.15)" />
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-5 py-3">Account</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Stripe ID</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Status</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Payouts</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Charges</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-white/40">Loading Stripe accounts...</td>
              </tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-white/40">
                  No Stripe accounts connected yet
                </td>
              </tr>
            )}
            {!loading && accounts.map((account) => (
              <tr key={account.accountId || account.uid} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5">
                  <div className="text-[13px] font-semibold text-white">{account.name || "Unnamed account"}</div>
                  <div className="text-[11px] text-white/35">{account.email || account.uid}</div>
                </td>
                <td className="px-4 py-3.5 text-[12px] text-white/50">{account.accountId || "-"}</td>
                <td className="px-4 py-3.5"><StatusBadge account={account} /></td>
                <td className="px-4 py-3.5 text-[12px] text-white/50">{account.payoutsEnabled ? "Enabled" : "Disabled"}</td>
                <td className="px-4 py-3.5 text-[12px] text-white/50">{account.chargesEnabled ? "Enabled" : "Disabled"}</td>
                <td className="px-4 py-3.5">
                  <button
                    onClick={() => openDashboard(account.accountId)}
                    disabled={!account.accountId || Boolean(busyAccount)}
                    className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-45"
                  >
                    {busyAccount === account.accountId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
