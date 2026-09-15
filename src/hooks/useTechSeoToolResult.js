import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  loadToolResult,
  saveToolResult,
} from "../lib/projectsApi.js";

const STORAGE_PREFIX = "seox.techSeoToolResult.";
const STORAGE_VERSION = 1;
const MAX_STORED_STRING_LENGTH = 120000;
// How long a session-cached tool result is trusted without re-reading MySQL.
// Results only change when this tab runs the tool, and that path writes through.
const RESULT_STALE_MS = 10 * 60 * 1000;

function projectIdFor(project, projectUrl) {
  if (project?.id) return project.id;
  try {
    return new URL(projectUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function storageKey(toolKey, projectId) {
  return projectId ? `${STORAGE_PREFIX}${toolKey}.${projectId}` : "";
}

function defaultResult(defaultResultValue, projectUrl) {
  return { ...defaultResultValue, url: projectUrl || "" };
}

function trimLargeStrings(value) {
  if (typeof value === "string") {
    if (value.length <= MAX_STORED_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STORED_STRING_LENGTH)}\n\n[Truncated for database storage]`;
  }

  if (Array.isArray(value)) return value.map(trimLargeStrings);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, trimLargeStrings(item)])
    );
  }

  return value;
}

function readLocalResult(toolKey, projectId, projectUrl) {
  const key = storageKey(toolKey, projectId);
  if (!key) return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== STORAGE_VERSION) return null;
    if (parsed.projectUrl && parsed.projectUrl !== projectUrl) return null;
    if (!parsed.result) return null;
    // `updatedAt` has always been written here but never read back, so every
    // page mount issued a database query even when this copy was seconds old.
    const updatedAt = Date.parse(parsed.updatedAt || "");
    return {
      result: parsed.result,
      fresh: Number.isFinite(updatedAt) && Date.now() - updatedAt < RESULT_STALE_MS,
    };
  } catch {
    return null;
  }
}

function writeLocalResult(toolKey, projectId, projectUrl, result) {
  const key = storageKey(toolKey, projectId);
  if (!key || !result) return;

  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        version: STORAGE_VERSION,
        toolKey,
        projectId,
        projectUrl,
        result,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // MySQL is the durable store; sessionStorage is only for fast project swaps.
  }
}

export function useTechSeoToolResult({ toolKey, project, projectUrl, emptyResult }) {
  const { user } = useAuth();
  const userId = user?.uid || "";
  const projectId = projectIdFor(project, projectUrl);
  const loadIdRef = useRef(0);
  const [result, setResultState] = useState(() =>
    defaultResult(emptyResult, projectUrl)
  );
  const [persistenceError, setPersistenceError] = useState("");

  // `emptyResult` is deliberately not a dependency. Every current caller passes
  // a module-level constant so it is stable today, but an inline object at any
  // future call site would turn this into a refetch on every render.
  const emptyResultRef = useRef(emptyResult);
  emptyResultRef.current = emptyResult;

  useEffect(() => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setPersistenceError("");

    const cached = readLocalResult(toolKey, projectId, projectUrl);
    setResultState(cached?.result || defaultResult(emptyResultRef.current, projectUrl));

    if (!userId || !projectId) return;
    // A fresh session copy is authoritative - skip the database round-trip.
    if (cached?.fresh) return;

    loadToolResult(userId, { projectId, toolKey })
      .then((storedResult) => {
        if (loadIdRef.current !== loadId) return;
        if (storedResult) {
          setResultState(storedResult);
          writeLocalResult(toolKey, projectId, projectUrl, storedResult);
        }
      })
      .catch((error) => {
        if (loadIdRef.current !== loadId) return;
        setPersistenceError(error?.message || "Could not load saved tool result.");
      });
  }, [projectId, projectUrl, toolKey, userId]);

  const saveResult = useCallback(
    async (nextResult) => {
      const storableResult = trimLargeStrings(nextResult);
      setResultState(storableResult);
      setPersistenceError("");
      writeLocalResult(toolKey, projectId, projectUrl, storableResult);

      if (!userId || !projectId) return storableResult;

      try {
        await saveToolResult(userId, {
          projectId,
          projectUrl,
          toolKey,
          result: storableResult,
        });
      } catch (error) {
        const message = error?.message || "Could not save tool result.";
        setPersistenceError(message);
        // The local session copy is already updated, so a database outage
        // should not interrupt the tool workflow or create an unhandled
        // rejection from fire-and-forget persistence calls.
        return storableResult;
      }

      return storableResult;
    },
    [projectId, projectUrl, toolKey, userId]
  );

  return {
    result,
    saveResult,
    persistenceError,
  };
}
