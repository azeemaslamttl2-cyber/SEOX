import { useMemo } from "react";
import { useCrawl } from "../context/CrawlContext.jsx";
import {
  getAuditDataForProject,
  localizeAuditValue,
} from "../data/auditorData.js";

export function useAuditData() {
  const { project, status, stats } = useCrawl();
  return useMemo(
    () => getAuditDataForProject(project, { status, stats }),
    [project, status, stats]
  );
}

export function useProjectScopedValue(value) {
  const { project } = useCrawl();
  return useMemo(() => localizeAuditValue(value, project), [value, project]);
}
