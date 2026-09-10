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
  saveProjectWithMeta,
  deleteProject as deleteProjectApi,
  saveProjectMeta,
  saveProjectData,
} from "../lib/projectsApi.js";
import { useProjects } from "./ProjectsContext.jsx";
import {
  loadCrawlStorage,
  saveCrawlProjectStates,
  deleteCrawlProjectState,
} from "../lib/crawlStorage.js";
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
  "crawlus",
  "crawlus-com",
  "atlas-commerce",
  "scaxa-ae",
  "seox-io",
]);
const MOCK_PROJECT_HOSTS = new Set([
  "crawlus.com",
  "www.crawlus.com",
  "atlascommerce.com",
  "www.atlascommerce.com",
  "scaxa.ae",
  "www.scaxa.ae",
  "seox.io",
  "www.seox.io",
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

/* ---------------- sessionStorage helpers ---------------- */

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
    const raw =
      (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null) ||
      (typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, serialized);
    if (typeof localStorage !== "undefined") localStorage.setItem(key, serialized);
  } catch {}
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

function projectListSignature(list) {
  return (list || [])
    .map((item) =>
      [
        item?.id,
        item?.name,
        item?.domain,
        item?.fullUrl || item?.full_url || item?.url,
        item?.updated_at,
      ].join("~")
    )
    .join("|");
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
  // The project inventory is owned by ProjectsContext. CrawlProvider reads it
  // from there and mirrors its own writes back, so `GET /api/projects` is never
  // issued twice for the same signed-in user.
  const {
    projects: sharedProjects,
    selectedProjectId: sharedSelectedProjectId,
    deletedProjectIds: sharedDeletedProjectIds,
    ready: sharedProjectsReady,
    error: sharedProjectsError,
    refreshProjects: refreshSharedProjects,
    applyProjectUpsert: shareProjectUpsert,
    applyProjectRemoval: shareProjectRemoval,
    applySelectedProjectId: shareSelectedProjectId,
  } = useProjects();
  const sharedPayloadRef = useRef(null);
  sharedPayloadRef.current = {
    projects: sharedProjects,
    selectedProjectId: sharedSelectedProjectId,
    deletedProjectIds: sharedDeletedProjectIds,
  };
  const sharedProjectsErrorRef = useRef(null);
  sharedProjectsErrorRef.current = sharedProjectsError;
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

  const persistMetadataFallback = useCallback(() => {
    // Project metadata is persisted through the database-backed /api/projects endpoint.
    // Keep this callback as a no-op so the browser does not maintain a second source of truth.
  }, []);

  useEffect(() => {
    // Wait for the shared inventory before hydrating a signed-in session,
    // otherwise the empty pre-fetch payload would look like "no projects".
    if (authUserId && !sharedProjectsReady) return undefined;

    let cancelled = false;

    const hydrate = async () => {
      try {
        let dbData = { projects: [], selectedProjectId: null, deletedProjectIds: [] };
        let databaseLoaded = false;
        if (authUserId) {
          // Already fetched (once) by ProjectsContext - read, do not request.
          // A failed shared load keeps `databaseLoaded` false so the seed/local
          // fallback below still applies, exactly as before.
          if (!sharedProjectsErrorRef.current) {
            dbData = sharedPayloadRef.current || dbData;
            databaseLoaded = true;
          }
        }

        const currentProjects = latestProjectsRef.current || initial.projects;
        const currentSelectedProjectId =
          latestSelectedProjectIdRef.current || initial.selectedProjectId;
        const currentDeletedProjectIds =
          latestDeletedProjectIdsRef.current || initial.deletedProjectIds;
        const currentProjectStates =
          latestProjectStatesRef.current || initial.projectStates;
        const hasRuntimeProjectStateChanges =
          currentProjectStates !== initial.projectStates;

        // Move eligible legacy browser projects into MySQL once. Thereafter, MySQL
        // is the authenticated user's source of truth rather than sessionStorage.
        if (authUserId && databaseLoaded) {
          const deletedIds = new Set([
            ...initial.deletedProjectIds,
            ...currentDeletedProjectIds,
            ...(dbData.deletedProjectIds || []),
          ]);
          const databaseProjectIds = new Set((dbData.projects || []).map((item) => item.id));
          const browserOnlyProjects = mergeProjects(initial.projects, currentProjects).filter(
            (item) =>
              item?.id &&
              !deletedIds.has(item.id) &&
              !databaseProjectIds.has(item.id) &&
              !isMockProject(item) &&
              (!item.owner_uid || String(item.owner_uid) === String(authUserId))
          );

          if (browserOnlyProjects.length) {
            await Promise.allSettled(
              browserOnlyProjects.map((item) =>
                saveProjectWithMeta(authUserId, item, {
                  selectedProjectId: currentSelectedProjectId || item.id,
                  deletedProjectIds: Array.from(deletedIds),
                })
              )
            );
            // Legacy browser projects were just written to MySQL; ask the shared
            // context for one authoritative re-read so every page sees them.
            dbData = await refreshSharedProjects(true);
          }
        }
        if (cancelled) return;
        const restoredDeletedProjectIds = Array.from(
          new Set([
            ...initial.deletedProjectIds,
            ...currentDeletedProjectIds,
            ...(dbData.deletedProjectIds || []),
          ])
        );
        const deleted = new Set(restoredDeletedProjectIds);
        const restoredProjects = (
          databaseLoaded
            ? mergeProjects(dbData.projects || [])
            : mergeProjects(defaultProjects, initial.projects, currentProjects)
        ).filter((item) => !deleted.has(item.id) && !isMockProject(item));
        const availableProjectIds = new Set(restoredProjects.map((item) => item.id));
        const restoredSelectedProjectId =
          (currentSelectedProjectId &&
          availableProjectIds.has(currentSelectedProjectId)
            ? currentSelectedProjectId
            : null) ||
          (dbData.selectedProjectId &&
          availableProjectIds.has(dbData.selectedProjectId)
            ? dbData.selectedProjectId
            : null) ||
          (initial.selectedProjectId &&
          availableProjectIds.has(initial.selectedProjectId)
            ? initial.selectedProjectId
            : null) ||
          restoredProjects[0]?.id ||
          null;
        let localCrawlStorage = { projectStates: {} };
        try {
          localCrawlStorage = await loadCrawlStorage();
        } catch {
          // IndexedDB load is non-blocking
        }

        const serverProjectStates = {};
        (dbData.projects || []).forEach((proj) => {
          if (proj?.id && proj?.project_data) {
            const auditorData = proj.project_data.auditor;
            const rawState =
              (auditorData && typeof auditorData === "object"
                ? (auditorData.stats ? { status: auditorData.status || "complete", stats: auditorData.stats } : { status: "complete", stats: auditorData })
                : null) ||
              proj.project_data.crawlState ||
              proj.project_data.auditState ||
              (proj.project_data.auditIssues ? { status: "complete", stats: proj.project_data } : null);
            if (rawState) {
              serverProjectStates[proj.id] = reviveProjectState(rawState);
            }
          }
        });

        const idbStates = localCrawlStorage?.projectStates
          ? Object.fromEntries(
              Object.entries(localCrawlStorage.projectStates).map(([id, state]) => [
                id,
                reviveProjectState(state),
              ])
            )
          : {};

        const mergedProjectStates = {
          ...initial.projectStates,
          ...idbStates,
          ...serverProjectStates,
          ...(hasRuntimeProjectStateChanges ? currentProjectStates : {}),
        };

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
    // `sharedPayloadRef` is read through a ref on purpose: hydration runs once
    // per signed-in user, and later inventory changes are mirrored by the sync
    // effect below rather than by re-running the whole hydration pass.
  }, [authUserId, initial, persistMetadataFallback, refreshSharedProjects, sharedProjectsReady]);

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

  // Mirror later ProjectsContext changes - a project created, edited or deleted
  // anywhere in the app - into the crawl-side list. No request is made: the
  // shared context already holds the authoritative inventory.
  const syncedSharedProjectsRef = useRef(null);
  useEffect(() => {
    if (!authUserId || !storageReady || !sharedProjectsReady) return;
    if (syncedSharedProjectsRef.current === sharedProjects) return;
    syncedSharedProjectsRef.current = sharedProjects;

    const deleted = new Set(latestDeletedProjectIdsRef.current || []);
    const nextProjects = mergeProjects(sharedProjects).filter(
      (item) => !deleted.has(item.id) && !isMockProject(item)
    );
    if (projectListSignature(latestProjectsRef.current) === projectListSignature(nextProjects)) return;

    const availableIds = new Set(nextProjects.map((item) => item.id));
    const nextSelectedId =
      (latestSelectedProjectIdRef.current && availableIds.has(latestSelectedProjectIdRef.current)
        ? latestSelectedProjectIdRef.current
        : null) ||
      (sharedSelectedProjectId && availableIds.has(sharedSelectedProjectId)
        ? sharedSelectedProjectId
        : null) ||
      nextProjects[0]?.id ||
      null;

    latestProjectsRef.current = nextProjects;
    latestSelectedProjectIdRef.current = nextSelectedId;
    setProjects(nextProjects);
    setSelectedProjectId(nextSelectedId);
  }, [authUserId, sharedProjects, sharedProjectsReady, sharedSelectedProjectId, storageReady]);

  // Persist projectStates to IndexedDB, localStorage/sessionStorage, and debounced to MySQL
  useEffect(() => {
    if (!storageReady) return;

    writeJson(LS_PROJECT_STATES, projectStates);

    const entries = Object.entries(projectStates).filter(
      ([, state]) => state?.stats?.crawledCount > 0 || state?.status === "crawling"
    );
    if (entries.length) {
      saveCrawlProjectStates(entries).catch(() => {});
    }

    const uid = uidRef.current;
    if (uid && project?.id && projectStates[project.id]) {
      const activeState = projectStates[project.id];
      if (activeState?.stats?.crawledCount > 0) {
        clearTimeout(stateFlushTimerRef.current);
        stateFlushTimerRef.current = setTimeout(() => {
          const auditorPayload = {
            status: activeState.status,
            stats: activeState.stats,
            totalUrls: activeState.stats?.crawledCount || 0,
            updatedAt: new Date().toISOString(),
          };
          saveProjectData(uid, {
            projectId: project.id,
            key: "auditor",
            value: auditorPayload,
          }).catch(() => {});
          saveProjectData(uid, {
            projectId: project.id,
            key: "crawlState",
            value: activeState,
          }).catch(() => {});
        }, STATE_FLUSH_MS);
      }
    }
  }, [projectStates, storageReady, project?.id]);

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

    const uid = uidRef.current;
    const onlineWrite = skipOnline
      ? Promise.resolve(false)
      : uid
      ? saveProjectWithMeta(uid, normalized, {
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

    const previousVersion = previousProjects.find((item) => item.id === normalized.id) || null;

    const rollback = () => {
      latestProjectsRef.current = previousProjects;
      latestSelectedProjectIdRef.current = previousSelectedProjectId;
      latestDeletedProjectIdsRef.current = previousDeletedProjectIds;
      persistMetadataFallback(
        previousProjects,
        previousSelectedProjectId,
        previousDeletedProjectIds
      );
      setProjects(previousProjects);
      setDeletedProjectIds(previousDeletedProjectIds);
      setSelectedProjectId(previousSelectedProjectId);
      syncedSharedProjectsRef.current = null;
      if (previousVersion) {
        shareProjectUpsert(previousVersion, { selectedProjectId: previousSelectedProjectId });
      } else {
        shareProjectRemoval(normalized.id, {
          selectedProjectId: previousSelectedProjectId,
          markDeleted: false,
        });
      }
    };

    setProjects(nextProjects);
    setDeletedProjectIds(nextDeletedProjectIds);
    setSelectedProjectId(normalized.id);
    // Publish to the shared inventory so every other page shows the new or
    // edited project without asking /api/projects again.
    syncedSharedProjectsRef.current = null;
    shareProjectUpsert(normalized, { selectedProjectId: normalized.id });
    return { project: normalized, onlineWrite, rollback };
  }, [persistMetadataFallback, shareProjectRemoval, shareProjectUpsert]);

  const selectProject = useCallback(
    (projectId) => {
      const currentProjects = latestProjectsRef.current;
      const selectedProject = currentProjects.find((item) => item.id === projectId);
      if (selectedProject) {
        latestSelectedProjectIdRef.current = projectId;
        persistMetadataFallback(
          currentProjects,
          projectId,
          latestDeletedProjectIdsRef.current
        );
        setSelectedProjectId(projectId);
        shareSelectedProjectId(projectId);

        // Persist project selection and project info to MySQL
        const uid = uidRef.current;
        if (uid) {
          saveProjectWithMeta(uid, selectedProject, {
            selectedProjectId: projectId,
            deletedProjectIds: latestDeletedProjectIdsRef.current,
          }).catch(() => {});
        }
      }
    },
    [persistMetadataFallback, shareSelectedProjectId]
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

      const uid = uidRef.current;
      if (uid) {
        deleteProjectApi(uid, projectId).catch(() => {});
        saveProjectMeta(uid, {
          selectedProjectId: nextSelectedProjectId,
          deletedProjectIds: nextDeletedProjectIds,
        }).catch(() => {});
      }

      setProjects(remaining);
      setSelectedProjectId(nextSelectedProjectId);
      syncedSharedProjectsRef.current = null;
      shareProjectRemoval(projectId, { selectedProjectId: nextSelectedProjectId });
      delete crawlerSessionsRef.current[projectId];
      dirtyProjectStatesRef.current.delete(projectId);
      deleteCrawlProjectState(projectId).catch(() => {});
      setProjectStates((states) => {
        const { [projectId]: _deleted, ...rest } = states;
        latestProjectStatesRef.current = rest;
        return rest;
      });
      setDeletedProjectIds(nextDeletedProjectIds);
      return remaining.length;
    },
    [persistMetadataFallback, shareProjectRemoval]
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
      const { project: normalized, onlineWrite, rollback } = upsertProject(nextProject, { requireOnline: true });

      return Promise.allSettled([onlineWrite]).then((results) => {
        const onlineResult = results[0];
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

  // Project selectors can request a fresh database snapshot when opened, so a
  // newly-created project is immediately available without reloading the app.
  const refreshProjects = useCallback(async () => {
    if (!authUserId) return [];

    // Explicit, user-initiated refresh: go through the shared context so the
    // whole app (not just this provider) sees the new snapshot.
    const dbData = await refreshSharedProjects(true);
    // This explicit refresh is used by the project dropdown.  Do not combine
    // it with browser state or hide rows based on client-side seed/deletion
    // rules: the API response from user_projects is the source of truth.
    const nextProjects = (dbData.projects || []).map(normalizeProject);
    const availableIds = new Set(nextProjects.map((item) => item.id));
    const nextSelectedId =
      (latestSelectedProjectIdRef.current && availableIds.has(latestSelectedProjectIdRef.current)
        ? latestSelectedProjectIdRef.current
        : null) ||
      (dbData.selectedProjectId && availableIds.has(dbData.selectedProjectId)
        ? dbData.selectedProjectId
        : null) ||
      nextProjects[0]?.id ||
      null;

    latestProjectsRef.current = nextProjects;
    latestSelectedProjectIdRef.current = nextSelectedId;
    latestDeletedProjectIdsRef.current = dbData.deletedProjectIds || [];
    setProjects(nextProjects);
    setSelectedProjectId(nextSelectedId);
    setDeletedProjectIds(dbData.deletedProjectIds || []);
    syncedSharedProjectsRef.current = null;
    return nextProjects;
  }, [authUserId, refreshSharedProjects]);

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
        refreshProjects,
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
