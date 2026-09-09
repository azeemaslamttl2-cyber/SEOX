import { Outlet, Link, NavLink } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  Key,
  Shield,
  WalletCards,
} from "lucide-react";

const sideNavItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Manage Users", to: "/admin/users", icon: Users },
  { label: "User Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Pending Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Stripe Management", to: "/admin/stripe", icon: WalletCards },
  { label: "APIs", to: "/admin/apis", icon: Key },
];

export default function AdminLayout() {
  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      <div className="flex">
        {/* Sidebar */}
        <aside className="app-sidebar sticky top-0 hidden h-screen w-[220px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block no-scrollbar">
          {/* Header */}
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-amber-500">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">
              Admin Panel
            </span>
          </div>

          {/* Nav items */}
          <nav className="space-y-1">
            {sideNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-brand-500/15 to-transparent text-brand-200 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.15)]"
                      : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`h-4 w-4 flex-shrink-0 ${
                        isActive ? "text-brand-400" : "text-white/30"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="app-topbar sticky top-0 z-20 flex h-12 items-center border-b border-white/10 bg-ink-900/80 px-5 backdrop-blur-md">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </header>

          {/* Page content */}
          <main className="app-main min-w-0 flex-1 px-5 pb-12 pt-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
