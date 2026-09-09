import { useState } from "react";
import {
  Users,
  UserCheck,
  Star,
  Crown,
  ShieldAlert,
  Search,
  RefreshCw,
  Pencil,
  MessageCircle,
  Pin,
  Bolt,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react";
import { formatNumber, useAdminData } from "../../hooks/useAdminData.js";
import { normalizeTier } from "../../lib/tiers.js";

const avatarColors = ["#2d2b6f", "#4197cb", "#ffc600", "#6abf4b", "#c76c61", "#df3c27", "#4197cb", "#df3c27", "#2d2b6f", "#6abf4b"];

/* ================================================================
   Level Badge
   ================================================================ */
function LevelBadge({ level }) {
  const config = {
    free: { cls: "bg-white/[0.06] text-white/50", icon: Users, label: "Free" },
    professional: { cls: "bg-emerald-500/15 text-emerald-300", icon: Star, label: "Professional" },
    enterprise: { cls: "bg-brand-500/15 text-brand-300", icon: Crown, label: "Enterprise" },
    admin: { cls: "bg-pink-500/15 text-pink-300", icon: ShieldAlert, label: "Admin" },
  }[normalizeTier(level)] || { cls: "bg-white/[0.06] text-white/50", icon: Users, label: level };

  const Ic = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.cls}`}>
      <Ic className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/* ================================================================
   Tenure Badge
   ================================================================ */
function TenureBadge({ tenure, geo }) {
  if (!tenure) return <span className="text-white/20">—</span>;
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-brand-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
        <Star className="h-2.5 w-2.5" /> Lifetime
      </span>
      {geo && (
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-red-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
          <Crown className="h-2.5 w-2.5" /> GEO
        </span>
      )}
    </div>
  );
}

/* ================================================================
   Stat Card
   ================================================================ */
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

/* ================================================================
   Main AdminUsers Page
   ================================================================ */
export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { users, stats, loading, error, refresh } = useAdminData();

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-6 w-6 text-brand-400" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-white/45">Manage all registered users</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 mb-5 max-w-xl focus-within:border-brand-500/40 transition">
        <Search className="h-4 w-4 text-white/30 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-sm text-white placeholder:text-white/30"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Users} value={formatNumber(stats.totalUsers)} label="Total Users" color="#3b82f6" iconBg="rgba(59,130,246,0.15)" />
        <StatCard icon={UserCheck} value={formatNumber(stats.freeUsers)} label="Free" color="#6b7280" iconBg="rgba(107,114,128,0.15)" />
        <StatCard icon={Star} value={formatNumber(stats.professionalUsers)} label="Professional" color="#22c55e" iconBg="rgba(34,197,94,0.15)" />
        <StatCard icon={Crown} value={formatNumber(stats.enterpriseUsers)} label="Enterprise" color="#8b5cf6" iconBg="rgba(139,92,246,0.15)" />
        <StatCard icon={ShieldAlert} value={formatNumber(stats.admins)} label="Admins" color="#ef4444" iconBg="rgba(239,68,68,0.15)" />
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {/* Users table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-5 py-3">
                <span className="flex items-center gap-1">User <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">
                <span className="flex items-center gap-1">Level <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">
                <span className="flex items-center gap-1">Tenure <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">
                <span className="flex items-center gap-1">Joined <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-white/40">Loading users...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-white/40">No users found</td>
              </tr>
            )}
            {!loading && filtered.map((user, i) => (
              <tr key={user.id || user.email} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: avatarColors[i % avatarColors.length] }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white">{user.name}</div>
                      <div className="text-[11px] text-white/35">✉ {user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5"><LevelBadge level={user.level} /></td>
                <td className="px-4 py-3.5"><TenureBadge tenure={user.tenure} geo={user.geo} /></td>
                <td className="px-4 py-3.5 text-[12px] text-white/45">📅 {user.joined}</td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-1">
                    {[Pencil, MessageCircle, Pin, Bolt, ExternalLink].map((Ic, j) => (
                      <button
                        key={j}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-brand-400"
                      >
                        <Ic className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
