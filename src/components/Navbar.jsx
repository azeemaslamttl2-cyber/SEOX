import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  Sparkles,
  LayoutDashboard,
  Settings,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import Logo from "./Logo.jsx";
import Avatar from "./Avatar.jsx";
import { track } from "../lib/analytics.js";
import { useAuth } from "../context/AuthContext.jsx";
import { logout } from "../lib/auth.js";

const links = [
  { label: "Features", to: "/#features" },
  { label: "Pricing", to: "/#pricing" },
  { label: "Help", to: "/#faq" },
  { label: "Desktop App", to: "/#cta" },
  { label: "Free SEO Audit", to: "/tech-seo/eeat" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Close mobile + dropdown when route changes
  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "landing-nav is-scrolled" : "landing-nav"
      }`}
    >
      <div className="container-px flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 py-1">
          <Logo className="w-24 h-auto block" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="landing-nav-link"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {loading ? (
            <div className="landing-nav-skeleton h-8 w-24 animate-pulse" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="home-user-menu-button flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition hover:bg-white/[0.08]"
                type="button"
              >
                <Avatar user={user} size={28} />
                <span className="max-w-[120px] truncate text-sm font-medium text-white">
                  {user.displayName || user.email?.split("@")[0]}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-white/50 transition-transform ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {menuOpen && (
                <div className="home-user-menu absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 p-1.5 shadow-2xl backdrop-blur-2xl">
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
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                  >
                    <LayoutDashboard className="h-4 w-4 text-white/50" />
                    Dashboard
                  </Link>
                  <Link
                    to="/auditor"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                  >
                    <ShieldCheck className="h-4 w-4 text-brand-400" />
                    Site Auditor
                    <span className="ml-auto rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-200">
                      New
                    </span>
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                  >
                    <Settings className="h-4 w-4 text-white/50" />
                    Settings
                  </Link>
                  <div className="my-1 h-px bg-white/10" />
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
          ) : (
            <>
              <Link
                to="/login"
                className="landing-nav-link"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                onClick={() => track("signup_click", { location: "navbar" })}
                className="ui-button ui-button-primary landing-nav-cta group"
              >
                <Sparkles className="h-4 w-4" />
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="landing-nav-toggle lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="landing-nav-sheet lg:hidden">
          <div className="container-px flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="landing-nav-sheet-link"
              >
                {l.label}
              </Link>
            ))}

            <div className="landing-nav-sheet-rule my-2" />

            {user ? (
              <>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <Avatar user={user} size={36} />
                  <div className="min-w-0">
                    <p className="landing-nav-sheet-name truncate">
                      {user.displayName || "User"}
                    </p>
                    <p className="landing-nav-sheet-email truncate">{user.email}</p>
                  </div>
                </div>
                <Link to="/dashboard" className="landing-nav-sheet-link">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="landing-nav-sheet-link is-danger"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="landing-nav-sheet-link">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="ui-button ui-button-primary landing-nav-cta mt-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
