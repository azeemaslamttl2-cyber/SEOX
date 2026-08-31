import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, Sparkles, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import Logo from "../components/Logo.jsx";

export default function AuthLayout() {
  const { pathname } = useLocation();
  const isLogin = pathname.startsWith("/login");

  return (
    <div className="auth-shell relative min-h-screen overflow-hidden bg-ink-900 text-white">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-brand-500/15 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="container-px flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight">
            PGC
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      <main className="container-px grid min-h-[calc(100vh-4rem)] gap-10 py-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-12">
        {/* Form column */}
        <div className="flex w-full justify-center lg:justify-end">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>

        {/* Marketing column */}
        <div className="relative hidden lg:block">
          <BrandPanel isLogin={isLogin} />
        </div>
      </main>
    </div>
  );
}

function BrandPanel({ isLogin }) {
  return (
    <div className="relative h-full">
      <div className="auth-brand-panel relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-500/10 via-ink-800 to-ink-900 p-10">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 animate-float rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 animate-float-slow rounded-full bg-amber-400/20 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            PGC Intelligence Framework
          </span>

          <h2 className="mt-6 font-display text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            {isLogin ? (
              <>
                Welcome back. <br />
                <span className="gradient-text">Your rankings missed you.</span>
              </>
            ) : (
              <>
                Master AI search with{" "}
                <span className="gradient-text">Semantic Intelligence</span>
              </>
            )}
          </h2>

          <p className="mt-4 text-white/60">
            {isLogin
              ? "Sign in to access 60+ semantic SEO tools, your audit history and your team workspace."
              : "Join 18,500+ marketers using PGC to ship AI-native SEO at scale."}
          </p>

          {/* Trust badges */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <Stat icon={ShieldCheck} value="60+" label="Audit Checks" />
            <Stat icon={Zap} value="50+" label="SEO Tools" />
            <Stat icon={TrendingUp} value="312%" label="Avg Lift" />
          </div>

          {/* Floating audit preview */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500/80" />
                <span className="h-2 w-2 rounded-full bg-yellow-500/80" />
                <span className="h-2 w-2 rounded-full bg-green-500/80" />
                <span className="ml-3 text-xs text-white/50">PGC Dashboard</span>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                LIVE
              </span>
            </div>
            <div className="space-y-2 p-4">
              <Line label="Experience" value={88} />
              <Line label="Expertise" value={92} />
              <Line label="Authority" value={76} />
              <Line label="Trust" value={95} />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 text-xs text-white/50">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <span>14-day free trial · No credit card required · Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-brand-300" />
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-white/60">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-400"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-bold text-brand-300">{value}</span>
    </div>
  );
}
