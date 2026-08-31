import { useMemo } from "react";
import { useCrawl } from "../context/CrawlContext.jsx";

function normalizeProjectUrl(project) {
  const raw = String(project?.fullUrl || project?.url || project?.domain || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return "";
  }
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function useSelectedProjectDomain() {
  const { project } = useCrawl();

  return useMemo(() => {
    const projectUrl = normalizeProjectUrl(project);
    const projectDomain = hostnameFromUrl(projectUrl);
    return {
      project,
      projectUrl,
      projectDomain,
      hasProject: Boolean(projectUrl),
      displayUrl: projectUrl || "Select a website in the nav",
    };
  }, [project]);
}
