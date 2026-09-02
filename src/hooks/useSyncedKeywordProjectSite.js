import { useEffect, useMemo } from "react";
import { useSelectedProjectDomain } from "./useSelectedProjectDomain.js";
import { useCrawl } from "../context/CrawlContext.jsx";

function domainForSite(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("sc-domain:")) return raw.slice("sc-domain:".length).replace(/^www\./i, "").toLowerCase();
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function matchingSite(sites, projectUrl, projectDomain) {
  if (!projectUrl || !projectDomain) return "";
  const exact = sites.find((site) => String(site?.siteUrl || "").replace(/\/$/, "") === projectUrl.replace(/\/$/, ""));
  if (exact) return exact.siteUrl;
  const domainProperty = sites.find((site) => String(site?.siteUrl || "").toLowerCase() === `sc-domain:${projectDomain}`);
  if (domainProperty) return domainProperty.siteUrl;
  return sites.find((site) => domainForSite(site?.siteUrl) === projectDomain)?.siteUrl || "";
}

// The top-bar CrawlContext project is the authority. Keyword page selectors
// mirror its matching Search Console property and never retain another site.
export function useSyncedKeywordProjectSite(gsc) {
  const selectedProject = useSelectedProjectDomain();
  const { projects, selectProject } = useCrawl();
  const site = useMemo(
    () => matchingSite(gsc.sites || [], selectedProject.projectUrl, selectedProject.projectDomain),
    [gsc.sites, selectedProject.projectDomain, selectedProject.projectUrl]
  );

  useEffect(() => {
    if (!selectedProject.hasProject) {
      if (gsc.selectedSite) gsc.setSelectedSite("");
      return;
    }
    // Clear a prior project's property immediately while the matching GSC
    // property is being resolved. This prevents an old project's data load.
    if (!site) {
      if (gsc.selectedSite && domainForSite(gsc.selectedSite) !== selectedProject.projectDomain) gsc.setSelectedSite("");
      return;
    }
    if (gsc.selectedSite !== site) gsc.setSelectedSite(site);
  }, [gsc, selectedProject.hasProject, selectedProject.projectDomain, site]);

  const syncProjectForSite = (nextSite) => {
    const nextDomain = domainForSite(nextSite);
    const nextProject = projects.find((candidate) => {
      const raw = String(candidate?.fullUrl || candidate?.url || candidate?.domain || "");
      return domainForSite(raw) === nextDomain;
    });
    if (nextProject?.id) selectProject(nextProject.id);
  };

  return { ...selectedProject, selectedSite: site, hasMatchingGscSite: Boolean(site), syncProjectForSite };
}
