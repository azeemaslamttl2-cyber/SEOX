import { useState } from "react";
import {
  UserPlus,
  RefreshCw,
  Search,
  Users,
  DollarSign,
  TrendingUp,
  Link2,
  Eye,
  Copy,
  Pencil,
  Trash2,
  Inbox,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { useAdminData } from "../../hooks/useAdminData.js";

const avatarColors = ["#2d2b6f", "#4197cb", "#6abf4b", "#c76c61", "#df3c27"];

/* ================================================================
   Stat Card
   ================================================================ */
function StatCard({ icon: Icon, value, label, gradient, iconColor, iconBg }) {
  return (
    <div className={`admin-stat ${gradient}`}>
      <div className="stat-icon" style={{ background: iconBg }}>
        <Icon style={{ width: 18, height: 18, color: iconColor }} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ================================================================
   Main AdminAffiliates Page
   ================================================================ */
export default function AdminAffiliates() {
  const [search, setSearch] = useState("");
  const { affiliates, loading, error, refresh } = useAdminData();

  const filtered = affiliates.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalAffiliates = affiliates.length;
  const activeAffiliates = affiliates.filter((a) => a.status === "active").length;
  const totalReferrals = affiliates.reduce((s, a) => s + a.referrals, 0);
  const totalEarnings = affiliates.reduce((s, a) => s + a.earnings, 0);

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="admin-section-title" style={{ fontSize: 24, gap: 12 }}>
            <UserPlus style={{ width: 24, height: 24, color: "#4f46e5" }} />
            Manage Affiliates
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            Affiliate program management & commission tracking
          </p>
        </div>
        <button onClick={refresh} className="admin-refresh-btn">
          <RefreshCw className={loading ? "animate-spin" : ""} style={{ width: 14, height: 14 }} />
          Refresh
        </button>
      </div>

      {error && <div style={{ marginBottom: 16, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.1)", color: "#fecaca", borderRadius: 12, padding: "12px 16px", fontSize: 13 }}>{error}</div>}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24, maxWidth: 800 }}>
        <StatCard icon={Users} value={totalAffiliates} label="Total Affiliates" gradient="stat-gradient-blue" iconBg="rgba(59,130,246,0.15)" iconColor="#3b82f6" />
        <StatCard icon={UserPlus} value={activeAffiliates} label="Active" gradient="stat-gradient-green" iconBg="rgba(16,185,129,0.15)" iconColor="#10b981" />
        <StatCard icon={TrendingUp} value={totalReferrals} label="Total Referrals" gradient="stat-gradient-purple" iconBg="rgba(139,92,246,0.15)" iconColor="#8b5cf6" />
        <StatCard icon={DollarSign} value={`Rs ${totalEarnings.toLocaleString()}`} label="Total Earnings" gradient="stat-gradient-amber" iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b" />
      </div>

      {/* Search */}
      <div className="admin-search" style={{ marginBottom: 20, maxWidth: 500 }}>
        <Search style={{ width: 18, height: 18, color: "#9ca3af", flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search affiliates by name, email, or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#94a3b8" }}>Loading affiliates...</div>
      ) : filtered.length > 0 ? (
        <div className="admin-card" style={{ overflow: "hidden" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Affiliate</th>
                <th>Code</th>
                <th style={{ textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Referrals <ArrowUpDown style={{ width: 12, height: 12 }} />
                  </span>
                </th>
                <th style={{ textAlign: "right" }}>Earnings</th>
                <th style={{ textAlign: "right" }}>Conv. Rate</th>
                <th>Status</th>
                <th>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Joined <ArrowUpDown style={{ width: 12, height: 12 }} />
                  </span>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((affiliate, i) => (
                <tr key={affiliate.id || `${affiliate.email}-${affiliate.code}`}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        className="admin-avatar"
                        style={{ background: avatarColors[i % avatarColors.length], color: "white" }}
                      >
                        {affiliate.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{affiliate.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{affiliate.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code
                        style={{
                          background: "#f3f4f6",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#4f46e5",
                          fontFamily: "monospace",
                        }}
                      >
                        {affiliate.code}
                      </code>
                      <button className="admin-action-btn" title="Copy" style={{ width: 24, height: 24 }}>
                        <Copy style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{affiliate.referrals}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, fontFamily: "'Gotham', 'Century Gothic', sans-serif" }}>
                    Rs {affiliate.earnings.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                    {affiliate.conversionRate}%
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${affiliate.status === "active" ? "badge-professional" : "badge-premium"}`}
                    >
                      {affiliate.status === "active" ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>📅 {affiliate.joined}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="admin-action-btn" title="View"><Eye style={{ width: 14, height: 14 }} /></button>
                      <button className="admin-action-btn" title="Edit"><Pencil style={{ width: 14, height: 14 }} /></button>
                      <button className="admin-action-btn" title="Link"><ExternalLink style={{ width: 14, height: 14 }} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "80px 20px",
            color: "#94a3b8",
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Inbox style={{ width: 28, height: 28, color: "#d1d5db" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#6b7280" }}>No affiliates found</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            Affiliates will appear here once they join the program
          </p>
        </div>
      )}
    </div>
  );
}
