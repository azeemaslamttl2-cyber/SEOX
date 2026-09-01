/**
 * Online project persistence.
 *
 * Client Firestore rules may be locked down, so project metadata is persisted
 * through /api/projects. The API verifies the Firebase ID token and writes only
 * under users/{uid}/... with server-side credentials.
 */

function projectApiUrl(query) {
  const url = new URL("/api/projects", window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return `${url.pathname}${url.search}`;
}

async function projectApi(method, body, query) {
  const response = await fetch(projectApiUrl(query), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Project API returned HTTP ${response.status}`);
  }
  return payload;
}

export async function loadFirestoreProjects(uid) {
  if (!uid) return { projects: [], selectedProjectId: null, deletedProjectIds: [] };
  const payload = await projectApi("GET");
  return {
    projects: Array.isArray(payload.projects) ? payload.projects : [],
    selectedProjectId: payload.selectedProjectId || null,
    deletedProjectIds: Array.isArray(payload.deletedProjectIds)
      ? payload.deletedProjectIds
      : [],
  };
}

export async function saveFirestoreProjectWithMeta(uid, project, { selectedProjectId, deletedProjectIds }) {
  if (!uid || !project?.id) return;
  await projectApi("POST", {
    action: "saveProjectWithMeta",
    project,
    selectedProjectId: selectedProjectId || project.id,
    deletedProjectIds,
  });
}

export async function deleteFirestoreProject(uid, projectId) {
  if (!uid || !projectId) return;
  await projectApi("DELETE", { projectId });
}

export async function saveFirestoreMeta(uid, { selectedProjectId, deletedProjectIds }) {
  if (!uid) return;
  await projectApi("POST", {
    action: "saveMeta",
    selectedProjectId,
    deletedProjectIds,
  });
}

export async function loadFirestoreToolResult(uid, { projectId, toolKey }) {
  if (!uid || !projectId || !toolKey) return null;
  const payload = await projectApi("GET", null, {
    action: "toolResult",
    projectId,
    toolKey,
  });
  return payload?.result || null;
}

export async function saveFirestoreToolResult(
  uid,
  { projectId, projectUrl, toolKey, result }
) {
  if (!uid || !projectId || !toolKey || !result) return;
  await projectApi("POST", {
    action: "saveToolResult",
    projectId,
    projectUrl,
    toolKey,
    result,
  });
}
