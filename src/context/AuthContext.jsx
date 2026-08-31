import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { normalizeTier } from "../lib/tiers.js";
import { getPersistedAuthUser } from "../lib/authSession.js";

const AuthContext = createContext({ user: null, claims: {}, loading: true, isAdmin: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshAuthUser = useCallback(() => {
    const persistedUser = getPersistedAuthUser();
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

  return (
    <AuthContext.Provider value={{ user, claims, loading, isAdmin, refreshAuthUser }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
