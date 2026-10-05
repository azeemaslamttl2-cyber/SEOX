import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import {
  clearStoredGscSession,
  ensureValidGscSession,
  readStoredGscSession,
  restoreGscSession,
} from "../lib/gscSession.js";
import { getGoogleRedirectUri, getGscAuthUrl } from "../lib/googleOAuthConfig.js";
import {
  buildCannibalization,
  buildCtrByPosition,
  buildDeviceRows,
  buildKeywordRows,
  buildLowHangingFruit,
  buildPageRows,
  buildPositionBuckets,
  buildRequestBody,
  buildSiteSummary,
} from "../lib/gscInsightsCore.js";

export const GSC_DATE_PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "28", label: "Last 28 days", days: 28 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "180", label: "Last 6 months", days: 180 },
  { id: "365", label: "Last 12 months", days: 365 },
];

export const GSC_SEARCH_TYPE_OPTIONS = ["Web", "Image", "Video", "News"];
export const GSC_DEVICE_OPTIONS = ["All", "Desktop", "Mobile", "Tablet"];
export const GSC_LOCATION_OPTIONS = ["All locations"];

const EMPTY_SELECTED_DATA = {
  summary: null,
  dailyData: [],
  keywords: [],
  pages: [],
  devices: [],
  lowHangingFruit: [],
  cannibalization: [],
  positionBuckets: [],
  ctrByPosition: [],
  queryRows: [],
  pageRows: [],
  queryPageRows: [],
};

const GscInsightsContext = createContext(null);

function getUserId(user) {
  return user?.uid || user?.id || "";
}


function encodeSiteId(siteUrl) {
  if (!siteUrl || typeof btoa !== "function") return "";
  const bytes = new TextEncoder().encode(siteUrl);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function siteUrlFromId(siteId) {
  if (!siteId || typeof atob !== "function") return "";
  try {
    const base64 = siteId.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function siteIdFromUrl(siteUrl) {
  return encodeSiteId(siteUrl);
}

function getSiteDomain(siteUrl) {
  if (!siteUrl) return "Unknown property";
  if (siteUrl.startsWith("sc-domain:")) return siteUrl.replace("sc-domain:", "");

  try {
    return new URL(siteUrl).hostname.replace(/^www\./i, "");
  } catch {
    return siteUrl.replace(/^https?:\/\//i, "").replace(/\/$/g, "");
  }
}

function normalizeSite(entry) {
  const siteUrl = entry?.siteUrl || "";
  const domain = getSiteDomain(siteUrl);
  const permissionLevel = entry?.permissionLevel || "";
  return {
    id: siteIdFromUrl(siteUrl),
    siteUrl,
    url: siteUrl,
    name: domain,
    domain,
    permissionLevel,
    verified: !/unverified/i.test(permissionLevel),
  };
}


async function fetchSearchAnalytics(accessToken, siteUrl, body) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      siteUrl
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || `Search Console request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data.rows || [];
}


/**
 * Session cache for the site list and the per-site summaries.
 *
 * GscInsightsProvider is mounted by GscLayout, so leaving the /gsc section
 * unmounts it and every piece of state goes with it - returning meant
 * refetching the site list and all summaries from Google. These belong to the
 * signed-in Google account rather than to a project, so they live here rather
 * than in projectDataStore, and are cleared whenever the connection is.
 *
 * Navigating between /gsc sub-pages was never affected: the layout stays
 * mounted, so this only helps re-entry into the section.
 */
const GSC_SESSION_TTL_MS = 15 * 60 * 1000;
const gscSessionCache = { key: '', sites: null, summaries: null, at: 0 };

function readGscCache(key) {
  if (!key || gscSessionCache.key !== key) return null;
  if (Date.now() - gscSessionCache.at >= GSC_SESSION_TTL_MS) return null;
  return gscSessionCache;
}

function writeGscCache(key, patch) {
  if (!key) return;
  if (gscSessionCache.key !== key) {
    gscSessionCache.key = key;
    gscSessionCache.sites = null;
    gscSessionCache.summaries = null;
  }
  Object.assign(gscSessionCache, patch, { at: Date.now() });
}

function clearGscCache() {
  gscSessionCache.key = '';
  gscSessionCache.sites = null;
  gscSessionCache.summaries = null;
  gscSessionCache.at = 0;
}

export function GscInsightsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const userId = getUserId(user);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [gscEmail, setGscEmail] = useState(null);
  // Seeded from the session cache so re-entering /gsc renders what it had.
  const [sites, setSites] = useState(() => readGscCache(getUserId(user))?.sites || []);
  const [selectedSite, setSelectedSite] = useState("");
  const [siteSummaries, setSiteSummaries] = useState(
    () => readGscCache(getUserId(user))?.summaries || []
  );
  const [selectedData, setSelectedData] = useState(EMPTY_SELECTED_DATA);
  const [datePreset, setDatePreset] = useState("90");
  const [searchType, setSearchType] = useState("Web");
  const [device, setDevice] = useState("All");
  const [error, setError] = useState("");
  const [isStartingConnection, setIsStartingConnection] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);
  const lastSilentRestoreRef = useRef(0);
  const restoreRequestRef = useRef(0);
  const sitesRequestRef = useRef(0);
  const summariesRequestRef = useRef(0);
  const selectedRequestRef = useRef(0);

  const selectedPreset =
    GSC_DATE_PRESETS.find((preset) => preset.id === datePreset) || GSC_DATE_PRESETS[3];

  const currentEnd = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }, [datePreset]);

  const currentStart = useMemo(() => {
    const date = new Date(currentEnd);
    date.setDate(date.getDate() - selectedPreset.days + 1);
    return date;
  }, [currentEnd, selectedPreset.days]);

  const previousEnd = useMemo(() => {
    const date = new Date(currentStart);
    date.setDate(date.getDate() - 1);
    return date;
  }, [currentStart]);

  const previousStart = useMemo(() => {
    const date = new Date(previousEnd);
    date.setDate(date.getDate() - selectedPreset.days + 1);
    return date;
  }, [previousEnd, selectedPreset.days]);

  const normalizedSites = useMemo(() => sites.map(normalizeSite).filter((site) => site.siteUrl), [sites]);
  const selectedSiteId = selectedSite ? siteIdFromUrl(selectedSite) : "";
  const selectedSiteInfo =
    normalizedSites.find((site) => site.siteUrl === selectedSite) || null;

  const applyGscSession = useCallback((session) => {
    if (!session?.accessToken) return;
    setAccessToken(session.accessToken);
    setIsSignedIn(true);
    setGscEmail(session.googleEmail || null);
  }, []);

  const clearGscState = useCallback(() => {
    clearStoredGscSession();
    // Disconnecting must not leave a readable copy behind.
    clearGscCache();
    setAccessToken(null);
    setIsSignedIn(false);
    setGscEmail(null);
    setSites([]);
    setSelectedSite("");
    setSiteSummaries([]);
    setSelectedData(EMPTY_SELECTED_DATA);
  }, []);

  const restoreConnection = useCallback(
    async ({ silent = false } = {}) => {
      if (authLoading) {
        if (!silent) setIsCheckingConnection(true);
        return;
      }

      const requestId = restoreRequestRef.current + 1;
      restoreRequestRef.current = requestId;

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
        if (restoreRequestRef.current !== requestId) return;
        if (session?.connected && session.accessToken) {
          applyGscSession(session);
        } else {
          clearGscState();
        }
      } catch (err) {
        if (restoreRequestRef.current !== requestId) return;
        setError(err?.message || "Could not restore Search Console connection.");
        clearGscState();
      } finally {
        if (!silent && restoreRequestRef.current === requestId) setIsCheckingConnection(false);
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

  const handleSignIn = useCallback(async () => {
    if (!userId) {
      setError("Please log in before connecting Search Console.");
      return;
    }

    setIsStartingConnection(true);
    setError("");
    try {
      window.location.href = await getGscAuthUrl({
        source: "gsc-insights",
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
    } catch (err) {
      setError(err?.message || "Could not start Google OAuth.");
      setIsStartingConnection(false);
    }
  }, [userId]);

  const handleSignOut = useCallback(async () => {
    if (userId) {
      try {
        const token = await user.getIdToken();
        await fetch("/api/gsc-token", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "disconnect", userId }),
        });
      } catch {
        // Local cleanup still makes the UI honest if the server call fails.
      }
    }
    clearGscState();
  }, [clearGscState, user, userId]);

  const fetchSites = useCallback(async () => {
    if (!accessToken) return;
    const requestId = sitesRequestRef.current + 1;
    sitesRequestRef.current = requestId;
    setIsLoadingSites(true);
    setError("");

    try {
      const token = await getValidAccessToken();
      const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const err = new Error(
          data?.error?.message || `Failed to fetch Search Console sites (${response.status}).`
        );
        err.status = response.status;
        throw err;
      }

      if (sitesRequestRef.current !== requestId) return;
      const entries = data.siteEntry || [];
      writeGscCache(userId, { sites: entries });
      setSites(entries);
      setSelectedSite((current) => {
        const hasCurrent = entries.some((entry) => entry.siteUrl === current);
        return hasCurrent ? current : entries[0]?.siteUrl || "";
      });
    } catch (err) {
      if (sitesRequestRef.current !== requestId) return;
      setError(err?.message || "Failed to fetch Search Console sites.");
      if (err?.status === 401 || String(err?.message || "").includes("connect")) {
        clearGscState();
      }
    } finally {
      if (sitesRequestRef.current === requestId) setIsLoadingSites(false);
    }
  }, [accessToken, clearGscState, getValidAccessToken, userId]);

  const fetchSiteSummaries = useCallback(async () => {
    if (!accessToken || normalizedSites.length === 0) {
      setSiteSummaries([]);
      return;
    }

    const requestId = summariesRequestRef.current + 1;
    summariesRequestRef.current = requestId;
    setIsLoadingSummaries(true);
    setError("");

    // Capture current sites to avoid race condition if normalizedSites changes during fetch
    const sitesToFetch = normalizedSites;

    try {
      const token = await getValidAccessToken();
      const results = await Promise.allSettled(
        sitesToFetch.map(async (site) => {
          const base = {
            searchType,
            device,
            dimensions: ["date"],
            rowLimit: 1000,
          };
          const [currentRows, previousRows] = await Promise.all([
            fetchSearchAnalytics(
              token,
              site.siteUrl,
              buildRequestBody({
                ...base,
                startDate: currentStart,
                endDate: currentEnd,
              })
            ),
            fetchSearchAnalytics(
              token,
              site.siteUrl,
              buildRequestBody({
                ...base,
                startDate: previousStart,
                endDate: previousEnd,
              })
            ),
          ]);

          return buildSiteSummary(site, currentRows, previousRows);
        })
      );

      if (summariesRequestRef.current !== requestId) return;

      const summaries = results.map((result, index) =>
        result.status === "fulfilled"
          ? result.value
          : buildSiteSummary(sitesToFetch[index], [], [])
      );
      writeGscCache(userId, { summaries });
      setSiteSummaries(summaries);

      const rejected = results.find((result) => result.status === "rejected");
      if (rejected) {
        const message =
          rejected.reason?.message ||
          "Some Search Console properties could not be loaded.";
        setError(message);
      }
    } catch (err) {
      if (summariesRequestRef.current !== requestId) return;
      setError(err?.message || "Failed to load Search Console performance.");
      if (err?.status === 401 || String(err?.message || "").includes("connect")) {
        clearGscState();
      }
    } finally {
      if (summariesRequestRef.current === requestId) setIsLoadingSummaries(false);
    }
  }, [
    accessToken,
    clearGscState,
    currentEnd,
    currentStart,
    device,
    getValidAccessToken,
    normalizedSites,
    previousEnd,
    previousStart,
    searchType,
    userId,
  ]);

  const fetchSelectedData = useCallback(async () => {
    if (!accessToken || !selectedSite) {
      setSelectedData(EMPTY_SELECTED_DATA);
      return;
    }

    const requestId = selectedRequestRef.current + 1;
    selectedRequestRef.current = requestId;
    setIsLoadingSelected(true);
    setError("");

    try {
      const token = await getValidAccessToken();
      const base = { searchType, device };
      const [
        dailyRows,
        previousDailyRows,
        queryRows,
        previousQueryRows,
        pageRows,
        previousPageRows,
        queryPageRows,
        deviceRows,
      ] = await Promise.all([
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: ["date"],
            rowLimit: 1000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: previousStart,
            endDate: previousEnd,
            dimensions: ["date"],
            rowLimit: 1000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: ["query"],
            rowLimit: 25000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: previousStart,
            endDate: previousEnd,
            dimensions: ["query"],
            rowLimit: 25000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: ["page"],
            rowLimit: 25000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: previousStart,
            endDate: previousEnd,
            dimensions: ["page"],
            rowLimit: 25000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: ["query", "page"],
            rowLimit: 25000,
          })
        ),
        fetchSearchAnalytics(
          token,
          selectedSite,
          buildRequestBody({
            ...base,
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: ["device"],
            rowLimit: 50,
          })
        ),
      ]);

      if (selectedRequestRef.current !== requestId) return;

      const summary = buildSiteSummary(
        selectedSiteInfo || normalizeSite({ siteUrl: selectedSite }),
        dailyRows,
        previousDailyRows
      );
      const keywords = buildKeywordRows(queryRows, queryPageRows, previousQueryRows);
      const pages = buildPageRows(pageRows, queryPageRows, previousPageRows);

      setSelectedData({
        summary,
        dailyData: summary.dailyData,
        keywords,
        pages,
        devices: buildDeviceRows(deviceRows),
        lowHangingFruit: buildLowHangingFruit(keywords),
        cannibalization: buildCannibalization(queryPageRows),
        positionBuckets: buildPositionBuckets(keywords),
        ctrByPosition: buildCtrByPosition(keywords),
        queryRows,
        pageRows,
        queryPageRows,
      });
    } catch (err) {
      if (selectedRequestRef.current !== requestId) return;
      setError(err?.message || "Failed to load Search Console report.");
      setSelectedData(EMPTY_SELECTED_DATA);
      if (err?.status === 401 || String(err?.message || "").includes("connect")) {
        clearGscState();
      }
    } finally {
      if (selectedRequestRef.current === requestId) setIsLoadingSelected(false);
    }
  }, [
    accessToken,
    clearGscState,
    currentEnd,
    currentStart,
    device,
    getValidAccessToken,
    previousEnd,
    previousStart,
    searchType,
    selectedSite,
    selectedSiteInfo,
  ]);

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

  useEffect(() => {
    if (accessToken) fetchSites();
  }, [accessToken, fetchSites]);

  useEffect(() => {
    fetchSiteSummaries();
  }, [fetchSiteSummaries]);

  useEffect(() => {
    fetchSelectedData();
  }, [fetchSelectedData]);

  // Memoised: this object has 40 keys and was rebuilt on every provider render,
  // re-rendering all eight GSC consumers each time.
  const value = useMemo(() => ({
    accessToken,
    currentEnd,
    currentStart,
    datePreset,
    datePresets: GSC_DATE_PRESETS,
    device,
    deviceOptions: GSC_DEVICE_OPTIONS,
    error,
    fetchSelectedData,
    fetchSiteSummaries,
    fetchSites,
    gscEmail,
    handleSignIn,
    handleSignOut,
    isCheckingConnection,
    isLoading:
      isCheckingConnection || isLoadingSites || isLoadingSummaries || isLoadingSelected,
    isLoadingSelected,
    isLoadingSites,
    isLoadingSummaries,
    isStartingConnection,
    isSignedIn,
    locationOptions: GSC_LOCATION_OPTIONS,
    normalizedSites,
    previousEnd,
    previousStart,
    redirectUri: getGoogleRedirectUri(),
    searchType,
    searchTypeOptions: GSC_SEARCH_TYPE_OPTIONS,
    selectedData,
    selectedSite,
    selectedSiteId,
    selectedSiteInfo,
    setDatePreset,
    setDevice,
    setError,
    setSearchType,
    setSelectedSite,
    siteSummaries,
  }), [
    accessToken, currentEnd, currentStart, datePreset, device, error,
    fetchSelectedData, fetchSiteSummaries, fetchSites, gscEmail, handleSignIn,
    handleSignOut, isCheckingConnection, isLoadingSelected, isLoadingSites,
    isLoadingSummaries, isStartingConnection, isSignedIn, normalizedSites,
    previousEnd, previousStart, searchType, selectedData, selectedSite,
    selectedSiteId, selectedSiteInfo, setDatePreset, setDevice, setError,
    setSearchType, setSelectedSite, siteSummaries,
  ]);

  return (
    <GscInsightsContext.Provider value={value}>
      {children}
    </GscInsightsContext.Provider>
  );
}

export function useGscInsights() {
  const value = useContext(GscInsightsContext);
  if (!value) {
    throw new Error("useGscInsights must be used within GscInsightsProvider");
  }
  return value;
}
