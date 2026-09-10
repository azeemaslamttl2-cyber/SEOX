/**
 * Shared project field helpers.
 *
 * These mirror the normalisation and option lists used by the project creation
 * flow (`pages/auditor/NewProject.jsx`) so the editor writes exactly the same
 * shape that creation does, and both stay in step.
 */

export const PROTOCOLS = [
  { value: "https-http", label: "http + https" },
  { value: "https", label: "https only" },
  { value: "http", label: "http only" },
];

export const SCOPES = [
  { value: "subdomains", label: "Subdomains" },
  { value: "exact", label: "Exact URL" },
  { value: "path", label: "Path" },
];

export const SCHEDULES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "manual", label: "Manual only" },
];

export const USER_AGENTS = [
  { value: "seox-desktop", label: "SEOX Desktop" },
  { value: "seox-mobile", label: "SEOX Mobile" },
  { value: "googlebot-desktop", label: "Googlebot Desktop" },
  { value: "googlebot-mobile", label: "Googlebot Mobile" },
];

export function cleanScopeInput(value = "", { stripTrailingSlash = false } = {}) {
  let cleaned = String(value || "").trim().replace(/^(?:https?:)?\/\//i, "");
  if (stripTrailingSlash) cleaned = cleaned.replace(/\/+$/, "");
  return cleaned;
}

export function getProjectHost(value = "") {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const host = rawValue.replace(/^(?:https?:)?\/\//i, "").split("/")[0];
    return host.replace(/^www\./i, "").toLowerCase();
  }
}

export function normalizeProjectUrlValue(value = "", { stripTrailingSlash = false } = {}) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      const path = stripTrailingSlash ? url.pathname.replace(/\/+$/, "") : url.pathname;
      return `${url.hostname.replace(/^www\./i, "").toLowerCase()}${path}${url.search}${url.hash}`;
    } catch {
      // Fall through to the string fallback below.
    }
  }

  normalized = normalized.replace(/^(?:https?:)?\/\//i, "");
  if (stripTrailingSlash) normalized = normalized.replace(/\/+$/, "");
  return normalized.replace(/^www\./i, "").toLowerCase();
}

export function crawlProtocolPrefix(protocol) {
  return protocol === "http" ? "http://" : "https://";
}

export function buildCrawlUrl(domain, protocol) {
  const cleaned = cleanScopeInput(domain, { stripTrailingSlash: true });
  return cleaned ? `${crawlProtocolPrefix(protocol)}${cleaned}` : "";
}

export function isValidProjectDomain(value) {
  const normalized = normalizeProjectUrlValue(value, { stripTrailingSlash: true });
  return normalized.length > 3 && /\./.test(normalized);
}

/** Reads the editable fields off a stored project, tolerating both key styles. */
export function projectToFormValues(project) {
  const data = project?.project_data || {};
  return {
    name: project?.name || project?.project_name || "",
    domain: project?.domain || project?.fullUrl || project?.full_url || project?.url || "",
    protocol: project?.protocol || data.protocol || "https-http",
    scope: project?.scope || data.scope || "subdomains",
    folder: project?.folder || data.folder || "none",
    schedule: project?.schedule || data.schedule || "weekly",
    userAgent: project?.userAgent || project?.user_agent || data.userAgent || "seox-desktop",
    urlLimit: Number(project?.urlLimit || project?.url_limit || data.urlLimit || 10000),
    renderJs: Boolean(project?.renderJs ?? project?.render_js ?? data.renderJs ?? false),
    respectRobots: Boolean(project?.respectRobots ?? project?.respect_robots ?? data.respectRobots ?? true),
    notifyEmail: Boolean(project?.notifyEmail ?? project?.notify_email ?? data.notifyEmail ?? true),
  };
}

/**
 * Merges edited values back onto the stored project.
 *
 * Both the camelCase and snake_case keys are written because the API layer and
 * the crawl layer each read a different style, exactly as project creation does.
 * Everything not edited here (crawl results, ownership, created_at) is carried
 * through untouched.
 */
export function applyFormValuesToProject(project, values) {
  const domain = normalizeProjectUrlValue(values.domain, { stripTrailingSlash: true });
  const fullUrl = buildCrawlUrl(domain, values.protocol);
  const name = String(values.name || "").trim() || domain;
  const urlLimit = Math.max(1, Number(values.urlLimit) || 10000);
  const updatedAt = new Date().toISOString();

  return {
    ...project,
    name,
    project_name: name,
    domain,
    fullUrl,
    full_url: fullUrl,
    url: fullUrl,
    protocol: values.protocol,
    scope: values.scope,
    folder: values.folder,
    schedule: values.schedule,
    userAgent: values.userAgent,
    user_agent: values.userAgent,
    urlLimit,
    url_limit: urlLimit,
    renderJs: values.renderJs,
    render_js: values.renderJs,
    respectRobots: values.respectRobots,
    respect_robots: values.respectRobots,
    notifyEmail: values.notifyEmail,
    notify_email: values.notifyEmail,
    project_data: {
      ...(project?.project_data || {}),
      protocol: values.protocol,
      scope: values.scope,
      folder: values.folder,
      schedule: values.schedule,
      userAgent: values.userAgent,
      urlLimit,
      renderJs: values.renderJs,
      respectRobots: values.respectRobots,
      notifyEmail: values.notifyEmail,
    },
    updatedAt,
    updated_at: updatedAt,
  };
}

/**
 * Validates an edit against the other projects. The server enforces the same
 * uniqueness rule and returns 409, so this only avoids a pointless round trip.
 */
export function validateProjectForm(values, { projects = [], currentProjectId = "" } = {}) {
  const errors = {};

  if (!isValidProjectDomain(values.domain)) {
    errors.domain = "Enter a valid website domain, for example example.com";
  } else {
    const host = getProjectHost(values.domain);
    const normalized = normalizeProjectUrlValue(values.domain, { stripTrailingSlash: true });
    const clash = projects.some((project) => {
      if (String(project?.id) === String(currentProjectId)) return false;
      const existing = project?.domain || project?.full_url || project?.fullUrl || project?.url || "";
      return (
        (host && getProjectHost(existing) === host) ||
        normalizeProjectUrlValue(existing, { stripTrailingSlash: true }) === normalized
      );
    });
    if (clash) errors.domain = "Another project already uses this website.";
  }

  const urlLimit = Number(values.urlLimit);
  if (!Number.isFinite(urlLimit) || urlLimit < 1) {
    errors.urlLimit = "Enter a URL limit of at least 1.";
  }

  return errors;
}
