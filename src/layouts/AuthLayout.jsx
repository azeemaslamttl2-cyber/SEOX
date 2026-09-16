import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Sparkles, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import Logo from "../components/Logo.jsx";
import RouteOutlet from "../components/RouteOutlet.jsx";

export default function AuthLayout() {
  const { pathname } = useLocation();
  const isLogin = pathname.startsWith("/login");

  return (
    <div className="auth-shell relative min-h-[100dvh] overflow-hidden">
      {/* Background atmosphere */}
      <div class="auth-atmosphere pointer-events-none absolute inset-0">
        <div class="auth-grid"></div>
      </div>

      {/* Top bar */}
      <header className="container-px flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 py-1">
          <Logo className="w-24 h-auto block" />
        </Link>
        <Link to="/" className="auth-back-link">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      <main className="container-px grid min-h-[calc(100dvh-4rem)] gap-10 py-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-12">
        {/* Form column */}
        <div className="flex w-full justify-center lg:justify-end">
          <div className="w-full max-w-md">
            <RouteOutlet />
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
      <div className="auth-brand-panel relative overflow-hidden">
        <div className="relative">
          <span className="auth-eyebrow">
            <span className="auth-eyebrow-dot" />
            PGC Intelligence Framework
          </span>

          <h2 className="auth-brand-heading">
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

          <p className="auth-brand-copy">
            {isLogin
              ? "Sign in to access 60+ semantic SEO tools, your audit history and your team workspace."
              : "Join 18,500+ marketers using PGC to ship AI-native SEO at scale."}
          </p>

          {/* Trust badges */}
          <div className="auth-stat-grid">
            <Stat icon={ShieldCheck} value="60+" label="Audit Checks" />
            <Stat icon={Zap} value="50+" label="SEO Tools" />
            <Stat icon={TrendingUp} value="312%" label="Avg Lift" />
          </div>

          {/* Floating audit preview */}
          <div className="auth-preview">
            <div className="auth-preview-bar">
              <div className="flex items-center gap-2">
                <span className="auth-dot auth-dot-red" />
                <span className="auth-dot auth-dot-amber" />
                <span className="auth-dot auth-dot-green" />
                <span className="auth-preview-title">PGC Dashboard</span>
              </div>
              <span className="auth-preview-live">LIVE</span>
            </div>
            <div className="auth-preview-body">
              <Line label="Experience" value={88} />
              <Line label="Expertise" value={92} />
              <Line label="Authority" value={76} />
              <Line label="Trust" value={95} />
            </div>
          </div>

          <div className="auth-brand-footnote">
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            <span>14-day free trial · No credit card required · Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="auth-stat">
      <Icon className="auth-stat-icon h-4 w-4" />
      <div className="auth-stat-value">{value}</div>
      <div className="auth-stat-label">{label}</div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="auth-line">
      <span className="auth-line-label">{label}</span>
      <div className="auth-line-track">
        <div className="auth-line-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="auth-line-value">{value}</span>
    </div>
  );
}
