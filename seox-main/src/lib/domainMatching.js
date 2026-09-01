import { normalizeToolUrl } from "./techSeoTools.js";

export function normalizedHost(rawUrl = "") {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("sc-domain:")) {
    return value.replace("sc-domain:", "").replace(/^www\./i, "").toLowerCase();
  }

  try {
    return new URL(normalizeToolUrl(value)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
  }
}

export function projectUrlFor(project) {
  return String(project?.fullUrl || project?.url || project?.domain || "").trim();
}

export function siteUrlFor(site) {
  return site?.siteUrl || site?.url || site || "";
}

export function siteMatchesProject(site, project) {
  const siteHost = normalizedHost(siteUrlFor(site));
  const projectHost = normalizedHost(projectUrlFor(project));
  return Boolean(siteHost && projectHost && siteHost === projectHost);
}

export function filterSitesByProjects(sites = [], projects = []) {
  const projectHosts = new Set(
    (projects || [])
      .map((project) => normalizedHost(projectUrlFor(project)))
      .filter(Boolean)
  );
  if (!projectHosts.size) return [];
  return (sites || []).filter((site) => projectHosts.has(normalizedHost(siteUrlFor(site))));
}
