import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getGoogleRedirectUri, parseGscOAuthState } from "../../lib/googleOAuthConfig.js";
import { writeStoredGscSession } from "../../lib/gscSession.js";
import { getSessionToken } from "../../lib/authSession.js";

function getUserId(user) {
  return user?.uid || user?.id || "";
}

export default function GscOAuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const exchangeStartedRef = useRef(false);
  const state = useMemo(() => parseGscOAuthState(params.get("state")), [params]);

  useEffect(() => {
    if (loading) return;

    const code = params.get("code");
    const googleError = params.get("error");
    const userId = getUserId(user);
    const returnTo = state.returnTo || "/keywords/new";

    if (googleError) {
      setError(`Google returned: ${googleError}`);
      return;
    }

    if (!code) {
      setError("Google did not return an authorization code.");
      return;
    }

    if (!userId) {
      setError("Please log in before connecting Search Console.");
      return;
    }

    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    async function exchangeCode() {
      try {
        const sessionToken = getSessionToken();
        if (!sessionToken) throw new Error("Your login session is missing. Please sign in again.");
        const response = await fetch("/api/gsc-token", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "exchange",
            code,
            userId,
            redirectUri: getGoogleRedirectUri(),
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !data.accessToken) {
          const detail =
            data?.details?.error_description ||
            data?.details?.error ||
            data?.message ||
            data?.error;
          throw new Error(detail || "Failed to connect Search Console.");
        }

        writeStoredGscSession({
          accessToken: data.accessToken,
          expiresAt: data.expiresAt,
          googleEmail: data.googleEmail,
        });
        navigate(returnTo, { replace: true });
      } catch (err) {
        const errorMsg = err?.message || "Failed to connect Search Console.";
        console.error("GSC OAuth exchange error:", err);
        setError(errorMsg);
      }
    }

    exchangeCode();
  }, [loading, navigate, params, state, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        {error ? (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
            <h1 className="mt-4 font-display text-lg font-bold">Search Console connection failed</h1>
            <p className="mt-2 text-sm text-white/50">{error}</p>
            <button
              onClick={() => navigate(state.returnTo || "/keywords/new", { replace: true })}
              className="mt-5 rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/[0.1]"
            >
              Back to keyword tools
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-400" />
            <h1 className="mt-4 font-display text-lg font-bold">Connecting Search Console</h1>
            <p className="mt-2 text-sm text-white/45">Finishing Google OAuth and restoring your keyword data.</p>
          </>
        )}
      </div>
    </div>
  );
}
