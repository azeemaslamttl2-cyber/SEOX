import {
  deleteFirestoreDocument,
  getFirestoreDocument,
  listFirestoreCollection,
  patchFirestoreDocument,
  verifyFirebaseIdToken,
} from "../_lib/firebase-rest.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";

function userProjectsCollection(userId) {
  return `users/${userId}/projects`;
}

function userMetaCollection(userId) {
  return `users/${userId}/meta`;
}

function userProjectToolResultsCollection(userId, projectId) {
  return `${userProjectsCollection(userId)}/${projectId}/toolResults`;
}

const TOOL_RESULT_KEYS = new Set([
  "eeat",
  "semantic",
  "robots",
  "crawlOptimization",
  "speed",
  "duplicate",
  "gsc",
  "bing",
  "backlinks",
  "plagiarism",
]);

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).filter(([, value]) => value !== undefined)
  );
}

function sanitizeProject(project, decoded) {
  if (!project?.id) {
    const error = new Error("Project id is required");
    error.status = 400;
    throw error;
  }

  const {
    stats: _stats,
    latestUrls: _latestUrls,
    auditIssues: _auditIssues,
    ...safe
  } = project;

  return cleanFields({
    ...safe,
    ownerUid: decoded.uid,
    ownerEmail: decoded.email || safe.owner || "",
    updatedAt: new Date().toISOString(),
  });
}

function normalizeDeletedProjectIds(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function normalizeDocumentId(value, label) {
  const id = String(value || "").trim();
  if (!id || id.includes("/")) {
    const error = new Error(`${label} is required`);
    error.status = 400;
    throw error;
  }
  return id;
}

function normalizeToolKey(value) {
  const key = String(value || "").trim();
  if (!TOOL_RESULT_KEYS.has(key)) {
    const error = new Error("Tool key is not supported");
    error.status = 400;
    throw error;
  }
  return key;
}

function sanitizeToolResult(body, decoded) {
  const projectId = normalizeDocumentId(body?.projectId, "Project id");
  const toolKey = normalizeToolKey(body?.toolKey);
  const result = body?.result;

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    const error = new Error("Tool result is required");
    error.status = 400;
    throw error;
  }

  return {
    projectId,
    toolKey,
    data: {
      ownerUid: decoded.uid,
      ownerEmail: decoded.email || "",
      projectId,
      projectUrl: String(body?.projectUrl || result?.url || ""),
      toolKey,
      result,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function loadProjects(env, userId) {
  const [projects, meta] = await Promise.all([
    listFirestoreCollection(env, userProjectsCollection(userId)),
    getFirestoreDocument(env, userMetaCollection(userId), "crawl"),
  ]);

  return {
    projects,
    selectedProjectId: meta?.selectedProjectId || null,
    deletedProjectIds: normalizeDeletedProjectIds(meta?.deletedProjectIds),
  };
}

async function loadToolResult(env, userId, projectId, toolKey) {
  return getFirestoreDocument(
    env,
    userProjectToolResultsCollection(userId, projectId),
    toolKey
  );
}

async function saveMeta(env, userId, { selectedProjectId, deletedProjectIds }) {
  return patchFirestoreDocument(env, userMetaCollection(userId), "crawl", {
    selectedProjectId: selectedProjectId || null,
    deletedProjectIds: normalizeDeletedProjectIds(deletedProjectIds),
    updatedAt: new Date().toISOString(),
  });
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, DELETE, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);

  try {
    const decoded = await verifyFirebaseIdToken(request, env);
    const userId = decoded.uid;

    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.get("action") === "toolResult") {
        const projectId = normalizeDocumentId(url.searchParams.get("projectId"), "Project id");
        const toolKey = normalizeToolKey(url.searchParams.get("toolKey"));
        const document = await loadToolResult(env, userId, projectId, toolKey);
        return jsonResponse({
          result: document?.result || null,
          updatedAt: document?.updatedAt || null,
          projectUrl: document?.projectUrl || "",
        }, 200, headers);
      }

      return jsonResponse(await loadProjects(env, userId), 200, headers);
    }

    const body = await readJson(request);
    const action = body?.action || "";

    if (request.method === "POST") {
      if (action === "saveProjectWithMeta") {
        const project = sanitizeProject(body.project, decoded);
        await Promise.all([
          patchFirestoreDocument(env, userProjectsCollection(userId), project.id, project),
          saveMeta(env, userId, {
            selectedProjectId: body.selectedProjectId || project.id,
            deletedProjectIds: body.deletedProjectIds,
          }),
        ]);
        return jsonResponse({ success: true, project }, 200, headers);
      }

      if (action === "saveMeta") {
        await saveMeta(env, userId, {
          selectedProjectId: body.selectedProjectId,
          deletedProjectIds: body.deletedProjectIds,
        });
        return jsonResponse({ success: true }, 200, headers);
      }

      if (action === "saveToolResult") {
        const { projectId, toolKey, data } = sanitizeToolResult(body, decoded);
        await patchFirestoreDocument(
          env,
          userProjectToolResultsCollection(userId, projectId),
          toolKey,
          data
        );
        return jsonResponse({ success: true, projectId, toolKey }, 200, headers);
      }

      return jsonResponse({ error: "Invalid action" }, 400, headers);
    }

    if (request.method === "DELETE") {
      const projectId = String(body.projectId || "").trim();
      if (!projectId) return jsonResponse({ error: "Project id is required" }, 400, headers);

      const writes = [
        deleteFirestoreDocument(env, userProjectsCollection(userId), projectId),
      ];
      if (
        Object.prototype.hasOwnProperty.call(body, "selectedProjectId") ||
        Object.prototype.hasOwnProperty.call(body, "deletedProjectIds")
      ) {
        writes.push(saveMeta(env, userId, {
          selectedProjectId: body.selectedProjectId,
          deletedProjectIds: body.deletedProjectIds,
        }));
      }
      await Promise.all(writes);
      return jsonResponse({ success: true }, 200, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
