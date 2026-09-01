import { useState } from "react";
import {
  BarChart3,
  Crown,
  Heart,
  Calendar,
  TrendingUp,
  DollarSign,
  Search,
  RefreshCw,
  Star,
  ArrowUpDown,
} from "lucide-react";
import { formatCurrency, formatNumber, useAdminData } from "../../hooks/useAdminData.js";

const avatarColors = ["#fb923c", "#8b5cf6", "#3b82f6", "#22c55e", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];

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

export default function AdminAnalytics() {
  const [search, setSearch] = useState("");
  const { users, stats, loading, error, refresh } = useAdminData();

  const enterpriseUsers = users
    .filter((user) => user.level === "enterprise")
    .map((user) => ({
      ...user,
      membershipType: user.geo ? "GEO" : "Standard",
      value: user.tenure === "lifetime" ? 5000 : 2000,
    }));

  const filtered = enterpriseUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-brand-400" />
            Enterprise Analytics
          </h1>
          <p className="mt-1 text-sm text-white/45">Enterprise user insights & lifetime income tracking</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Crown} value={formatNumber(stats.enterpriseUsers)} label="Total Enterprise" color="#fb923c" iconBg="rgba(251,146,60,0.15)" />
        <StatCard icon={Heart} value={formatNumber(stats.lifetimeEnterprise)} label="Lifetime Enterprise" color="#22c55e" iconBg="rgba(34,197,94,0.15)" />
        <StatCard icon={Calendar} value={formatNumber(stats.monthlyEnterprise)} label="Monthly Enterprise" color="#3b82f6" iconBg="rgba(59,130,246,0.15)" />
        <StatCard icon={TrendingUp} value={`${stats.conversionRate.toFixed(1)}%`} label="Conversion Rate" color="#8b5cf6" iconBg="rgba(139,92,246,0.15)" />
        <StatCard icon={DollarSign} value={formatCurrency(stats.lifetimeIncome)} label="Lifetime Income" color="#fbbf24" iconBg="rgba(251,191,36,0.15)" />
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 mb-6">
        <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-1">
          <Crown className="h-4 w-4 text-amber-400" />
          Lifetime Income Breakdown
        </h3>
        <p className="text-[11px] text-white/35 mb-5 ml-6">Enterprise Lifetime Deal valuation</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center rounded-xl border border-white/10 p-5">
            <div className="text-[11px] text-white/40 mb-2">Lifetime Enterprise Users</div>
            <div className="font-display text-3xl font-bold">{formatNumber(stats.lifetimeEnterprise)}</div>
          </div>
          <div className="text-center rounded-xl border border-white/10 p-5">
            <div className="text-[11px] text-white/40 mb-2">Value per User</div>
            <div className="font-display text-3xl font-bold">Rs 5,000</div>
          </div>
          <div className="text-center rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 p-5">
            <div className="text-[11px] text-white/80 mb-2">Total Lifetime Income</div>
            <div className="font-display text-3xl font-bold">{formatCurrency(stats.lifetimeIncome)}</div>
            <div className="text-[10px] text-white/60 mt-1">{formatNumber(stats.lifetimeEnterprise)} users x Rs 5,000</div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-display text-base font-bold flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-amber-400" />
          Enterprise Users ({formatNumber(stats.enterpriseUsers)})
        </h3>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 mb-4 max-w-md focus-within:border-brand-500/40 transition">
          <Search className="h-4 w-4 text-white/30 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search enterprise users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-sm text-white placeholder:text-white/30"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-5 py-3">
                  <span className="flex items-center gap-1">User <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">
                  <span className="flex items-center gap-1">Tenure <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Membership Type</th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Value</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">
                  <span className="flex items-center gap-1">Joined <ArrowUpDown className="h-3 w-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-white/40">Loading enterprise users...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-white/40">No enterprise users found</td>
                </tr>
              )}
              {!loading && filtered.map((user, i) => (
                <tr key={user.id || user.email} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: avatarColors[i % avatarColors.length] }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-white">{user.name}</div>
                        <div className="text-[11px] text-white/35">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white ${
                      user.tenure === "lifetime" ? "bg-gradient-to-r from-amber-500 to-brand-500" : "bg-blue-500/20 text-blue-300"
                    }`}>
                      <Star className="h-2.5 w-2.5" />
                      {user.tenure === "lifetime" ? "Lifetime" : user.tenure || "Monthly"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-red-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      <Crown className="h-2.5 w-2.5" />
                      {user.membershipType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-display font-semibold text-white/80">
                    {user.value.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-white/45">{user.joined || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
