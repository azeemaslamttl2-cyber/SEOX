import { useState } from "react";
import {
  Globe2,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Inbox,
  ArrowUpDown,
  Star,
} from "lucide-react";
import { useAdminData } from "../../hooks/useAdminData.js";

const avatarColors = ["#8b5cf6", "#3b82f6", "#10b981", "#ec4899", "#f97316", "#06b6d4"];

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
   Main AdminNiches Page
   ================================================================ */
export default function AdminNiches() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { niches, loading, error, refresh } = useAdminData();

  const tabs = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];

  const filtered = niches.filter((n) => {
    const matchesSearch =
      n.user.toLowerCase().includes(search.toLowerCase()) ||
      n.niche.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || n.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalSubmissions = niches.length;
  const pendingCount = niches.filter((n) => n.status === "pending").length;
  const approvedCount = niches.filter((n) => n.status === "approved").length;
  const totalKeywords = niches.reduce((s, n) => s + n.keywords, 0);

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="admin-section-title" style={{ fontSize: 24, gap: 12 }}>
            <Globe2 style={{ width: 24, height: 24, color: "#4f46e5" }} />
            Niche Submissions
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            Review and manage user niche submissions
          </p>
        </div>
        <button onClick={refresh} className="admin-refresh-btn">
          <RefreshCw className={loading ? "animate-spin" : ""} style={{ width: 14, height: 14 }} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24, maxWidth: 700 }}>
        <StatCard icon={Globe2} value={totalSubmissions} label="Total Submissions" gradient="stat-gradient-blue" iconBg="rgba(59,130,246,0.15)" iconColor="#3b82f6" />
        <StatCard icon={Clock} value={pendingCount} label="Pending" gradient="stat-gradient-amber" iconBg="rgba(245,158,11,0.15)" iconColor="#f59e0b" />
        <StatCard icon={CheckCircle} value={approvedCount} label="Approved" gradient="stat-gradient-green" iconBg="rgba(16,185,129,0.15)" iconColor="#10b981" />
        <StatCard icon={Star} value={totalKeywords} label="Total Keywords" gradient="stat-gradient-purple" iconBg="rgba(139,92,246,0.15)" iconColor="#8b5cf6" />
      </div>

      {/* Search + Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="admin-search" style={{ maxWidth: 360 }}>
          <Search style={{ width: 18, height: 18, color: "#9ca3af", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search submissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ marginBottom: 16, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.1)", color: "#fecaca", borderRadius: 12, padding: "12px 16px", fontSize: 13 }}>{error}</div>}

      {/* Table */}
      {loading ? (
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#94a3b8" }}>Loading submissions...</div>
      ) : filtered.length > 0 ? (
        <div className="admin-card" style={{ overflow: "hidden" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Niche</th>
                <th>Keywords</th>
                <th>Status</th>
                <th>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Submitted <ArrowUpDown style={{ width: 12, height: 12 }} />
                  </span>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((niche, i) => (
                <tr key={niche.id || `${niche.email}-${niche.niche}`}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        className="admin-avatar"
                        style={{ background: avatarColors[i % avatarColors.length], color: "white" }}
                      >
                        {niche.user.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{niche.user}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{niche.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{niche.niche}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "#4f46e5" }}>{niche.keywords}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        niche.status === "approved"
                          ? "badge-professional"
                          : niche.status === "pending"
                          ? "badge-premium"
                          : "badge-admin"
                      }`}
                    >
                      {niche.status === "approved" && <CheckCircle style={{ width: 11, height: 11 }} />}
                      {niche.status === "pending" && <Clock style={{ width: 11, height: 11 }} />}
                      {niche.status === "rejected" && <XCircle style={{ width: 11, height: 11 }} />}
                      {niche.status.charAt(0).toUpperCase() + niche.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>📅 {niche.submitted}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="admin-action-btn" title="View"><Eye style={{ width: 14, height: 14 }} /></button>
                      <button className="admin-action-btn" title="Approve"><CheckCircle style={{ width: 14, height: 14 }} /></button>
                      <button className="admin-action-btn" title="Reject"><XCircle style={{ width: 14, height: 14 }} /></button>
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
          <p style={{ fontSize: 15, fontWeight: 500, color: "#6b7280" }}>No submissions found</p>
        </div>
      )}
    </div>
  );
}
