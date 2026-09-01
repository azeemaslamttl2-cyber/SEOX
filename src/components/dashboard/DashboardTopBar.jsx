import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Moon,
  LogOut,
  Shield,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { logout } from "../../lib/auth.js";
import Avatar from "../Avatar.jsx";
import ProjectSelector from "../ProjectSelector.jsx";

export default function DashboardTopBar({ projectsLoading = false }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClick(e) {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUserOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <header className="app-topbar sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      {/* Left: Project selector */}
      <div className="flex items-center gap-3">
        <ProjectSelector />
        
        {/* Project loading indicator */}
        {projectsLoading && (
          <div className="flex items-center gap-2 text-xs text-white/50" role="status">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading projects…</span>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="hidden items-center gap-2 text-sm lg:flex">
          <span className="text-white/20">›</span>
          <span className="font-semibold text-white">Audit</span>
          <span className="text-white/20">›</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="app-topbar-search hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            placeholder="Search check points..."
            className="w-48 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        {/* Dark mode toggle */}
        <button aria-label="Toggle theme" className="ui-button-tertiary flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white">
          <Moon className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button aria-label="Notifications" className="ui-button-tertiary relative flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* User avatar / dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="user-menu-button flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-sm text-white transition hover:bg-white/[0.08]"
            type="button"
          >
            {user ? (
              <Avatar user={user} size={28} />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 ring-2 ring-white/10" />
            )}
            {user && (
              <span className="max-w-[120px] truncate text-sm font-medium text-white">
                {user.displayName || "Admin"}
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 text-white/50 transition-transform ${userOpen ? "rotate-180" : ""}`} />
          </button>

          {userOpen && user && (
            <div role="menu" className="app-menu animate-scale-in absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50">
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar user={user} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {user.displayName || "User"}
                  </p>
                  <p className="truncate text-xs text-white/50">{user.email}</p>
                </div>
              </div>
              <div className="my-1 h-px bg-white/10" />
              {isAdmin && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setUserOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    <Shield className="h-4 w-4 text-brand-400" />
                    Admin Panel
                  </Link>
                  <div className="my-1 h-px bg-white/10" />
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
