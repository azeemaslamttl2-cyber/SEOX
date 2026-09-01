import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  defaultProjects,
  normalizeProject,
  projectIdFor,
} from "../data/auditorData.js";
import {
  collectDiscoveredUrls,
  createCrawlSession,
  crawlResultToRow,
  enqueueDiscoveredUrls,
  errorToRow,
  fetchCrawlTarget,
  shouldParseForLinks,
  updateRobotsRules,
} from "../lib/siteCrawler.js";
import {
  buildFindingsFromCrawl,
  mergeIssueFindings,
  normalizeEvidenceUrl,
} from "../lib/auditIssues.js";
import {
  deleteCrawlProjectState,
  loadCrawlStorage,
  requestDurableCrawlStorage,
  saveCrawlMetadata,
  saveCrawlProjectStates,
} from "../lib/crawlStorage.js";
import {
  loadFirestoreProjects,
  saveFirestoreProjectWithMeta,
  deleteFirestoreProject,
  saveFirestoreMeta,
} from "../lib/firestoreProjects.js";
import { useAuth } from "./AuthContext.jsx";

const CrawlContext = createContext(null);

const MAX_LATEST = Infinity; // Store all crawled URLs for Page Explorer etc.
const TARGET_MAX = 1619; // mimics the reference: stops auto around this count
const CRAWL_CONCURRENCY = 3;
const CRAWL_PUMP_MS = 300;
const LS_PROJECT = "seox.crawl.project"; // legacy/current selected project
const LS_STATE = "seox.crawl.state"; // legacy/current selected state
const LS_PROJECTS = "seox.crawl.projects";
const LS_PROJECT_STATES = "seox.crawl.projectStates";
const LS_SELECTED_PROJECT = "seox.crawl.selectedProjectId";
const LS_DELETED_PROJECTS = "seox.crawl.deletedProjectIds";
const STATE_FLUSH_MS = 750;
const MOCK_PROJECT_IDS = new Set([
  "ai-smart-seo",
  "ai-smart-seo-com",
  "atlas-commerce",
  "scaxa-ae",
  "aismartseo-com",
]);
const MOCK_PROJECT_HOSTS = new Set([
  "aismartseo.com",
  "www.aismartseo.com",
  "atlascommerce.com",
  "www.atlascommerce.com",
  "scaxa.ae",
  "www.scaxa.ae",
  "app.aismartseo.com",
  "www.app.aismartseo.com",
]);

const emptyStats = () => ({
  crawledCount: 0,
  scheduled: 0,
  duration: 0, // seconds
  startedAt: null,
  finishedAt: null,
  perMinute: [], // [{ minute, total, byStatus }]
  byStatus: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
  latestUrls: [],
  auditIssues: {},
});

const emptyProjectState = () => ({
  status: "idle",
  stats: emptyStats(),
});

/* ---------------- localStorage helpers ---------------- */

function reviveDates(obj) {
  if (!obj) return obj;
  if (obj.startedAt) obj.startedAt = new Date(obj.startedAt);
  if (obj.finishedAt) obj.finishedAt = new Date(obj.finishedAt);
  if (Array.isArray(obj.latestUrls)) {
    obj.latestUrls = obj.latestUrls.map((u) => ({
      ...u,
      time: u.time ? new Date(u.time) : new Date(),
    }));
  }
  if (!obj.auditIssues) obj.auditIssues = {};
  return obj;
}

function reviveProjectState(raw) {
  const state = raw || emptyProjectState();
  const status = state.status === "crawling" ? "complete" : state.status || "idle";
  const storedStats = state.stats || {};
  const stats = reviveDates({
    ...emptyStats(),
    ...storedStats,
    byStatus: {
      ...emptyStats().byStatus,
      ...(storedStats.byStatus || {}),
    },
    perMinute: Array.isArray(storedStats.perMinute) ? storedStats.perMinute : [],
    latestUrls: Array.isArray(storedStats.latestUrls) ? storedStats.latestUrls : [],
    auditIssues: storedStats.auditIssues || {},
  });
  return {
    status,
    stats:
      status === "complete" && stats.startedAt && !stats.finishedAt
        ? { ...stats, finishedAt: new Date() }
        : stats,
  };
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function mergeProjects(...lists) {
  const map = new Map();
  lists
    .flat()
    .filter(Boolean)
    .map(normalizeProject)
    .forEach((item) => {
      map.set(projectIdFor(item), item);
    });
  return Array.from(map.values());
}

function isMockProject(item) {
  const id = projectIdFor(item);
  if (item?.createdAt || String(id).startsWith("proj_")) return false;
  const host = String(item?.domain || item?.fullUrl || item?.name || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return MOCK_PROJECT_IDS.has(id) || MOCK_PROJECT_HOSTS.has(host);
}

function loadInitial() {
  const persistedProjects = readJson(LS_PROJECTS, []);
  const legacyProject = readJson(LS_PROJECT, null);
  const deletedProjectIds = readJson(LS_DELETED_PROJECTS, []);
  const deleted = new Set(deletedProjectIds);
  const projects = mergeProjects(defaultProjects, persistedProjects, legacyProject).filter(
    (item) => !deleted.has(item.id) && !isMockProject(item)
  );
  const availableProjectIds = new Set(projects.map((item) => item.id));

  const firstProjectId = projects[0]?.id || null;
  const savedSelectedProjectId = readJson(LS_SELECTED_PROJECT, null);
  const legacyProjectId = legacyProject ? projectIdFor(legacyProject) : null;
  const selectedProjectId =
    (savedSelectedProjectId && availableProjectIds.has(savedSelectedProjectId)
      ? savedSelectedProjectId
      : null) ||
    (legacyProjectId && availableProjectIds.has(legacyProjectId)
      ? legacyProjectId
      : firstProjectId);

  const persistedStates = readJson(LS_PROJECT_STATES, {});
  const projectStates = Object.fromEntries(
    Object.entries(persistedStates || {}).map(([id, state]) => [
      id,
      reviveProjectState(state),
    ])
  );

  const legacyState = readJson(LS_STATE, null);
  if (legacyProject && legacyState) {
    const legacyProjectId = projectIdFor(legacyProject);
    if (!projectStates[legacyProjectId]) {
      projectStates[legacyProjectId] = reviveProjectState(legacyState);
    }
  }

  return { projects, selectedProjectId, projectStates, deletedProjectIds };
}

function getProjectState(states, projectId) {
  if (!projectId) return emptyProjectState();
  return states[projectId] || emptyProjectState();
}

function mergeCrawlRow(stats, row, scheduled, findings = []) {
  const bucket = row.status > 0 ? `${Math.floor(row.status / 100)}xx` : "5xx";
  const byStatus = {
    ...stats.byStatus,
    [bucket]: (stats.byStatus[bucket] || 0) + 1,
  };
  const duration = stats.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(stats.startedAt).getTime()) / 1000))
    : stats.duration;
  const minute = Math.floor(duration / 5);
  const burstByStatus = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  burstByStatus[bucket] = 1;

  let perMinute;
  if (
    stats.perMinute.length &&
    stats.perMinute[stats.perMinute.length - 1].minute === minute
  ) {
    const lastIdx = stats.perMinute.length - 1;
    const last = stats.perMinute[lastIdx];
    perMinute = [
      ...stats.perMinute.slice(0, lastIdx),
      {
        minute,
        total: last.total + 1,
        byStatus: {
          ...last.byStatus,
          [bucket]: (last.byStatus[bucket] || 0) + 1,
        },
      },
    ];
  } else {
    perMinute = [
      ...stats.perMinute,
      { minute, total: 1, byStatus: burstByStatus },
    ];
  }

  const nextStats = {
    ...stats,
    duration,
    crawledCount: stats.crawledCount + 1,
    scheduled,
    perMinute,
    byStatus,
    latestUrls: [row, ...stats.latestUrls].slice(0, MAX_LATEST),
  };
  return mergeIssueFindings(nextStats, findings);
}

/* ---------------- Provider ---------------- */

export function CrawlProvider({ children }) {
  const { user } = useAuth();
  const authUserId = user?.uid || null;
  const uidRef = useRef(authUserId);
  uidRef.current = authUserId;
  const initial = useMemo(loadInitial, []);
  const [projects, setProjects] = useState(initial.projects);
  const [selectedProjectId, setSelectedProjectId] = useState(initial.selectedProjectId);
  const [projectStates, setProjectStates] = useState(initial.projectStates);
  const [deletedProjectIds, setDeletedProjectIds] = useState(initial.deletedProjectIds);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const crawlerSessionsRef = useRef({});
  const latestProjectsRef = useRef(initial.projects);
  const latestSelectedProjectIdRef = useRef(initial.selectedProjectId);
  const latestDeletedProjectIdsRef = useRef(initial.deletedProjectIds);
  const latestProjectStatesRef = useRef(initial.projectStates);
  const observedProjectStatesRef = useRef(initial.projectStates);
  const dirtyProjectStatesRef = useRef(new Map());
  const stateFlushTimerRef = useRef(null);
  const stateWriteChainRef = useRef(Promise.resolve());

  const persistMetadataFallback = useCallback((nextProjects, nextSelectedProjectId, nextDeletedProjectIds) => {
    const writeMetadata = () => {
      localStorage.setItem(LS_PROJECTS, JSON.stringify(nextProjects));
      localStorage.setItem(LS_DELETED_PROJECTS, JSON.stringify(nextDeletedProjectIds));
      if (nextSelectedProjectId) {
        localStorage.setItem(LS_SELECTED_PROJECT, JSON.stringify(nextSelectedProjectId));
        const selected = nextProjects.find((item) => item.id === nextSelectedProjectId);
        if (selected) localStorage.setItem(LS_PROJECT, JSON.stringify(selected));
      } else {
        localStorage.removeItem(LS_SELECTED_PROJECT);
        localStorage.removeItem(LS_PROJECT);
      }
    };

    try {
      writeMetadata();
    } catch {
      try {
        // Older builds stored full crawl state in localStorage. If that stale
        // payload fills quota, clear it and retry only the lightweight metadata
        // needed to restore the project picker after refresh.
        localStorage.removeItem(LS_PROJECT_STATES);
        localStorage.removeItem(LS_STATE);
        writeMetadata();
      } catch {
        /* localStorage is only the fast fallback; IndexedDB remains primary. */
      }
    }
  }, []);

  const persistLegacyProjectStates = useCallback((states) => {
    try {
      localStorage.setItem(LS_PROJECT_STATES, JSON.stringify(states));
    } catch {
      // IndexedDB is the primary store because full audits exceed localStorage quotas.
    }
  }, []);

  const flushProjectStateWrites = useCallback(() => {
    if (stateFlushTimerRef.current) {
      clearTimeout(stateFlushTimerRef.current);
      stateFlushTimerRef.current = null;
    }

    const entries = Array.from(dirtyProjectStatesRef.current.entries());
    dirtyProjectStatesRef.current.clear();
    if (!entries.length) return stateWriteChainRef.current;

    stateWriteChainRef.current = stateWriteChainRef.current
      .catch(() => undefined)
      .then(() => saveCrawlProjectStates(entries))
      .then(() => {
        setStorageError(null);
        try {
          localStorage.removeItem(LS_PROJECT_STATES);
          localStorage.removeItem(LS_STATE);
        } catch {
          // The durable write already succeeded.
        }
      })
      .catch((error) => {
        persistLegacyProjectStates(latestProjectStatesRef.current);
        setStorageError(error);
      });

    return stateWriteChainRef.current;
  }, [persistLegacyProjectStates]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        // Load from IndexedDB
        const stored = await loadCrawlStorage();
        if (cancelled) return;

        // Load from Firestore (non-blocking — if it fails we just skip)
        let firestoreData = { projects: [], selectedProjectId: null, deletedProjectIds: [] };
        try {
          if (authUserId) {
            firestoreData = await loadFirestoreProjects(authUserId);
          }
        } catch {
          // Firestore unavailable — continue with local data only
        }
        if (cancelled) return;

        const storedMetadata = stored.metadata || {};
        const currentProjects = latestProjectsRef.current || initial.projects;
        const currentSelectedProjectId =
          latestSelectedProjectIdRef.current || initial.selectedProjectId;
        const currentDeletedProjectIds =
          latestDeletedProjectIdsRef.current || initial.deletedProjectIds;
        const currentProjectStates =
          latestProjectStatesRef.current || initial.projectStates;
        const hasRuntimeProjectStateChanges =
          currentProjectStates !== initial.projectStates;
        const restoredDeletedProjectIds = Array.from(
          new Set([
            ...initial.deletedProjectIds,
            ...currentDeletedProjectIds,
            ...(storedMetadata.deletedProjectIds || []),
            ...(firestoreData.deletedProjectIds || []),
          ])
        );
        const deleted = new Set(restoredDeletedProjectIds);
        const restoredProjects = mergeProjects(
          defaultProjects,
          initial.projects,
          storedMetadata.projects || [],
          firestoreData.projects || [],
          currentProjects
        ).filter((item) => !deleted.has(item.id) && !isMockProject(item));
        const availableProjectIds = new Set(restoredProjects.map((item) => item.id));
        const restoredSelectedProjectId =
          (currentSelectedProjectId &&
          availableProjectIds.has(currentSelectedProjectId)
            ? currentSelectedProjectId
            : null) ||
          (storedMetadata.selectedProjectId &&
          availableProjectIds.has(storedMetadata.selectedProjectId)
            ? storedMetadata.selectedProjectId
            : null) ||
          (initial.selectedProjectId &&
          availableProjectIds.has(initial.selectedProjectId)
            ? initial.selectedProjectId
            : null) ||
          restoredProjects[0]?.id ||
          null;
        const restoredProjectStates = Object.fromEntries(
          Object.entries(stored.projectStates || {})
            .filter(([id]) => availableProjectIds.has(id))
            .map(([id, state]) => [id, reviveProjectState(state)])
        );
        const mergedProjectStates = {
          ...initial.projectStates,
          ...restoredProjectStates,
          ...(hasRuntimeProjectStateChanges ? currentProjectStates : {}),
        };

        Object.entries(mergedProjectStates).forEach(([id, state]) => {
          if (!stored.projectStates?.[id]) {
            dirtyProjectStatesRef.current.set(id, state);
          }
        });

        latestProjectsRef.current = restoredProjects;
        latestSelectedProjectIdRef.current = restoredSelectedProjectId;
        latestDeletedProjectIdsRef.current = restoredDeletedProjectIds;
        latestProjectStatesRef.current = mergedProjectStates;
        observedProjectStatesRef.current = mergedProjectStates;
        persistMetadataFallback(
          restoredProjects,
          restoredSelectedProjectId,
          restoredDeletedProjectIds
        );
        setProjects(restoredProjects);
        setSelectedProjectId(restoredSelectedProjectId);
        setDeletedProjectIds(restoredDeletedProjectIds);
        setProjectStates(mergedProjectStates);
        void requestDurableCrawlStorage();
      } catch (error) {
        if (!cancelled) setStorageError(error);
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [authUserId, initial, persistMetadataFallback]);

  const project = useMemo(() => {
    return (
      projects.find((item) => item.id === selectedProjectId) ||
      projects[0] ||
      null
    );
  }, [projects, selectedProjectId]);

  const selectedState = useMemo(
    () => getProjectState(projectStates, project?.id),
    [project, projectStates]
  );
  const status = selectedState.status;
  const stats = selectedState.stats;

  useEffect(() => {
    latestProjectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    latestSelectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    latestDeletedProjectIdsRef.current = deletedProjectIds;
  }, [deletedProjectIds]);

  useEffect(() => {
    latestProjectStatesRef.current = projectStates;
  }, [projectStates]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    } catch {
      /* ignore quota errors */
    }
  }, [projects]);

  useEffect(() => {
    if (!storageReady) return;

    saveCrawlMetadata({
      projects,
      selectedProjectId: project?.id || null,
      deletedProjectIds,
    }).catch((error) => setStorageError(error));
  }, [deletedProjectIds, project, projects, storageReady]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DELETED_PROJECTS, JSON.stringify(deletedProjectIds));
    } catch {
      /* ignore quota errors */
    }
  }, [deletedProjectIds]);

  useEffect(() => {
    try {
      if (project) {
        localStorage.setItem(LS_SELECTED_PROJECT, JSON.stringify(project.id));
        localStorage.setItem(LS_PROJECT, JSON.stringify(project));
      } else {
        localStorage.removeItem(LS_SELECTED_PROJECT);
        localStorage.removeItem(LS_PROJECT);
      }
    } catch {
      /* ignore quota errors */
    }
  }, [project]);

  useEffect(() => {
    if (!storageReady) {
      observedProjectStatesRef.current = projectStates;
      return;
    }

    const previousStates = observedProjectStatesRef.current;
    Object.entries(projectStates).forEach(([id, state]) => {
      if (previousStates[id] !== state) {
        dirtyProjectStatesRef.current.set(id, state);
      }
    });
    observedProjectStatesRef.current = projectStates;

    if (dirtyProjectStatesRef.current.size && !stateFlushTimerRef.current) {
      stateFlushTimerRef.current = setTimeout(
        flushProjectStateWrites,
        STATE_FLUSH_MS
      );
    }
  }, [flushProjectStateWrites, projectStates, storageReady]);

  useEffect(() => {
    if (!storageReady) return;

    const flushBeforeExit = () => {
      Object.entries(latestProjectStatesRef.current).forEach(([id, state]) => {
        if (observedProjectStatesRef.current[id] !== state) {
          dirtyProjectStatesRef.current.set(id, state);
        }
      });
      flushProjectStateWrites();
    };

    window.addEventListener("pagehide", flushBeforeExit);
    document.addEventListener("visibilitychange", flushBeforeExit);
    return () => {
      window.removeEventListener("pagehide", flushBeforeExit);
      document.removeEventListener("visibilitychange", flushBeforeExit);
      flushBeforeExit();
    };
  }, [flushProjectStateWrites, storageReady]);

  // Keep the visible duration/scheduled count moving while real network requests run.
  useEffect(() => {
    if (!project || status !== "crawling") return;

    const id = setInterval(() => {
      setProjectStates((states) => {
        const current = getProjectState(states, project.id);
        const session = crawlerSessionsRef.current[project.id];
        const startedAt = current.stats.startedAt;
        const duration = startedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
          : current.stats.duration;
        return {
          ...states,
          [project.id]: {
            ...current,
            stats: {
              ...current.stats,
              duration,
              scheduled: session
                ? Math.max(0, session.queue.length + session.inFlight)
                : current.stats.scheduled,
            },
          },
        };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [status, project]);

  // Real crawler: fetches pages through the local Vite crawler endpoint, parses
  // discovered URLs, and only streams URLs actually found on the selected site.
  useEffect(() => {
    if (!project || status !== "crawling") return;

    let cancelled = false;
    const projectId = project.id;
    const maxUrls = Math.max(1, project.urlLimit || TARGET_MAX);

    const ensureSession = () => {
      if (!crawlerSessionsRef.current[projectId]) {
        crawlerSessionsRef.current[projectId] = createCrawlSession(project);
      }
      return crawlerSessionsRef.current[projectId];
    };

    const updateScheduled = (session) => {
      if (cancelled) return;

      setProjectStates((states) => {
        const current = getProjectState(states, projectId);
        return {
          ...states,
          [projectId]: {
            ...current,
            stats: {
              ...current.stats,
              scheduled: Math.max(0, session.queue.length + session.inFlight),
            },
          },
        };
      });
    };

    const recordRow = (row, session, findings = []) => {
      if (cancelled) return;

      setProjectStates((states) => {
        const current = getProjectState(states, projectId);
        return {
          ...states,
          [projectId]: {
            ...current,
            stats: mergeCrawlRow(
              current.stats,
              row,
              Math.max(0, session.queue.length + session.inFlight),
              findings
            ),
          },
        };
      });
    };

    const finishIfDrained = (session) => {
      if (cancelled) return true;
      if (session.queue.length > 0 || session.inFlight > 0) return false;
      setProjectStates((states) => {
        const current = getProjectState(states, projectId);
        if (current.status !== "crawling") return states;
        return {
          ...states,
          [projectId]: {
            status: "complete",
            stats: {
              ...current.stats,
              scheduled: 0,
              finishedAt: new Date(),
            },
          },
        };
      });
      return true;
    };

    const crawlOne = async (url, session) => {
      try {
        const result = await fetchCrawlTarget(url);
        updateRobotsRules(session, result);
        if (
          String(result.contentType || "").toLowerCase().includes("xml") ||
          /sitemap/i.test(result.url || result.finalUrl || url)
        ) {
          (result.links || []).forEach((item) =>
            session.sitemapUrls.add(normalizeEvidenceUrl(typeof item === "string" ? item : item?.url))
          );
        }

        if (shouldParseForLinks(result.contentType)) {
          enqueueDiscoveredUrls(
            session,
            project,
            collectDiscoveredUrls(result),
            maxUrls
          );
        }

        const row = crawlResultToRow(result, session);
        recordRow(row, session, buildFindingsFromCrawl(result, row, session));
      } catch (error) {
        const row = errorToRow(url, error, session);
        recordRow(
          row,
          session,
          buildFindingsFromCrawl(
            { url, finalUrl: url, status: 0, contentType: row.contentType, audit: {} },
            row,
            session
          )
        );
      }
    };

    const pump = () => {
      if (cancelled) return;
      const session = ensureSession();

      while (
        session.inFlight < CRAWL_CONCURRENCY &&
        session.queue.length > 0
      ) {
        const next = session.queue.shift();
        session.inFlight += 1;
        crawlOne(next, session).finally(() => {
          session.inFlight -= 1;
          updateScheduled(session);
          if (!cancelled) window.setTimeout(pump, CRAWL_PUMP_MS);
        });
      }

      updateScheduled(session);
      if (!finishIfDrained(session)) {
        window.setTimeout(pump, CRAWL_PUMP_MS);
      }
    };

    pump();

    return () => {
      cancelled = true;
    };
  }, [status, project]);

  const upsertProject = useCallback((nextProject, { requireOnline = false, skipOnline = false } = {}) => {
    const normalized = normalizeProject(nextProject);
    const previousProjects = latestProjectsRef.current;
    const previousSelectedProjectId = latestSelectedProjectIdRef.current;
    const previousDeletedProjectIds = latestDeletedProjectIdsRef.current;
    const nextDeletedProjectIds = latestDeletedProjectIdsRef.current.filter(
      (id) => id !== normalized.id
    );
    const nextProjects = mergeProjects(latestProjectsRef.current, normalized);
    const metadata = {
      projects: nextProjects,
      selectedProjectId: normalized.id,
      deletedProjectIds: nextDeletedProjectIds,
    };
    const previousMetadata = {
      projects: previousProjects,
      selectedProjectId: previousSelectedProjectId,
      deletedProjectIds: previousDeletedProjectIds,
    };

    latestProjectsRef.current = nextProjects;
    latestSelectedProjectIdRef.current = normalized.id;
    latestDeletedProjectIdsRef.current = nextDeletedProjectIds;
    persistMetadataFallback(nextProjects, normalized.id, nextDeletedProjectIds);

    // Eagerly persist to IndexedDB so the project survives refresh even if
    // the storageReady-gated effect hasn't fired yet.
    const durableWrite = saveCrawlMetadata(metadata)
      .then(() => {
        setStorageError(null);
        return true;
      })
      .catch((error) => {
        setStorageError(error);
        return false;
      });

    const uid = uidRef.current;
    const onlineWrite = skipOnline
      ? Promise.resolve(false)
      : uid
      ? saveFirestoreProjectWithMeta(uid, normalized, {
        selectedProjectId: normalized.id,
        deletedProjectIds: nextDeletedProjectIds,
      })
        .then(() => {
          setStorageError(null);
          return true;
        })
        .catch((error) => {
          setStorageError(error);
          if (requireOnline) throw error;
          return false;
        })
      : requireOnline
      ? Promise.reject(new Error("Sign in is required to save this project online."))
      : Promise.resolve(false);

    const rollback = () => {
      latestProjectsRef.current = previousProjects;
      latestSelectedProjectIdRef.current = previousSelectedProjectId;
      latestDeletedProjectIdsRef.current = previousDeletedProjectIds;
      persistMetadataFallback(
        previousProjects,
        previousSelectedProjectId,
        previousDeletedProjectIds
      );
      saveCrawlMetadata(previousMetadata).catch(() => {
        /* localStorage fallback already written above */
      });
      setProjects(previousProjects);
      setDeletedProjectIds(previousDeletedProjectIds);
      setSelectedProjectId(previousSelectedProjectId);
    };

    setProjects(nextProjects);
    setDeletedProjectIds(nextDeletedProjectIds);
    setSelectedProjectId(normalized.id);
    return { project: normalized, durableWrite, onlineWrite, rollback };
  }, [persistMetadataFallback]);

  const selectProject = useCallback(
    (projectId) => {
      const currentProjects = latestProjectsRef.current;
      if (currentProjects.some((item) => item.id === projectId)) {
        latestSelectedProjectIdRef.current = projectId;
        persistMetadataFallback(
          currentProjects,
          projectId,
          latestDeletedProjectIdsRef.current
        );
        setSelectedProjectId(projectId);

        // Persist selection to Firestore
        const uid = uidRef.current;
        if (uid) {
          saveFirestoreMeta(uid, {
            selectedProjectId: projectId,
            deletedProjectIds: latestDeletedProjectIdsRef.current,
          }).catch(() => {});
        }
      }
    },
    [persistMetadataFallback]
  );

  const deleteProject = useCallback(
    (projectId) => {
      const currentProjects = latestProjectsRef.current;
      const remaining = currentProjects.filter((item) => item.id !== projectId);
      if (remaining.length === currentProjects.length) return currentProjects.length;
      const nextSelectedProjectId =
        latestSelectedProjectIdRef.current === projectId
          ? remaining[0]?.id || null
          : remaining.some((item) => item.id === latestSelectedProjectIdRef.current)
          ? latestSelectedProjectIdRef.current
          : remaining[0]?.id || null;
      const nextDeletedProjectIds = latestDeletedProjectIdsRef.current.includes(projectId)
        ? latestDeletedProjectIdsRef.current
        : [...latestDeletedProjectIdsRef.current, projectId];

      latestProjectsRef.current = remaining;
      latestSelectedProjectIdRef.current = nextSelectedProjectId;
      latestDeletedProjectIdsRef.current = nextDeletedProjectIds;
      persistMetadataFallback(remaining, nextSelectedProjectId, nextDeletedProjectIds);
      saveCrawlMetadata({
        projects: remaining,
        selectedProjectId: nextSelectedProjectId,
        deletedProjectIds: nextDeletedProjectIds,
      }).catch(() => { /* localStorage fallback already written */ });

      // Persist to Firestore (fire-and-forget)
      const uid = uidRef.current;
      if (uid) {
        deleteFirestoreProject(uid, projectId).catch(() => {});
        saveFirestoreMeta(uid, {
          selectedProjectId: nextSelectedProjectId,
          deletedProjectIds: nextDeletedProjectIds,
        }).catch(() => {});
      }

      setProjects(remaining);
      setSelectedProjectId(nextSelectedProjectId);
      delete crawlerSessionsRef.current[projectId];
      dirtyProjectStatesRef.current.delete(projectId);
      deleteCrawlProjectState(projectId).catch((error) => setStorageError(error));
      setProjectStates((states) => {
        const { [projectId]: _deleted, ...rest } = states;
        latestProjectStatesRef.current = rest;
        return rest;
      });
      setDeletedProjectIds(nextDeletedProjectIds);
      return remaining.length;
    },
    [persistMetadataFallback]
  );

  const startCrawl = useCallback(
    (nextProject, options = {}) => {
      const targetProject = nextProject || project;
      if (!targetProject) return null;

      const { project: normalized } = upsertProject(targetProject, options);
      const session = createCrawlSession(normalized);
      crawlerSessionsRef.current[normalized.id] = session;
      setProjectStates((states) => {
        const nextStates = {
          ...states,
          [normalized.id]: {
            status: "crawling",
            stats: {
              ...emptyStats(),
              startedAt: new Date(),
              scheduled: session.queue.length,
            },
          },
        };
        latestProjectStatesRef.current = nextStates;
        return nextStates;
      });
      return normalized;
    },
    [project, upsertProject]
  );

  const stopCrawl = useCallback(() => {
    if (!project) return;

    setProjectStates((states) => {
      const current = getProjectState(states, project.id);
      return {
        ...states,
        [project.id]: {
          status: "complete",
          stats: { ...current.stats, finishedAt: new Date() },
        },
      };
    });
  }, [project]);

  const resumeCrawl = useCallback(() => {
    if (!project) return;

    setProjectStates((states) => {
      const current = getProjectState(states, project.id);
      return {
        ...states,
        [project.id]: {
          status: "crawling",
          stats: current.stats.startedAt
            ? current.stats
            : { ...current.stats, startedAt: new Date() },
        },
      };
    });
  }, [project]);

  const resetCrawl = useCallback(() => {
    if (!project) return;

    delete crawlerSessionsRef.current[project.id];
    setProjectStates((states) => ({
      ...states,
      [project.id]: emptyProjectState(),
    }));
  }, [project]);

  const setProject = useCallback(
    (nextProject) => {
      const {
        project: normalized,
        durableWrite,
        onlineWrite,
        rollback,
      } = upsertProject(nextProject, { requireOnline: true });

      return Promise.allSettled([durableWrite, onlineWrite]).then((results) => {
        const onlineResult = results[1];
        if (onlineResult.status === "rejected") {
          const error = onlineResult.reason;
          rollback();
          setStorageError(error);
          throw error;
        }
        return normalized;
      });
    },
    [upsertProject]
  );

  return (
    <CrawlContext.Provider
      value={{
        project,
        projects,
        selectedProjectId: project?.id || null,
        projectStates,
        storageReady,
        storageError,
        status,
        stats,
        selectProject,
        deleteProject,
        startCrawl,
        stopCrawl,
        resumeCrawl,
        resetCrawl,
        setProject,
      }}
    >
      {children}
    </CrawlContext.Provider>
  );
}

export function useCrawl() {
  const ctx = useContext(CrawlContext);
  if (!ctx) throw new Error("useCrawl must be used inside CrawlProvider");
  return ctx;
}

// Format helpers
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatTime(date) {
  if (!date) return "--";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
