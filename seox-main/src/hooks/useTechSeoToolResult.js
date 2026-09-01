import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  loadFirestoreToolResult,
  saveFirestoreToolResult,
} from "../lib/firestoreProjects.js";

const STORAGE_PREFIX = "seox.techSeoToolResult.";
const STORAGE_VERSION = 1;
const MAX_STORED_STRING_LENGTH = 120000;

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
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== STORAGE_VERSION) return null;
    if (parsed.projectUrl && parsed.projectUrl !== projectUrl) return null;
    return parsed.result || null;
  } catch {
    return null;
  }
}

function writeLocalResult(toolKey, projectId, projectUrl, result) {
  const key = storageKey(toolKey, projectId);
  if (!key || !result) return;

  try {
    localStorage.setItem(
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
    // Firebase is the durable store; localStorage is only for fast project swaps.
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

  useEffect(() => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setPersistenceError("");

    const localResult = readLocalResult(toolKey, projectId, projectUrl);
    setResultState(localResult || defaultResult(emptyResult, projectUrl));

    if (!userId || !projectId) return;

    loadFirestoreToolResult(userId, { projectId, toolKey })
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
  }, [emptyResult, projectId, projectUrl, toolKey, userId]);

  const saveResult = useCallback(
    async (nextResult) => {
      const storableResult = trimLargeStrings(nextResult);
      setResultState(storableResult);
      setPersistenceError("");
      writeLocalResult(toolKey, projectId, projectUrl, storableResult);

      if (!userId || !projectId) return storableResult;

      try {
        await saveFirestoreToolResult(userId, {
          projectId,
          projectUrl,
          toolKey,
          result: storableResult,
        });
      } catch (error) {
        setPersistenceError(error?.message || "Could not save tool result.");
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
