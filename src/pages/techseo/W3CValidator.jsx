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
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-[24px] border border-[#f0d7d4] bg-[#f7e9e7] p-5 shadow-[0_10px_30px_rgba(45,43,111,0.04)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7d7d5] ring-1 ring-[#e8bcbc]">
              <ShieldCheck className="h-7 w-7 text-[#d84f45]" />
            </div>
            <div>
              <h1 className="font-display text-[2.1rem] font-black leading-none text-[#2d2b6f]">W3C Structure Validation</h1>
              <p className="mt-2 max-w-2xl text-base text-[#4b4b73]">
                Validate the selected project's HTML structure and review structural issues from the W3C Nu validator.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={runValidation}
            disabled={isValidating || !hasProject}
            className="inline-flex items-center justify-center gap-3 rounded-[18px] bg-[#ea5b4a] px-6 py-4 text-base font-semibold text-white shadow-[0_10px_25px_rgba(234,91,74,0.25)] transition hover:-translate-y-0.5 hover:bg-[#dd4f42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isValidating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
            <span className="text-xl font-bold leading-none">
              {isValidating ? "Validating..." : result.status === "idle" ? "Run Validation" : "Run Validation Again"}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[26px] border border-[#f0d7d4] bg-[#fdf7f8] p-5 shadow-[0_10px_30px_rgba(45,43,111,0.03)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Globe className="h-5 w-5 flex-shrink-0 text-[#d84f45]" />
            <span className="flex-shrink-0 text-sm font-semibold uppercase tracking-[0.18em] text-[#544f88]">Project URL</span>
            <span className="max-w-3xl truncate text-lg font-semibold text-[#2d2b6f]">{displayUrl}</span>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm ${statusMeta.className}`}>
            <statusIcon className="h-4 w-4" />
            {statusMeta.label}
          </div>
        </div>

        {(!hasProject || !projectUrl) && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-base text-amber-800">
            Select a project in the navbar and make sure it has a valid website URL before running validation.
          </div>
        )}

        {(localError || persistenceError) && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {localError || persistenceError}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-4">
        <StatCard label="Status" value={statusMeta.label} tone={result.status === "valid" ? "success" : result.status === "issues" ? "danger" : result.status === "warning" ? "warning" : "neutral"} />
        <StatCard label="Errors" value={String(result.totalErrors || 0)} tone="danger" />
        <StatCard label="Warnings" value={String(result.totalWarnings || 0)} tone="warning" />
        <StatCard label="Info" value={String(totalInfoMessages || 0)} tone="neutral" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_2.2fr]">
        <aside className="flex min-h-[220px] flex-col justify-between rounded-[26px] border border-[#f0d7d4] bg-[#f9f4f5] p-5 shadow-[0_10px_30px_rgba(45,43,111,0.03)]">
          <div>
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-[#6f6b9c]">Validation</div>
            <div className="mt-4 text-4xl font-black leading-none text-[#2d2b6f]" aria-label="validation date">
              {result.generatedAt ? new Date(result.generatedAt).toLocaleString("en-US", { month: "short" }) : "Aug"}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="text-3xl font-black leading-tight text-[#2d2b6f]">{result.generatedAt ? new Date(result.generatedAt).getDate() : "31"}</div>
            <div className="text-xl font-bold uppercase tracking-[0.08em] text-[#2d2b6f]">Validation Summary</div>
            <div className="text-sm font-medium text-[#5d5a86]">
              {result.generatedAt ? new Date(result.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "5:20 PM"}
            </div>
          </div>
        </aside>

        <div className="rounded-[26px] border border-[#f0d7d4] bg-[#fdf7f8] p-6 shadow-[0_10px_30px_rgba(45,43,111,0.03)]">
          <div className="mb-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[#d84f45]" />
            <h2 className="text-lg font-bold uppercase tracking-[0.14em] text-[#4a4777]">Issue Details</h2>
          </div>

          <div className="space-y-4">
            {Array.isArray(result.messages) && result.messages.length > 0 ? (
              result.messages.map((item, index) => (
                <div key={`${item.type}-${index}`} className="rounded-[18px] border border-[#f1dfdc] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] ${item.type === "error" ? "bg-rose-100 text-rose-700" : item.type === "warning" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                      {item.type}
                    </span>
                    {item.location && <span className="flex-shrink-0 text-sm text-[#6d6a95]">{item.location}</span>}
                  </div>
                  <p className="mt-3 text-lg font-medium text-[#2d2b6f]">{item.message || "No message available."}</p>
                  {item.source && <pre className="mt-3 overflow-auto rounded-lg bg-[#f4f3f9] p-3 font-mono text-sm text-[#3d3b61]">{item.source}</pre>}
                  {item.url && <p className="mt-3 break-all text-sm text-[#6d6a95]">Source: {item.url}</p>}
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#ebd5d0] bg-[#f9f4f5] p-6 text-lg text-[#4b4b73]">
                No HTML validation issues were reported for this page.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }) {
  const palette = {
    neutral: "border-[#f0d7d4] bg-[#fdf7f8] text-[#2d2b6f]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-[26px] border p-6 shadow-[0_10px_30px_rgba(45,43,111,0.03)] ${palette[tone]}`}>
      <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#5a5789]">{label}</div>
      <div className="mt-4 text-5xl font-black leading-none text-[#2d2b6f]">{value}</div>
    </div>
  );
}
