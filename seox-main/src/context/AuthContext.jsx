import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { normalizeTier } from "../lib/tiers.js";

const AuthContext = createContext({ user: null, claims: {}, loading: true, isAdmin: false });
const ADMIN_STATUS_PATH = "/api/admin-status";

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function getAdminStatusUrls() {
  const configuredBase = normalizeBaseUrl(import.meta.env.VITE_ADMIN_API_BASE);
  if (configuredBase) return [`${configuredBase}${ADMIN_STATUS_PATH}`];

  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port === "5173"
  ) {
    return [`http://127.0.0.1:8788${ADMIN_STATUS_PATH}`, ADMIN_STATUS_PATH];
  }

  return [ADMIN_STATUS_PATH];
}

async function fetchEnvAdminStatus(token) {
  for (const url of getAdminStatusUrls()) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.isAdmin) return true;
      if (response.ok) return false;
    } catch {
      // Try the next URL. Local Vite dev often has no Pages Function server.
    }
  }

  return false;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          const tokenClaims = token.claims || {};
          const claimAdmin = Boolean(
            tokenClaims.admin ||
              normalizeTier(tokenClaims.level || tokenClaims.plan) === "admin"
          );
          const envAdmin = claimAdmin ? false : await fetchEnvAdminStatus(token.token);
          setClaims({ ...tokenClaims, envAdmin });
        } catch {
          setClaims({});
        }
      } else {
        setClaims({});
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const isAdmin = Boolean(
    claims.admin ||
      claims.envAdmin ||
      normalizeTier(claims.level || claims.plan) === "admin"
  );

  return (
    <AuthContext.Provider value={{ user, claims, loading, isAdmin }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
