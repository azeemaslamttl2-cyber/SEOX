import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { normalizeTier } from "../lib/tiers.js";
import { getPersistedAuthUser } from "../lib/authSession.js";
import { clearAll as clearProjectDataStore } from "../lib/projectDataStore.js";

const AuthContext = createContext({ user: null, claims: {}, loading: true, isAdmin: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshAuthUser = useCallback(() => {
    const persistedUser = getPersistedAuthUser();
    // Sign-out and user-switch both arrive here. Cached project data is
    // per-user and must not survive either, so drop it before the new identity
    // is published.
    clearProjectDataStore();
    setUser(null);
    if (persistedUser) {
      if (!persistedUser.uid && persistedUser.id) persistedUser.uid = persistedUser.id;
      setUser(persistedUser);
    }
    setClaims({});
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAuthUser();
    window.addEventListener("mysql-auth-changed", refreshAuthUser);
    return () => window.removeEventListener("mysql-auth-changed", refreshAuthUser);
  }, [refreshAuthUser]);

  const isAdmin = Boolean(claims.admin || normalizeTier(claims.level || claims.plan) === "admin");

  const value = useMemo(
    () => ({ user, claims, loading, isAdmin, refreshAuthUser }),
    [claims, isAdmin, loading, refreshAuthUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
