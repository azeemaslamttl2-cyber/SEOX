import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { normalizeTier } from "../lib/tiers.js";

const EMPTY_DATA = {
  users: [],
  payments: [],
  niches: [],
  affiliates: [],
  generatedAt: null,
};

const ADMIN_DATA_PATH = "/api/admin-data";

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function getAdminDataUrls() {
  const configuredBase = normalizeBaseUrl(import.meta.env.VITE_ADMIN_API_BASE);
  if (configuredBase) return [`${configuredBase}${ADMIN_DATA_PATH}`];

  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port === "5173"
  ) {
    return [`http://127.0.0.1:8788${ADMIN_DATA_PATH}`, ADMIN_DATA_PATH];
  }

  return [ADMIN_DATA_PATH];
}

async function fetchAdminData(token) {
  let lastError = null;

  for (const url of getAdminDataUrls()) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload = isJson ? await response.json().catch(() => ({})) : null;

      if (!response.ok) {
        const error = new Error(payload?.error || `Failed to load admin data (${response.status}).`);
        error.fromAdminApi = isJson;
        throw error;
      }

      if (!isJson || !payload || !Array.isArray(payload.users)) {
        const error = new Error(
          "Admin API did not return local user data. Check that the local API is running."
        );
        error.fromAdminApi = false;
        throw error;
      }

      return payload;
    } catch (error) {
      if (error.fromAdminApi) throw error;
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to load admin data.");
}

export function useAdminData() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useCallback(() => setRefreshIndex((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        if (authLoading) return;
        if (!user) throw new Error("Sign in before opening the admin panel.");

        const token = await user.getIdToken();
        const payload = await fetchAdminData(token);

        if (!cancelled) setData({ ...EMPTY_DATA, ...payload });
      } catch (err) {
        if (!cancelled) {
          setData(EMPTY_DATA);
          setError(err.message || "Failed to load admin data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, refreshIndex, user]);

  const stats = useMemo(() => {
    const users = data.users || [];
    const normalizedUsers = users.map((user) => ({ ...user, level: normalizeTier(user.level) }));
    const enterpriseUsers = normalizedUsers.filter((user) => user.level === "enterprise");
    const lifetimeEnterprise = enterpriseUsers.filter((user) => user.tenure === "lifetime");
    const lifetimeIncome = lifetimeEnterprise.length * 5000;

    return {
      totalUsers: normalizedUsers.length,
      freeUsers: normalizedUsers.filter((user) => user.level === "free").length,
      professionalUsers: normalizedUsers.filter((user) => user.level === "professional").length,
      enterpriseUsers: enterpriseUsers.length,
      admins: normalizedUsers.filter((user) => user.level === "admin").length,
      lifetimeEnterprise: lifetimeEnterprise.length,
      monthlyEnterprise: enterpriseUsers.filter((user) => user.tenure && user.tenure !== "lifetime").length,
      lifetimeIncome,
      conversionRate: normalizedUsers.length ? (enterpriseUsers.length / normalizedUsers.length) * 100 : 0,
    };
  }, [data.users]);

  return { ...data, stats, loading, error, refresh };
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}
