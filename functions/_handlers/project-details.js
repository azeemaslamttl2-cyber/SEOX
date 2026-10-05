const MAX_TOKEN_LENGTH = 512;
const MAX_PROJECT_ID_LENGTH = 255;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseProjectData(value) {
  if (value == null || value === "") return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeProjectDomain(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const fallback = String(value || "").trim().replace(/^https?:\/\//i, "");
    return fallback.split(/[\/\?]/)[0].replace(/^www\./i, "").toLowerCase();
  }
}

/**
 * Extracts a specific feature from project data.
 * Features are stored as top-level properties in projectData (eeat, speed_test, robots, etc.)
 * and may be stored as JSON strings that need parsing.
 * 
 * @param {Object} projectData - The parsed project data
 * @param {string} featureName - The requested feature name (lowercase)
 * @returns {Object} - The filtered feature data or throws an error if feature not found
 */
function extractFeatureData(projectData, featureName) {
  if (!featureName) return projectData; // Return all data if no feature requested

  const featureAliases = {
    branded_keywords: "branded-keywords",
    branded_keyword: "branded-keywords",
    low_hanging_keywords: "low-hanging-keywords",
    lost_keyword: "lost-keywords",
    lost_keywords: "lost-keywords",
    "gsc-audit": "gsc_audit",
    "gsc-insights": "gsc_insights",
  };
  const canonicalFeatureName = featureAliases[featureName] || featureName;

  // List of metadata fields that are not features
  const metadataFields = new Set([
    "owner",
    "scope",
    "folder",
    "ownerUid",
    "protocol",
    "renderJs",
    "schedule",
    "urlLimit",
    "createdAt",
    "userAgent",
    "ownerEmail",
    "notifyEmail",
    "respectRobots",
  ]);

  // Try direct lookup first
  if (projectData.hasOwnProperty(canonicalFeatureName) && !metadataFields.has(canonicalFeatureName)) {
    const featureValue = projectData[canonicalFeatureName];
    // Parse JSON string if needed
    const parsedValue = typeof featureValue === "string" ? parseProjectData(featureValue) : featureValue;
    return {
      [canonicalFeatureName]: parsedValue,
    };
  }

  // Try speed_test as speed (normalization)
  if (featureName === "speed" && projectData.hasOwnProperty("speed_test")) {
    const featureValue = projectData.speed_test;
    const parsedValue = typeof featureValue === "string" ? parseProjectData(featureValue) : featureValue;
    return {
      speed_test: parsedValue,
    };
  }

  // Find all available features (non-metadata properties)
  const availableFeatures = Object.keys(projectData).filter((key) => !metadataFields.has(key));

  // Feature not found
  const error = new Error(
    `Feature '${featureName}' not found or not available for this project. Available features include: ${availableFeatures.join(", ") || "none"}`
  );
  error.status = 404;
  throw error;
}

export function validateProjectDetailsInput({ admin_token, url, full_url, project_url, project_id, feature, refresh } = {}) {
  const adminToken = typeof admin_token === "string" ? admin_token.trim() : "";
  const rawUrl = typeof url === "string" ? url.trim() : typeof full_url === "string" ? full_url.trim() : typeof project_url === "string" ? project_url.trim() : "";
  const projectId = typeof project_id === "string" ? project_id.trim() : "";
  const featureName = typeof feature === "string" ? feature.trim().toLowerCase() : "";

  if (!adminToken) throw badRequest("admin_token is required");
  if (adminToken.length > MAX_TOKEN_LENGTH) throw badRequest("admin_token is too long");

  // Accept either a project_id or a URL. Prefer project_id when both are provided.
  if (!projectId && !rawUrl) throw badRequest("project_id or url is required");
  if (projectId && projectId.length > MAX_PROJECT_ID_LENGTH) throw badRequest("project_id is too long");

  const projectDomain = rawUrl ? normalizeProjectDomain(rawUrl) : "";
  if (!projectId) {
    if (!projectDomain) throw badRequest("url is invalid");
  }

  const refreshGsc = ["1", "true", "yes"].includes(String(refresh ?? "").trim().toLowerCase());

  return { adminToken, url: rawUrl, projectDomain, projectId, feature: featureName, refresh: refreshGsc };
}

/**
 * Fetches a project after authenticating the supplied administrator token.
 * queryOne is injected to keep the request logic independently testable.
 */
export function validateProjectCreateInput({ admin_token, project_id, project_name, full_url, project_data } = {}) {
  const adminToken = typeof admin_token === "string" ? admin_token.trim() : "";
  const projectId = typeof project_id === "string" ? project_id.trim() : "";
  const projectName = typeof project_name === "string" ? project_name.trim() : project_name;
  const fullUrl = typeof full_url === "string" ? full_url.trim() : full_url;
  const data = parseProjectData(project_data);

  if (!adminToken) throw badRequest("admin_token is required");
  if (adminToken.length > MAX_TOKEN_LENGTH) throw badRequest("admin_token is too long");
  if (!projectId) throw badRequest("project_id is required");
  if (projectId.length > MAX_PROJECT_ID_LENGTH) throw badRequest("project_id is too long");
  if (!projectName) throw badRequest("project_name is required");
  if (!fullUrl) throw badRequest("full_url is required");

  return { adminToken, projectId, projectName, fullUrl, projectData: data };
}

// Which GSC modules a `feature` filter asks for. No filter means all of them;
// any other feature (speed, eeat, gsc, ...) triggers no Google call at all.
const GSC_FEATURE_MODULES = {
  gsc_audit: ["gsc_audit"],
  "gsc-audit": ["gsc_audit"],
  gsc_insights: ["gsc_insights"],
  "gsc-insights": ["gsc_insights"],
};
const ALL_GSC_MODULES = ["gsc_audit", "gsc_insights"];

/**
 * `resolveGscData` is optional so the handler stays usable (and testable)
 * without Google/network access; when supplied it adds the GSC Audit and GSC
 * Insights results to project_data.gsc_audit / gsc_insights. It must never throw.
 */
export function createProjectDetailsHandler(queryOne, { resolveGscData, env } = {}) {
  if (typeof queryOne !== "function") throw new TypeError("queryOne must be a function");

  return async function getProjectDetails(input) {
    const { adminToken, projectDomain, projectId, feature, refresh } = validateProjectDetailsInput(input);

    const admin = await queryOne(
      `SELECT id
       FROM users
       WHERE admin_token = ?
         AND is_active = 1
         AND deleted_at IS NULL
       LIMIT 1`,
      [adminToken]
    );

    if (!admin) {
      const error = new Error("Invalid admin token");
      error.status = 401;
      throw error;
    }

    let project = null;
    if (projectId) {
      project = await queryOne(
        `SELECT project_id, project_data, full_url, project_name, user_id, domain
         FROM user_projects
         WHERE project_id = ?
         LIMIT 1`,
        [projectId]
      );
    } else {
      project = await queryOne(
        `SELECT project_id, project_data, full_url, project_name, user_id, domain
         FROM user_projects
         WHERE domain = ?
         LIMIT 1`,
        [projectDomain]
      );
    }

    if (!project) {
      const error = new Error("Project not found");
      error.status = 404;
      throw error;
    }

    // user_id/domain are selected only to locate the owner's GSC connection;
    // they were never part of this response, so they stay out of it.
    const { user_id: ownerId, domain: projectRowDomain, ...publicProject } = project;
    let parsedProjectData = parseProjectData(project.project_data);

    const gscStatuses = {};
    const wantedGsc = feature ? GSC_FEATURE_MODULES[feature] || [] : ALL_GSC_MODULES;
    if (typeof resolveGscData === "function" && wantedGsc.length) {
      const results = await resolveGscData({
        env,
        project: { ...project, user_id: ownerId, domain: projectRowDomain },
        saved: Object.fromEntries(wantedGsc.map((key) => [key, parsedProjectData[key]])),
        want: wantedGsc,
        force: refresh,
      });
      for (const key of wantedGsc) {
        const result = results?.[key];
        if (!result) continue;
        if (result.data) parsedProjectData = { ...parsedProjectData, [key]: result.data };
        // A feature request for a module that failed with nothing saved gets
        // null plus the error status, not a 404 about a missing feature.
        else if (feature && !(key in parsedProjectData)) parsedProjectData = { ...parsedProjectData, [key]: null };
        gscStatuses[`${key}_status`] = {
          status: result.status,
          ...(result.error ? { error: result.error } : {}),
          ...(result.data?.fetchedAt ? { fetched_at: result.data.fetchedAt } : {}),
        };
      }
    }

    // If a specific feature is requested, filter the project data
    const filteredProjectData = feature ? extractFeatureData(parsedProjectData, feature) : parsedProjectData;

    return {
      ...publicProject,
      project_data: filteredProjectData,
      ...gscStatuses,
    };
  };
}

export function createProjectInsertHandler(queryOne, query) {
  if (typeof queryOne !== "function") throw new TypeError("queryOne must be a function");
  if (typeof query !== "function") throw new TypeError("query must be a function");

  return async function insertProject(input) {
    const { adminToken, projectId, projectName, fullUrl, projectData } = validateProjectCreateInput(input);

    const admin = await queryOne(
      `SELECT id
       FROM users
       WHERE admin_token = ?
         AND is_active = 1
         AND deleted_at IS NULL
       LIMIT 1`,
      [adminToken]
    );

    if (!admin) {
      const error = new Error("Invalid admin token");
      error.status = 401;
      throw error;
    }

    const existingProject = await queryOne(
      `SELECT project_id
       FROM user_projects
       WHERE user_id = ?
         AND project_id = ?
       LIMIT 1`,
      [admin.id, projectId]
    );

    if (existingProject) {
      const error = new Error("Project ID already exists");
      error.status = 409;
      throw error;
    }

    const domain = normalizeProjectDomain(fullUrl);
    const existingUrlProject = await queryOne(
      `SELECT project_id
       FROM user_projects
       WHERE user_id = ?
         AND domain = ?
       LIMIT 1`,
      [admin.id, domain]
    );

    if (existingUrlProject) {
      const error = new Error("Website URL already exists");
      error.status = 409;
      throw error;
    }

    const now = new Date().toISOString().replace(/T/, " ").replace(/Z$/, "");

    await query(
      `INSERT INTO user_projects
         (user_id, project_id, project_name, domain, full_url, project_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        admin.id,
        projectId,
        projectName,
        domain,
        fullUrl,
        JSON.stringify(projectData),
        now,
        now,
      ]
    );

    return {
      project_id: projectId,
      project_name: projectName,
      full_url: fullUrl,
      domain,
      project_data: projectData,
      created_at: now,
      updated_at: now,
    };
  };
}
