import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  Globe2,
  UserPlus,
  Shield,
  WalletCards,
  Key,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Manage Users", to: "/admin/users", icon: Users },
  { label: "User Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Pending Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Stripe Management", to: "/admin/stripe", icon: WalletCards },
  { label: "APIs", to: "/admin/apis", icon: Key },
  { label: "Niche Submissions", to: "/admin/niches", icon: Globe2 },
  { label: "Manage Affiliates", to: "/admin/affiliates", icon: UserPlus },
];

export default function AdminSidebar() {
  return (
    <aside
      className="no-scrollbar"
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        width: 230,
        flexShrink: 0,
        overflowY: "auto",
        background: "#ffffff",
        borderRight: "1px solid #e8ecf1",
        padding: "24px 14px",
        display: "none",
      }}
      /* show on md+ via Tailwind utility on wrapper */
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 28 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Shield style={{ width: 16, height: 16, color: "white" }} />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#1a1a2e",
          }}
        >
          Admin Panel
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              textDecoration: "none",
              transition: "all 0.2s ease",
              background: isActive
                ? "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))"
                : "transparent",
              color: isActive ? "#4f46e5" : "#64748b",
              boxShadow: isActive
                ? "inset 0 0 0 1px rgba(99,102,241,0.15)"
                : "none",
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    color: isActive ? "#4f46e5" : "#94a3b8",
                  }}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
