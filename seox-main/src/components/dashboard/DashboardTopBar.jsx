import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { logout } from "../../lib/auth.js";
import Avatar from "../Avatar.jsx";
import NotificationButton from "../NotificationButton.jsx";
import ProjectSelector from "../ProjectSelector.jsx";

export default function DashboardTopBar() {
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-ink-900/80 px-4 backdrop-blur-md lg:px-6">
      {/* Left: Project selector */}
      <div className="flex items-center gap-3">
        <ProjectSelector />

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
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 lg:flex">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            placeholder="Search check points..."
            className="w-48 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>

        {/* Notifications */}
        <NotificationButton />

        {/* User avatar / dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full transition hover:ring-2 hover:ring-white/10"
          >
            {user ? (
              <Avatar user={user} size={32} />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 ring-2 ring-white/10" />
            )}
            {user && (
              <span className="hidden text-sm font-medium text-white lg:block">
                {user.displayName || "Admin"}
              </span>
            )}
          </button>

          {userOpen && user && (
            <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50">
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
