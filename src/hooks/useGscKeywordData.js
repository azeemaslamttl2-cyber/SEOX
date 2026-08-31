import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  clearStoredGscSession,
  ensureValidGscSession,
  readStoredGscSession,
  restoreGscSession,
} from "../lib/gscSession.js";
import { getGoogleRedirectUri, getGscAuthUrl } from "../lib/googleOAuthConfig.js";
import { formatDateISO } from "../lib/keywordTools.js";
import { getSessionToken } from "../lib/authSession.js";

const DATE_PRESETS = [
  { id: "7", label: "7 day", days: 7 },
  { id: "28", label: "28 day", days: 28 },
  { id: "30", label: "30 day", days: 30 },
  { id: "90", label: "90 day", days: 90 },
  { id: "custom", label: "Custom", days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function getUserId(user) {
  return user?.uid || user?.id || "";
}

function dateFromInput(value, fallback) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function useGscKeywordData(source = "keyword-tools", { onAutoFetchSuccess } = {}) {
  const { user, loading: authLoading } = useAuth();
  const userId = getUserId(user);
  const onAutoFetchSuccessRef = useRef(onAutoFetchSuccess);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [gscEmail, setGscEmail] = useState(null);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentRows, setCurrentRows] = useState([]);
  const [previousRows, setPreviousRows] = useState([]);
  const [datePreset, setDatePreset] = useState("30");
  const lastSilentRestoreRef = useRef(0);

  const today = useMemo(() => new Date(), []);
  const [customEndDate, setCustomEndDate] = useState(() => formatDateISO(today));
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 30);
    return formatDateISO(date);
  });
  const selectedPreset = DATE_PRESETS.find((preset) => preset.id === datePreset) || DATE_PRESETS[2];
  const isCustomRange = datePreset === "custom";
  const currentEnd = useMemo(() => {
    if (!isCustomRange) return today;
    const start = dateFromInput(customStartDate, today);
    const end = dateFromInput(customEndDate, today);
    return end < start ? start : end;
  }, [customEndDate, customStartDate, isCustomRange, today]);
  const currentStart = useMemo(() => {
    if (isCustomRange) {
      const start = dateFromInput(customStartDate, today);
      const end = dateFromInput(customEndDate, today);
      return start > end ? end : start;
    }
    const date = new Date(today);
    date.setDate(date.getDate() - selectedPreset.days);
    return date;
  }, [customEndDate, customStartDate, isCustomRange, selectedPreset.days, today]);
  const rangeDays = useMemo(
    () => Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / DAY_MS)),
    [currentEnd, currentStart]
  );
  const previousEnd = useMemo(() => {
    const date = new Date(currentStart);
    date.setDate(date.getDate() - 1);
    return date;
  }, [currentStart]);
  const previousStart = useMemo(() => {
    const date = new Date(previousEnd);
    date.setDate(date.getDate() - rangeDays);
    return date;
  }, [previousEnd, rangeDays]);

  const applyGscSession = useCallback((session) => {
    if (!session?.accessToken) return;
    setAccessToken(session.accessToken);
    setIsSignedIn(true);
    setGscEmail(session.googleEmail || null);
  }, []);

  useEffect(() => {
    onAutoFetchSuccessRef.current = onAutoFetchSuccess;
  }, [onAutoFetchSuccess]);

  const clearGscState = useCallback(() => {
    clearStoredGscSession();
    setAccessToken(null);
    setIsSignedIn(false);
    setGscEmail(null);
    setSites([]);
    setSelectedSite("");
    setCurrentRows([]);
    setPreviousRows([]);
  }, []);

  const restoreConnection = useCallback(
    async ({ silent = false } = {}) => {
      if (authLoading) {
        if (!silent) setIsCheckingConnection(true);
        return;
      }

      if (silent) {
        const now = Date.now();
        if (now - lastSilentRestoreRef.current < 1500) return;
        lastSilentRestoreRef.current = now;
        const local = readStoredGscSession();
        if (local?.accessToken) {
          applyGscSession(local);
          return;
        }
      } else {
        setIsCheckingConnection(true);
      }

      try {
        const session = await restoreGscSession({
          userId,
          preferServer: Boolean(userId),
        });
        if (session?.connected && session.accessToken) {
          applyGscSession(session);
        } else {
          clearGscState();
        }
      } catch (err) {
        setError(err?.message || "Could not restore Search Console connection");
        clearGscState();
      } finally {
        if (!silent) setIsCheckingConnection(false);
      }
    },
    [applyGscSession, authLoading, clearGscState, userId]
  );

  const getValidAccessToken = useCallback(async () => {
    const session = await ensureValidGscSession({ userId });
    if (!session?.accessToken) {
      clearGscState();
      throw new Error("Please connect Search Console again.");
    }
    applyGscSession(session);
    return session.accessToken;
  }, [applyGscSession, clearGscState, userId]);

  useEffect(() => {
    restoreConnection();
  }, [restoreConnection]);

  useEffect(() => {
    const resume = () => restoreConnection({ silent: isSignedIn });
    const handleVisible = () => {
      if (document.visibilityState === "visible") resume();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [isSignedIn, restoreConnection]);

  const handleSignIn = useCallback(async () => {
    if (!userId) {
      setError("Please log in before connecting Search Console.");
      return;
    }

    try {
      window.location.href = await getGscAuthUrl({
        source,
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
    } catch (err) {
      setError(err?.message || "Could not start Google OAuth");
    }
  }, [source, userId]);

  const handleSignOut = useCallback(async () => {
    if (userId) {
      try {
        const token = getSessionToken();
        if (!token) throw new Error("Your login session is missing.");
        await fetch("/api/gsc-token", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "disconnect", userId }),
        });
      } catch {
        // Local cleanup still matters even if the server disconnect fails.
      }
    }
    clearGscState();
  }, [clearGscState, user, userId]);

  const fetchSites = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = await getValidAccessToken();
      const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error?.message || "Failed to fetch Search Console sites.");
      }

      const entries = data.siteEntry || [];
      setSites(entries);
      setSelectedSite((current) => current || entries[0]?.siteUrl || "");
    } catch (err) {
      setError(err?.message || "Failed to fetch Search Console sites.");
      if (String(err?.message || "").includes("connect")) clearGscState();
    } finally {
      setIsLoading(false);
    }
  }, [clearGscState, getValidAccessToken]);

  useEffect(() => {
    if (accessToken) fetchSites();
  }, [accessToken, fetchSites]);

  const fetchQueryPageRows = useCallback(
    async (token, startDate, endDate) => {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
          selectedSite
        )}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: formatDateISO(startDate),
            endDate: formatDateISO(endDate),
            dimensions: ["query", "page"],
            rowLimit: 5000,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error?.message || "Failed to fetch Search Console rows.");
      }

      return data.rows || [];
    },
    [selectedSite]
  );

  const fetchAllData = useCallback(async ({ onSuccess } = {}) => {
    if (!selectedSite || !accessToken) return;
    setIsLoading(true);
    setError("");

    try {
      const token = await getValidAccessToken();
      const [current, previous] = await Promise.all([
        fetchQueryPageRows(token, currentStart, currentEnd),
        fetchQueryPageRows(token, previousStart, previousEnd),
      ]);
      setCurrentRows(current);
      setPreviousRows(previous);

      if (typeof onSuccess === "function") {
        await onSuccess({
          current,
          previous,
          selectedSite,
          currentStart,
          currentEnd,
          previousStart,
          previousEnd,
          source,
        });
      }
    } catch (err) {
      setError(err?.message || "Failed to fetch Search Console data.");
      if (String(err?.message || "").includes("connect")) clearGscState();
    } finally {
      setIsLoading(false);
    }
  }, [
    accessToken,
    clearGscState,
    currentEnd,
    currentStart,
    fetchQueryPageRows,
    getValidAccessToken,
    previousEnd,
    previousStart,
    selectedSite,
    source,
  ]);

  useEffect(() => {
    if (selectedSite && accessToken) {
      fetchAllData({ onSuccess: onAutoFetchSuccessRef.current });
    }
  }, [selectedSite, accessToken, fetchAllData]);

  return {
    accessToken,
    currentEnd,
    currentRows,
    currentStart,
    customEndDate,
    customStartDate,
    datePreset,
    datePresets: DATE_PRESETS,
    error,
    fetchAllData,
    gscEmail,
    handleSignIn,
    handleSignOut,
    isCheckingConnection,
    isLoading,
    isSignedIn,
    previousEnd,
    previousRows,
    previousStart,
    redirectUri: getGoogleRedirectUri(),
    selectedSite,
    setCustomEndDate,
    setCustomStartDate,
    setDatePreset,
    setError,
    setSelectedSite,
    sites,
  };
}
