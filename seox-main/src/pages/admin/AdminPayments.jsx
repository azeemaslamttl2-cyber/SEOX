import { useState } from "react";
import {
  CreditCard,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Inbox,
} from "lucide-react";
import { useAdminData } from "../../hooks/useAdminData.js";

/* ================================================================
   Main AdminPayments Page
   ================================================================ */
export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState("pending");
  const { payments, loading, error, refresh } = useAdminData();

  const tabs = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const approvedCount = payments.filter((p) => p.status === "approved").length;
  const rejectedCount = payments.filter((p) => p.status === "rejected").length;

  const filtered = payments.filter((p) => {
    if (activeTab === "all") return true;
    return p.status === activeTab;
  });

  return (
    <section>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-brand-400" />
            Payment Requests
          </h1>
          <p className="mt-1 text-sm text-white/45">Review and approve upgrade payments</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 w-fit mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-brand-500 to-amber-500 text-white shadow-brand-glow"
                : "text-white/50 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-2xl">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
          <div className="font-display text-3xl font-bold text-amber-400">{pendingCount}</div>
          <div className="mt-1 text-sm font-medium text-amber-300/70">Pending</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
          <div className="font-display text-3xl font-bold text-emerald-400">{approvedCount}</div>
          <div className="mt-1 text-sm font-medium text-emerald-300/70">Approved</div>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5">
          <div className="font-display text-3xl font-bold text-red-400">{rejectedCount}</div>
          <div className="mt-1 text-sm font-medium text-red-300/70">Rejected</div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-white/40">Loading payment requests...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] mb-4">
            <Inbox className="h-7 w-7 text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/50">No payment requests found</p>
          <p className="mt-1 max-w-xs text-xs text-white/30">
            Payment requests from users upgrading their plans will appear here
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-5 py-3">User</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Plan</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Amount</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Date</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Status</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((payment) => (
                <tr key={payment.id || `${payment.email}-${payment.date}`} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 text-[13px] text-white/80">{payment.user}</td>
                  <td className="px-4 py-3.5 text-[13px] text-white/60">{payment.plan}</td>
                  <td className="px-4 py-3.5 text-[13px] font-semibold text-white/80">{payment.amount}</td>
                  <td className="px-4 py-3.5 text-[12px] text-white/45">{payment.date}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      payment.status === "pending" ? "bg-amber-500/15 text-amber-300" :
                      payment.status === "approved" ? "bg-emerald-500/15 text-emerald-300" :
                      "bg-red-500/15 text-red-300"
                    }`}>
                      {payment.status === "pending" && <Clock className="h-3 w-3" />}
                      {payment.status === "approved" && <CheckCircle className="h-3 w-3" />}
                      {payment.status === "rejected" && <XCircle className="h-3 w-3" />}
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-red-400">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
