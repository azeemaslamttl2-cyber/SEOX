import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  RefreshCw,
  ShieldCheck,
  Info,
} from "lucide-react";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const EMPTY_W3C_RESULT = {
  status: "idle",
  totalErrors: 0,
  totalWarnings: 0,
  totalMessages: 0,
  url: "",
  generatedAt: null,
  validator: {
    name: "W3C Nu Html Checker",
    docs: "https://validator.w3.org/nu/about.html",
  },
  messages: [],
};

function formatTimestamp(value) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function W3CValidator() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result: savedResult, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "w3c-validation",
    project,
    projectUrl,
    emptyResult: EMPTY_W3C_RESULT,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [localError, setLocalError] = useState("");

  const result = savedResult && typeof savedResult === "object" ? savedResult : EMPTY_W3C_RESULT;
  const totalInfoMessages = Array.isArray(result.messages)
    ? result.messages.filter((item) => String(item?.type || "").toLowerCase() === "info").length
    : 0;

  const statusMeta = useMemo(() => {
    if (result.status === "valid") {
      return { label: "Valid", className: "bg-emerald-50 text-emerald-700 border border-emerald-200", Icon: CheckCircle2 };
    }
    if (result.status === "warning") {
      return { label: "Warnings Found", className: "bg-amber-50 text-amber-700 border border-amber-200", Icon: AlertTriangle };
    }
    if (result.status === "issues") {
      return { label: "Issues Found", className: "bg-rose-50 text-rose-700 border border-rose-200", Icon: AlertTriangle };
    }
    return { label: "Not Run", className: "bg-slate-100 text-slate-600 border border-slate-200", Icon: Info };
  }, [result.status]);

  async function runValidation() {
    if (!hasProject || !projectUrl) {
      setLocalError("Select a project with a valid website URL before running W3C validation.");
      return;
    }

    setLocalError("");
    setIsValidating(true);

    try {
      const url = new URL("/api/tech-seo/w3c/validate", window.location.origin);
      url.searchParams.set("url", projectUrl);
      if (project?.id) url.searchParams.set("projectId", String(project.id));

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `W3C validation failed with HTTP ${response.status}`);
      }

      const normalized = {
        ...EMPTY_W3C_RESULT,
        ...payload,
        url: payload?.url || projectUrl,
        messages: Array.isArray(payload?.messages) ? payload.messages : [],
        validator: payload?.validator || EMPTY_W3C_RESULT.validator,
      };

      await saveResult(normalized);
    } catch (error) {
      setLocalError(error?.message || "W3C validation is unavailable right now.");
    } finally {
      setIsValidating(false);
    }
  }

  const statusIcon = statusMeta.Icon;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ─── Hero Header ─── */}
      <div className="w3c-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="w3c-title flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <h1 className="font-display">W3C Structure Validation</h1>
              <p>
                Validate the selected project&apos;s HTML structure and review structural issues from the W3C Nu validator.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={runValidation}
            disabled={isValidating || !hasProject}
            className="ui-button ui-button-primary w3c-run-button"
          >
            {isValidating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {isValidating ? "Validating..." : result.status === "idle" ? "Run Validation" : "Run Validation Again"}
          </button>
        </div>

        {/* Project + status meta row */}
        <div className="w3c-meta">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span className="w3c-meta-label">Project URL</span>
            <span className="w3c-meta-value truncate">{displayUrl}</span>
          </div>
          <div className={`w3c-status ${statusMeta.className}`}>
            <statusIcon className="h-3.5 w-3.5" />
            {statusMeta.label}
          </div>
        </div>

        {(!hasProject || !projectUrl) && (
          <div className="app-alert app-alert-warning mt-4">
            Select a project in the navbar and make sure it has a valid website URL before running validation.
          </div>
        )}

        {(localError || persistenceError) && (
          <div className="app-alert app-alert-error mt-3">
            {localError || persistenceError}
          </div>
        )}
      </div>

      {/* ─── Summary metrics ─── */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Status" value={statusMeta.label} tone={result.status === "valid" ? "success" : result.status === "issues" ? "danger" : result.status === "warning" ? "warning" : "neutral"} />
        <StatCard label="Errors" value={String(result.totalErrors || 0)} tone="danger" />
        <StatCard label="Warnings" value={String(result.totalWarnings || 0)} tone="warning" />
        <StatCard label="Info" value={String(totalInfoMessages || 0)} tone="neutral" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[300px_1fr]">
        {/* ─── Last run ─── */}
        <aside className="w3c-card">
          <div className="w3c-card-label">Validation</div>
          <div className="w3c-runtime">{formatTimestamp(result.generatedAt)}</div>
          <p className="w3c-card-note">
            {result.validator?.name || "W3C Nu Html Checker"}
          </p>
          {result.validator?.docs && (
            <a
              className="w3c-card-link"
              href={result.validator.docs}
              target="_blank"
              rel="noopener noreferrer"
            >
              About this validator
            </a>
          )}
        </aside>

        {/* ─── Issues ─── */}
        <div className="w3c-card">
          <div className="app-section-header">
            <div className="admin-section-title">
              <AlertTriangle className="h-4 w-4" />
              Issue Details
            </div>
            <span className="w3c-card-label">
              {Array.isArray(result.messages) ? result.messages.length : 0} total
            </span>
          </div>

          <div className="space-y-3">
            {Array.isArray(result.messages) && result.messages.length > 0 ? (
              result.messages.map((item, index) => (
                <div key={`${item.type}-${index}`} className="w3c-issue">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`admin-badge ${item.type === "error" ? "badge-error" : item.type === "warning" ? "badge-warning" : "badge-info"}`}>
                      {item.type}
                    </span>
                    {item.location && <span className="w3c-issue-location">{item.location}</span>}
                  </div>
                  <p className="w3c-issue-message">{item.message || "No message available."}</p>
                  {item.source && <pre className="w3c-issue-source">{item.source}</pre>}
                  {item.url && <p className="w3c-issue-url">Source: {item.url}</p>}
                </div>
              ))
            ) : (
              <div className="app-empty-state">
                <CheckCircle2 className="h-6 w-6" />
                <p>No HTML validation issues were reported for this page.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`w3c-stat w3c-stat-${tone}`}>
      <div className="w3c-stat-label">{label}</div>
      <div className="w3c-stat-value">{value}</div>
    </div>
  );
}
