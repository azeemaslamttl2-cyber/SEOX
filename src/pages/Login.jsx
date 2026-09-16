import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { signIn, signInWithGoogle, resetPassword } from "../lib/auth.js";
import { getAuthErrorMessage } from "../lib/authErrors.js";
import { persistAuthUser } from "../lib/authSession.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  function decodeBase64Url(value) {
    let base64 = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    return base64;
  }

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const oauthError = query.get("google_error");
    if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, "", location.pathname);
      return;
    }

    const oauthPayload = new URLSearchParams(location.hash.slice(1)).get("google_auth");
    if (!oauthPayload) return;
    try {
      const base64 = decodeBase64Url(oauthPayload);
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      if (!payload?.user?.accessToken) throw new Error("Google sign-in did not return a session.");
      persistAuthUser(payload.user, true);
      window.dispatchEvent(new Event("mysql-auth-changed"));
      window.history.replaceState({}, "", location.pathname);
      navigate(payload.returnTo || "/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Could not complete Google sign-in.");
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await signIn({ email, password, remember });
      try {
        console.debug('signIn returned user:', user);
        console.debug('will navigate to:', from);
      } catch (e) {
        // ignore
      }
      if (typeof window !== "undefined") {
        persistAuthUser(user, remember);
        window.dispatchEvent(new Event("mysql-auth-changed"));
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      signInWithGoogle({ returnTo: from });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleReset = async () => {
    setError("");
    if (!email) {
      setError("Enter your email above to receive a reset link.");
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 6000);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  return (
    <div className="login-form auth-card">
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">
        New to PGC?{" "}
        <Link to="/register" className="auth-link">
          Create an account
        </Link>
      </p>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        className="auth-social-button"
      >
        {googleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </button>

      <div className="auth-divider">
        <span className="auth-divider-rule" />
        Or continue with email
        <span className="auth-divider-rule" />
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <Field
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />

        <Field
          label="Password"
          icon={Lock}
          type={showPwd ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="auth-reveal"
              aria-label={showPwd ? "Hide password" : "Show password"}
              aria-pressed={showPwd}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="auth-meta-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="auth-checkbox"
            />
            Remember me
          </label>
          <button type="button" onClick={handleReset} className="auth-link">
            Forgot password?
          </button>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resetSent && (
          <div className="auth-alert auth-alert-success" role="status">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>Password reset email sent. Check your inbox.</span>
          </div>
        )}

        <button type="submit" disabled={loading || googleLoading} className="auth-submit group">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="auth-legal">
        By signing in you agree to our{" "}
        <a href="#" className="auth-legal-link">
          Terms
        </a>{" "}
        &amp;{" "}
        <a href="#" className="auth-legal-link">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

function Field({ label, icon: Icon, rightSlot, ...rest }) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <div className="auth-control">
        <Icon className="auth-control-icon h-4 w-4 flex-shrink-0" />
        <input {...rest} className="auth-input" />
        {rightSlot && <div className="auth-control-slot">{rightSlot}</div>}
      </div>
    </label>
  );
}

function GoogleIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C41.4 35.4 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
