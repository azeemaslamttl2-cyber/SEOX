import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Settings, ShieldCheck, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { logout } from "../lib/auth.js";
import Avatar from "./Avatar.jsx";

export default function UserMenu({ className = "" }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/", { replace: true });
  };

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="user-menu-button flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-sm text-white transition hover:bg-white/[0.08]"
        type="button"
      >
        <Avatar user={user} size={28} />
        <span className="max-w-[120px] truncate text-sm font-medium text-white">
          {user.displayName || user.email?.split("@")[0]}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 p-1.5 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.displayName || "User"}</p>
              <p className="truncate text-xs text-white/50">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-white/10" />
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4 text-white/50" />
            Dashboard
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            <Settings className="h-4 w-4 text-white/50" />
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              <ShieldCheck className="h-4 w-4 text-brand-400" />
              Admin Panel
            </Link>
          )}
          <div className="my-1 h-px bg-white/10" />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
