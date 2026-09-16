import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  User,
} from "lucide-react";
import { signUp, signInWithGoogle } from "../lib/auth.js";
import { getAuthErrorMessage } from "../lib/authErrors.js";
import { persistAuthUser } from "../lib/authSession.js";

function scorePassword(pwd) {
  let score = 0;
  if (!pwd) return 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const strengthLabel = ["Too short", "Weak", "Fair", "Strong", "Excellent"];

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const score = useMemo(() => scorePassword(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!terms) {
      setError("Please accept the terms to continue.");
      return;
    }

    setLoading(true);
    try {
      const user = await signUp({ email, password, displayName: name });
      if (typeof window !== "undefined") {
        persistAuthUser(user, true);
        window.dispatchEvent(new Event("mysql-auth-changed"));
      }
      navigate("/dashboard", { replace: true });
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
      signInWithGoogle({ returnTo: "/dashboard" });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="register-form auth-card">
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-subtitle">
        Already a member?{" "}
        <Link to="/login" className="auth-link">
          Sign in
        </Link>
      </p>

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
        Sign up with Google
      </button>

      <div className="auth-divider">
        <span className="auth-divider-rule" />
        Or use email
        <span className="auth-divider-rule" />
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <Field
          label="Full name"
          icon={User}
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Aleem Khan"
        />

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

        <div>
          <Field
            label="Password"
            icon={Lock}
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
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
          {password && (
            <div className="auth-strength" data-score={score}>
              <div className="auth-strength-bars">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} className="auth-strength-bar" data-on={i < score ? "1" : "0"} />
                ))}
              </div>
              <p className="auth-strength-caption" aria-live="polite">
                Strength: <span className="auth-strength-value">{strengthLabel[score]}</span>
              </p>
            </div>
          )}
        </div>

        <Field
          label="Confirm password"
          icon={Lock}
          type={showPwd ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter password"
        />

        <label className="auth-consent">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="auth-checkbox"
          />
          <span>
            I agree to the{" "}
            <a href="#" className="auth-link">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="auth-link">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading || googleLoading} className="auth-submit group">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
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
