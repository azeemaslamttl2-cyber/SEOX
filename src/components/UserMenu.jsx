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
        className="user-menu-button flex items-center gap-2 rounded-full border border-[#ead9d8] bg-white py-1 pl-1 pr-3 text-sm text-[#2d2b6f] shadow-sm transition hover:bg-[#fff6f5]"
        type="button"
      >
        <Avatar user={user} size={28} />
        <span className="max-w-[120px] truncate text-sm font-medium text-[#2d2b6f]">
          {user.displayName || user.email?.split("@")[0]}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-[#5a5789] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[#f2e0df] bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#2d2b6f]">{user.displayName || "User"}</p>
              <p className="truncate text-xs text-[#5f5d82]">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-[#f5e8e8]" />
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#494c76] transition hover:bg-[#f9f4f4] hover:text-[#2d2b6f]"
          >
            <LayoutDashboard className="h-4 w-4 text-[#7a7aa0]" />
            Dashboard
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#494c76] transition hover:bg-[#f9f4f4] hover:text-[#2d2b6f]"
          >
            <Settings className="h-4 w-4 text-[#7a7aa0]" />
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#494c76] transition hover:bg-[#f9f4f4] hover:text-[#2d2b6f]"
            >
              <ShieldCheck className="h-4 w-4 text-[#ea5b4a]" />
              Admin Panel
            </Link>
          )}
          <div className="my-1 h-px bg-[#f5e8e8]" />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#cf4a47] hover:bg-[#fff1f1]"
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
