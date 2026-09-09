import { useMemo } from "react";
import { useCrawl } from "../context/CrawlContext.jsx";

const KEY_ALIASES = {
  new: ["new-keywords", "newKeywords"],
  "low-hanging": ["low-hanging-keywords", "lowHangingKeywords"],
  lost: ["lost-keywords", "lostKeywords"],
  branded: ["branded-keywords", "brandedKeywords"],
  cannibalization: ["cannibalization", "keyword-cannibalization"],
};

function readProjectData(project, kind) {
  const projectData = project?.project_data || project?.projectData;
  if (!projectData || typeof projectData !== "object") return null;

  for (const key of KEY_ALIASES[kind] || []) {
    const value = projectData[key];
    if (value != null) return value;
  }
  return null;
}

export function useSavedKeywordAnalysis(kind) {
  const { project, storageReady } = useCrawl();
  const saved = useMemo(() => readProjectData(project, kind), [kind, project]);

  return useMemo(() => ({
    project,
    saved,
    hasSavedData: saved != null,
    isLoading: !storageReady,
  }), [project, saved, storageReady]);
}
