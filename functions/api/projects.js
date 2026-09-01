import { configureMysqlConnection, query, queryOne, insert, update, deleteQuery } from "../_lib/mysql.js";
import { requireUser } from "../_lib/auth-token.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";
import { processModulesSequentially, acquireProcessingLock, releaseProcessingLock } from "../_lib/module-processor.js";

// Authentication helper for MySQL-backed auth
const verifyUser = requireUser;

const TOOL_RESULT_KEYS = new Set([
  "dashboardChecks",
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
  "speed_test",
  "sitemap",
  "llmsTxt",
  "w3c",
  "w3c-validation",
]);

/**
 * Maps tool keys to their storage paths in project_data
 * All module results are stored directly at project_data.{toolKey}
 * No toolResults wrapper used
 */
function getToolResultPaths(toolKey) {
  if (toolKey === "llmsTxt") return ["$.llmsTxt"];
  
  // Store directly under project_data without toolResults wrapper
  return [`$.${toolKey}`];
}

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).filter(([, value]) => value !== undefined && value !== null)
  );
}

function parseJsonField(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseObjectField(value) {
  const parsed = parseJsonField(value, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function parseArrayField(value) {
  const parsed = parseJsonField(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function stripToolResultsFromProjectData(value) {
  const base = parseObjectField(value);
  // Remove the toolResults wrapper completely
  // Module results are now stored directly at the root level
  const { toolResults: _toolResults, ...rest } = base;
  return rest;
}

export function mergeProjectDataForKey(existingProjectData, key, value) {
  const base = stripToolResultsFromProjectData(existingProjectData);
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return base;

  return {
    ...base,
    [normalizedKey]: value,
  };
}

export function mergeProjectDataPreservingKeys(existingProjectData, key, value) {
  const base = parseObjectField(existingProjectData);
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return base;

  return {
    ...base,
    [normalizedKey]: value,
  };
}

export function mergeProjectDataWithToolResult(existingProjectData, toolKey, resultData) {
  return mergeProjectDataForKey(existingProjectData, toolKey, resultData);
}

function normalizeProjectDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    const error = new Error("A valid domain is required");
    error.status = 400;
    throw error;
  }

  const candidate = raw.replace(/^(?:https?:)?\/\//i, "");
  try {
    const url = new URL(`https://${candidate}`);
    if (!url.hostname || !url.hostname.includes(".")) throw new Error("Invalid domain");
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const error = new Error("Enter a valid domain, such as example.com");
    error.status = 400;
    throw error;
  }
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

  const domain = normalizeProjectDomain(project.domain || project.full_url || project.fullUrl || project.url);

  return cleanFields({
    ...safe,
    owner_uid: decoded.uid,
    owner_email: decoded.email || safe.owner || "",
    updated_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    project_id: project.id,
    project_name: project.name || project.project_name || 'Untitled',
    domain,
    full_url: project.full_url || project.fullUrl || project.url || '',
    protocol: project.protocol || 'https-http',
    scope: project.scope || 'subdomains',
    folder: project.folder || 'none',
    schedule: project.schedule || 'weekly',
    user_agent: project.user_agent || 'seox-desktop',
    url_limit: project.url_limit || 10000,
    total_urls: project.total_urls || 0,
    compare_to: project.compare_to || null,
    crawled_on: project.crawled_on || null,
    render_js: project.render_js ? 1 : 0,
    respect_robots: project.respect_robots !== undefined ? (project.respect_robots ? 1 : 0) : 1,
    notify_email: project.notify_email !== undefined ? (project.notify_email ? 1 : 0) : 1,
    owner: project.owner || null,
    owner_email: project.owner_email || null,
    project_data: JSON.stringify(project.project_data || {}),
    selected_project_id: project.selected_project_id || null,
    deleted_project_ids: JSON.stringify(project.deleted_project_ids || []),
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
      owner_uid: decoded.uid,
      owner_email: decoded.email || "",
      project_id: projectId,
      project_url: String(body?.projectUrl || result?.url || ""),
      tool_key: toolKey,
      result,
      updated_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    },
  };
}

// Load user's meta data (selectedProjectId, deletedProjectIds)
async function loadUserMeta(userId) {
  // Since meta is stored as JSON in the user_projects table,
  // we'll aggregate it from the project data
  const rows = await query(
    `SELECT project_id, project_data, selected_project_id, deleted_project_ids 
     FROM user_projects 
     WHERE user_id = ?`,
    [userId]
  );

  let selectedProjectId = null;
  let deletedProjectIds = [];

  // Get the most recent project's meta data, or aggregate from all
  if (rows.length > 0) {
    // Find a project that has meta data
    const metaRow = rows.find(row => row.selected_project_id || row.deleted_project_ids);
    if (metaRow) {
      selectedProjectId = metaRow.selected_project_id || null;
      deletedProjectIds = metaRow.deleted_project_ids ? 
        normalizeDeletedProjectIds(parseArrayField(metaRow.deleted_project_ids)) : [];
    }
  }

  return { selectedProjectId, deletedProjectIds };
}

async function loadProjects(userId, { includeAllUsers = false } = {}) {
  // Select only necessary columns to avoid sort buffer issues with large JSON fields
  const columnList = `project_id, project_name, domain, full_url, protocol, scope, folder, schedule, 
    user_agent, url_limit, total_urls, compare_to, crawled_on, render_js, respect_robots, notify_email,
    owner, owner_email, owner_uid, project_data, selected_project_id, deleted_project_ids, created_at, updated_at`;
  
  const rows = await query(
    includeAllUsers
      ? `SELECT ${columnList} FROM user_projects ORDER BY created_at DESC LIMIT 1000`
      : `SELECT ${columnList} FROM user_projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000`,
    includeAllUsers ? [] : [userId]
  );

  // Transform MySQL rows to match expected format
  const projects = rows.map(row => ({
    id: row.project_id,
    name: row.project_name,
    project_name: row.project_name,
    domain: row.domain,
    full_url: row.full_url,
    url: row.full_url,
    protocol: row.protocol,
    scope: row.scope,
    folder: row.folder,
    schedule: row.schedule,
    user_agent: row.user_agent,
    url_limit: row.url_limit,
    total_urls: row.total_urls,
    compare_to: row.compare_to,
    crawled_on: row.crawled_on,
    render_js: Boolean(row.render_js),
    respect_robots: Boolean(row.respect_robots),
    notify_email: Boolean(row.notify_email),
    owner: row.owner,
    owner_email: row.owner_email,
    owner_uid: row.owner_uid,
    project_data: parseObjectField(row.project_data),
    selected_project_id: row.selected_project_id,
    deleted_project_ids: parseArrayField(row.deleted_project_ids),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const meta = await loadUserMeta(userId);
  
  return {
    projects,
    selectedProjectId: meta.selectedProjectId,
    deletedProjectIds: meta.deletedProjectIds,
  };
}

async function loadProject(userId, projectId) {
  const row = await queryOne(
    `SELECT * FROM user_projects 
     WHERE user_id = ? AND project_id = ? LIMIT 1`,
    [userId, projectId]
  );

  if (!row) return null;

  return {
    id: row.project_id,
    name: row.project_name,
    project_name: row.project_name,
    domain: row.domain,
    full_url: row.full_url,
    url: row.full_url,
    protocol: row.protocol,
    scope: row.scope,
    folder: row.folder,
    schedule: row.schedule,
    user_agent: row.user_agent,
    url_limit: row.url_limit,
    total_urls: row.total_urls,
    compare_to: row.compare_to,
    crawled_on: row.crawled_on,
    render_js: Boolean(row.render_js),
    respect_robots: Boolean(row.respect_robots),
    notify_email: Boolean(row.notify_email),
    owner: row.owner,
    owner_email: row.owner_email,
    owner_uid: row.owner_uid,
    project_data: parseObjectField(row.project_data),
    selected_project_id: row.selected_project_id,
    deleted_project_ids: parseArrayField(row.deleted_project_ids),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Persists a tool result to project_data.toolResults
 * Called after tool execution or when syncing results from tool_results table
 */
async function persistToolResultToProjectData(userId, projectId, toolKey, resultData, projectUrl) {
  try {
    const row = await queryOne(
      `SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1`,
      [userId, projectId]
    );

    const nextProjectData = mergeProjectDataWithToolResult(row?.project_data, toolKey, resultData);

    await update(
      `UPDATE user_projects
         SET project_data = ?, updated_at = NOW()
       WHERE user_id = ? AND project_id = ?`,
      [JSON.stringify(nextProjectData), userId, projectId]
    );
  } catch (err) {
    // Log but don't throw - persistence to project_data should not break the API response
    console.warn(`Failed to persist ${toolKey} result to project_data:`, err?.message);
  }
}

async function loadToolResult(userId, projectId, toolKey) {
  // Tool results have their own table so each analysis can be loaded without
  // rewriting the entire project's JSON payload.
  const stored = await queryOne(
    `SELECT result, project_url, updated_at
     FROM tool_results
     WHERE user_id = ? AND project_id = ? AND tool_key = ?
     LIMIT 1`,
    [userId, projectId, toolKey]
  );

  if (stored) {
    // Sync result to project_data for consistency
    // This ensures project_data stays in sync even if it was cleared or out of sync
    const parsedResult = parseObjectField(stored.result);
    await persistToolResultToProjectData(userId, projectId, toolKey, parsedResult, stored.project_url);
    
    return {
      result: parsedResult,
      projectUrl: stored.project_url || "",
      updatedAt: stored.updated_at || null,
    };
  }

  // Retain access to results saved by earlier releases, which stored them in
  // user_projects.project_data before the dedicated table was used.
  const row = await queryOne(
    `SELECT project_data FROM user_projects 
     WHERE user_id = ? AND project_id = ? AND owner_uid = ?`,
    [userId, projectId, userId]
  );

  if (row && row.project_data) {
    const data = stripToolResultsFromProjectData(row.project_data);
    return data[toolKey] || null;
  }
  return null;
}

async function saveMeta(userId, { selectedProjectId, deletedProjectIds }) {
  // Update the most recent project or all projects with meta data
  const deletedIds = normalizeDeletedProjectIds(deletedProjectIds);
  const deletedJson = JSON.stringify(deletedIds);
  
  // Update all projects for this user with the meta data
  await update(
    `UPDATE user_projects 
     SET selected_project_id = ?, deleted_project_ids = ?, updated_at = NOW()
     WHERE user_id = ? AND owner_uid = ?`,
    [selectedProjectId || null, deletedJson, userId, userId]
  );
  
  return { success: true };
}

async function saveProjectWithMeta(project, userId, { selectedProjectId, deletedProjectIds }) {
  const sanitized = sanitizeProject(project, { uid: userId, email: project.owner_email || '' });
  
  // Check if project exists
  const existing = await queryOne(
    `SELECT project_id FROM user_projects 
     WHERE user_id = ? AND project_id = ?`,
    [userId, sanitized.project_id]
  );

  const duplicate = await queryOne(
    `SELECT project_id FROM user_projects
     WHERE user_id = ? AND LOWER(REPLACE(domain, 'www.', '')) = ?
       AND project_id <> ?
     LIMIT 1`,
    [userId, sanitized.domain, sanitized.project_id]
  );

  if (duplicate) {
    const error = new Error(`A project for ${sanitized.domain} already exists`);
    error.status = 409;
    throw error;
  }

  const fields = [
    'user_id', 'project_id', 'project_name', 'domain', 'full_url',
    'protocol', 'scope', 'folder', 'schedule', 'user_agent',
    'url_limit', 'total_urls', 'compare_to', 'crawled_on',
    'render_js', 'respect_robots', 'notify_email',
    'owner', 'owner_email', 'owner_uid', 'project_data',
    'selected_project_id', 'deleted_project_ids'
  ];

  const values = fields.map((field) =>
    field === 'user_id' ? userId : sanitized[field] ?? null
  );

  let sql;
  let projectSaveResult = null;
  let isNewProject = false;

  if (existing) {
    // Update existing project
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    sql = `UPDATE user_projects 
           SET ${setClause}, updated_at = NOW()
           WHERE user_id = ? AND project_id = ?`;
    values.push(userId, sanitized.project_id);
    projectSaveResult = await update(sql, values);
  } else {
    // Insert new project
    sql = `INSERT INTO user_projects (${fields.join(', ')}, created_at, updated_at) 
           VALUES (${fields.map(() => '?').join(', ')}, NOW(), NOW())`;
    projectSaveResult = await insert(sql, values);
    isNewProject = true;
  }

  // Save meta data
  const metaSaveResult = await saveMeta(userId, { selectedProjectId, deletedProjectIds });

  // Trigger module processing for new projects
  // This runs asynchronously without blocking the response
  if (isNewProject && acquireProcessingLock(sanitized.project_id)) {
    const fullUrl = sanitized.full_url || "";
    
    // Start module processing in the background
    processModulesSequentially(userId, sanitized.project_id, fullUrl)
      .then((processingResult) => {
        console.log(`[${sanitized.project_id}] Module processing completed:`, processingResult);
      })
      .catch((error) => {
        console.error(`[${sanitized.project_id}] Module processing error:`, error?.message);
      })
      .finally(() => {
        releaseProcessingLock(sanitized.project_id);
      });
  }

  return {
    success: true,
    project: sanitized,
    projectSaveResult,
    metaSaveResult,
  };
}

async function createProjectIfMissing(userId, projectId, projectUrl) {
  const row = await queryOne(
    `SELECT project_id FROM user_projects
     WHERE user_id = ? AND project_id = ? AND owner_uid = ?
     LIMIT 1`,
    [userId, projectId, userId]
  );

  if (row) return;

  let projectName = projectId;
  let domain = projectId;
  let fullUrl = projectUrl || "";

  try {
    const url = new URL(fullUrl);
    domain = url.hostname.replace(/^www\./i, "");
    projectName = domain;
    fullUrl = url.origin;
  } catch {
    // Keep the fallback values if projectUrl is invalid.
  }

  await insert(
    `INSERT IGNORE INTO user_projects
       (user_id, project_id, project_name, domain, full_url, project_data, selected_project_id, deleted_project_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NOW(), NOW())`,
    [userId, projectId, projectName, domain, fullUrl, JSON.stringify({}), JSON.stringify([])]
  );
}

async function saveToolResult(userId, projectId, toolKey, data) {
  // Confirm the project belongs to the signed-in user before creating a
  // result row for it. If the user has not yet created a project entry, create
  // a minimal placeholder first so the tool result can be saved.
  await createProjectIfMissing(userId, projectId, data.project_url);

  // Step 1: Save to tool_results table (dedicated storage for performance)
  const saveResult = await update(
    `INSERT INTO tool_results
       (user_id, project_id, tool_key, project_url, result, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       project_url = VALUES(project_url),
       result = VALUES(result),
       updated_at = NOW()`,
    [userId, projectId, toolKey, data.project_url, JSON.stringify(data.result)]
  );

  if (!saveResult.affectedRows) {
    const error = new Error("Could not save the tool result");
    error.status = 500;
    throw error;
  }

  // Step 2: Persist to project_data.toolResults while preserving unrelated project_data.
  const row = await queryOne(
    `SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1`,
    [userId, projectId]
  );

  const nextProjectData = mergeProjectDataWithToolResult(row?.project_data, toolKey, data.result);

  await update(
    `UPDATE user_projects
       SET project_data = ?, updated_at = NOW()
     WHERE user_id = ? AND project_id = ?`,
    [JSON.stringify(nextProjectData), userId, projectId]
  );

  return { success: true, projectId, toolKey, updatedAt: data.updated_at };
}

async function saveProjectData(userId, projectId, key, value) {
  const payload =
    projectId && typeof projectId === "object" && !Array.isArray(projectId)
      ? projectId
      : { projectId, key, value };

  const normalizedProjectId = normalizeDocumentId(payload.projectId, "Project id");
  const projectDataInput =
    payload.projectData && typeof payload.projectData === "object" && !Array.isArray(payload.projectData)
      ? payload.projectData
      : null;
  const normalizedKey = payload.key ? String(payload.key).trim() : "";
  const normalizedValue = payload.value !== undefined ? payload.value : null;

  if (projectDataInput) {
    const row = await queryOne(
      `SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? AND owner_uid = ? LIMIT 1`,
      [userId, normalizedProjectId, userId]
    );
    if (!row) {
      const error = new Error("Project was not found");
      error.status = 404;
      throw error;
    }

    const merged = {
      ...parseObjectField(row?.project_data),
      ...projectDataInput,
    };

    const result = await update(
      `UPDATE user_projects
         SET project_data = ?, updated_at = NOW()
       WHERE user_id = ? AND project_id = ? AND owner_uid = ?`,
      [JSON.stringify(merged), userId, normalizedProjectId, userId]
    );

    return { success: true, projectId: normalizedProjectId, projectData: merged };
  }

  if (!normalizedKey || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(normalizedKey)) {
    const error = new Error("Project data key is invalid");
    error.status = 400;
    throw error;
  }
  if (normalizedValue === null || normalizedValue === undefined || (typeof normalizedValue !== "object" && !Array.isArray(normalizedValue))) {
    const error = new Error("Project data value is required");
    error.status = 400;
    throw error;
  }

  const row = await queryOne(
    `SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? AND owner_uid = ? LIMIT 1`,
    [userId, normalizedProjectId, userId]
  );
  if (!row) {
    const error = new Error("Project was not found");
    error.status = 404;
    throw error;
  }

  const merged = mergeProjectDataPreservingKeys(row?.project_data, normalizedKey, normalizedValue);
  const result = await update(
    `UPDATE user_projects
       SET project_data = ?, updated_at = NOW()
     WHERE user_id = ? AND project_id = ? AND owner_uid = ?`,
    [JSON.stringify(merged), userId, normalizedProjectId, userId]
  );

  return { success: true, projectId: normalizedProjectId, key: normalizedKey, projectData: merged };
}

async function deleteProject(userId, projectId, selectedProjectId, deletedProjectIds) {
  // Delete the project
  await deleteQuery(
    `DELETE FROM user_projects 
     WHERE user_id = ? AND project_id = ? AND owner_uid = ?`,
    [userId, projectId, userId]
  );

  // Update meta if provided
  if (selectedProjectId !== undefined || deletedProjectIds !== undefined) {
    const meta = await loadUserMeta(userId);
    await saveMeta(userId, {
      selectedProjectId: selectedProjectId !== undefined ? selectedProjectId : meta.selectedProjectId,
      deletedProjectIds: deletedProjectIds !== undefined ? deletedProjectIds : meta.deletedProjectIds,
    });
  }

  return { success: true };
}

// Main request handler
export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, DELETE, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);

  try {
    // Preview middleware provides the parsed .env values here. Vite itself
    // does not expose them through process.env, which otherwise makes a valid
    // login token appear expired and leaves the project database unconfigured.
    configureMysqlConnection(env);
    const decoded = await verifyUser(request, env);
    const userId = decoded.uid;
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.get("action") === "toolResult") {
        const projectId = normalizeDocumentId(url.searchParams.get("projectId"), "Project id");
        const toolKey = normalizeToolKey(url.searchParams.get("toolKey"));
        const result = await loadToolResult(userId, projectId, toolKey);
        return jsonResponse({
          result: result?.result || null,
          updatedAt: result?.updatedAt || null,
          projectUrl: result?.projectUrl || "",
        }, 200, headers);
      }

      // Project inventory is scoped to the signed-in user.
      return jsonResponse(
        await loadProjects(userId),
        200,
        headers
      );
    }

    const body = await readJson(request);
    const action = body?.action || "";

    if (request.method === "POST") {
      if (action === "saveProjectWithMeta") {
        const result = await saveProjectWithMeta(
          body.project,
          userId,
          {
            selectedProjectId: body.selectedProjectId || body.project?.id,
            deletedProjectIds: body.deletedProjectIds,
          }
        );
        return jsonResponse(
          {
            success: true,
            project: result.project,
            projectSaveResult: result.projectSaveResult,
            metaSaveResult: result.metaSaveResult,
          },
          200,
          headers
        );
      }

      if (action === "saveMeta") {
        await saveMeta(userId, {
          selectedProjectId: body.selectedProjectId,
          deletedProjectIds: body.deletedProjectIds,
        });
        return jsonResponse({ success: true }, 200, headers);
      }

      if (action === "saveToolResult") {
        const { projectId, toolKey, data } = sanitizeToolResult(body, decoded);
        const result = await saveToolResult(userId, projectId, toolKey, data);
        return jsonResponse(result, 200, headers);
      }

      if (action === "saveProjectData") {
        const result = await saveProjectData(userId, body);
        return jsonResponse(result, 200, headers);
      }

      return jsonResponse({ error: "Invalid action" }, 400, headers);
    }

    if (request.method === "DELETE") {
      const projectId = String(body.projectId || "").trim();
      if (!projectId) return jsonResponse({ error: "Project id is required" }, 400, headers);

      const result = await deleteProject(
        userId,
        projectId,
        body.selectedProjectId,
        body.deletedProjectIds
      );
      return jsonResponse(result, 200, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
