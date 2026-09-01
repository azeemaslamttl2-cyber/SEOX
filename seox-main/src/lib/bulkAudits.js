/**
 * Bulk audit runner.
 * Adapts the existing project tool checks for CSV imports instead of keeping a
 * separate scoring model in the CSV reporter.
 */
import {
  PROJECT_TOOL_DEFS,
  averageCompletedScore,
  runProjectToolChecks,
} from "./projectToolChecks.js";
import { normalizeToolUrl } from "./techSeoTools.js";

export const BULK_REPORT_TOOL_DEFS = PROJECT_TOOL_DEFS;

function hostFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(rawUrl || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
  }
}

function statusLabel(status) {
  const labels = {
    complete: "Complete",
    error: "Error",
    queued: "Queued",
    running: "Running",
    skipped: "Skipped",
  };
  return labels[status] || "Pending";
}

function fallbackCheck(tool) {
  const status = tool?.status || "queued";
  const hasScore = Number.isFinite(tool?.score);
  return {
    name: tool?.summary || statusLabel(status),
    pass: status === "complete" && (!hasScore || tool.score >= 70),
    detail: tool?.detail || statusLabel(status),
    status,
  };
}

function normalizeChecks(tool) {
  const source = Array.isArray(tool?.checks) && tool.checks.length ? tool.checks : [fallbackCheck(tool)];
  return source.map((check) => ({
    name: check.name || check.label || "Check",
    pass: Boolean(check.pass),
    detail: check.detail || "",
    status: check.status || (check.pass ? "complete" : "needs_attention"),
  }));
}

function toolToCategory(def, tool = {}) {
  const score = Number.isFinite(tool.score) ? Math.round(tool.score) : null;
  const checks = normalizeChecks(tool);
  return {
    key: def.key,
    name: tool.label || def.label,
    href: def.href,
    group: def.group,
    status: tool.status || "queued",
    score,
    summary: tool.summary || statusLabel(tool.status),
    detail: tool.detail || "",
    passed: checks.filter((check) => check.pass).length,
    total: checks.length,
    checks,
  };
}

function projectFromUrl(rawUrl) {
  const fullUrl = normalizeToolUrl(rawUrl);
  const host = hostFromUrl(fullUrl);
  return {
    id: `bulk:${host}`,
    domain: host,
    url: fullUrl,
    fullUrl,
  };
}

export async function runAllAudits(rawUrl, options = {}) {
  const project = projectFromUrl(rawUrl);
  const state = await runProjectToolChecks(project, {
    ...options,
    persist: false,
  });
  const categories = PROJECT_TOOL_DEFS.map((def) => toolToCategory(def, state.tools?.[def.key]));

  return {
    url: state.projectUrl || project.fullUrl,
    overallScore: averageCompletedScore(state.tools),
    categories,
    completedTools: categories.filter((cat) => cat.status === "complete" && Number.isFinite(cat.score)).length,
    totalTools: categories.length,
  };
}
