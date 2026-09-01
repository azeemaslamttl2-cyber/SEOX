import { clearSession, getSessionToken } from './authSession.js';

function projectApiUrl(query) {
  const url = new URL('/api/projects', window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => { if (value != null && value !== '') url.searchParams.set(key, String(value)); });
  return `${url.pathname}${url.search}`;
}
function projectInfoApiUrl(query) {
  const url = new URL('/api/project-info', window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => { if (value != null && value !== '') url.searchParams.set(key, String(value)); });
  return `${url.pathname}${url.search}`;
}
async function projectApi(method, body, query, { preserveSession = false } = {}) {
  const token = getSessionToken();
  const headers = new Headers(body ? { 'Content-Type': 'application/json' } : undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(projectApiUrl(query), { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && !preserveSession) clearSession();
  if (!response.ok) throw new Error(payload.error || `Project API returned HTTP ${response.status}`);
  return payload;
}
async function projectInfoApi(method, body, query, { preserveSession = false } = {}) {
  const token = getSessionToken();
  const headers = new Headers(body ? { 'Content-Type': 'application/json' } : undefined);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(projectInfoApiUrl(query), { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && !preserveSession) clearSession();
  if (!response.ok) throw new Error(payload.error || `Project Info API returned HTTP ${response.status}`);
  return payload;
}
export async function loadProjects(uid) {
  if (!uid) return { projects: [], selectedProjectId: null, deletedProjectIds: [] };
  const payload = await projectApi('GET');
  return { projects: Array.isArray(payload.projects) ? payload.projects : [], selectedProjectId: payload.selectedProjectId || null, deletedProjectIds: Array.isArray(payload.deletedProjectIds) ? payload.deletedProjectIds : [] };
}
export function saveProjectWithMeta(uid, project, meta) { return !uid || !project?.id ? null : projectApi('POST', { action: 'saveProjectWithMeta', project, selectedProjectId: meta.selectedProjectId || project.id, deletedProjectIds: meta.deletedProjectIds }); }
export function deleteProject(uid, projectId) { return !uid || !projectId ? undefined : projectApi('DELETE', { projectId }); }
export function saveProjectMeta(uid, meta) { return !uid ? undefined : projectApi('POST', { action: 'saveMeta', ...meta }); }
export async function loadToolResult(uid, params) { return !uid ? null : (await projectApi('GET', null, { action: 'toolResult', ...params }, { preserveSession: true })).result || null; }
export function saveToolResult(uid, body) { return !uid ? undefined : projectApi('POST', { action: 'saveToolResult', ...body }, undefined, { preserveSession: true }); }
export function saveProjectData(uid, body) {
  return !uid
    ? undefined
    : projectApi('POST', { action: 'saveProjectData', ...body }, undefined, { preserveSession: true });
}

export async function saveProjectDataObject(uid, { projectId, projectData }) {
  if (!uid || !projectId || !projectData || typeof projectData !== 'object') return null;
  const payload = await projectApi('POST', {
    action: 'saveProjectData',
    projectId,
    key: 'branded-keywords',
    value: projectData['branded-keywords'] || [],
  }, undefined, { preserveSession: true });
  return payload;
}
export async function loadProjectInfo(uid, params) {
  if (!uid) return null;
  const payload = await projectInfoApi('GET', null, params);
  return payload;
}
