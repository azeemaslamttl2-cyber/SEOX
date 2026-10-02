import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, History, Info, Loader2, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react";
import JiraAdminTokenGate from "../jira/JiraAdminTokenGate.jsx";
import { getJiraAdminToken } from "../../lib/jiraAdminToken.js";
import { prepareUrls } from "../../lib/indexingUrls.js";
import { fetchIndexingHistory, fetchIndexingStatus, submitIndexingUrls } from "../../lib/googleIndexingApi.js";

const CONCURRENCY = 3;

const STATUS_META = {
  pending: { label: "Pending", cls: "text-white/50 bg-white/[0.05]", Icon: Clock },
  processing: { label: "Processing", cls: "text-sky-300 bg-sky-500/10", Icon: Loader2 },
  submitted: { label: "Submitted to Google", cls: "text-emerald-300 bg-emerald-500/10", Icon: CheckCircle2 },
  already_submitted: { label: "Already submitted", cls: "text-amber-300 bg-amber-500/10", Icon: Info },
  failed: { label: "Failed", cls: "text-rose-300 bg-rose-500/10", Icon: XCircle },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} /> {meta.label}
    </span>
  );
}

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function GoogleIndexingPanel({ onSubmittedChange }) {
  const [adminToken, setAdminToken] = useState(() => getJiraAdminToken());
  const [text, setText] = useState("");
  const [type, setType] = useState("URL_UPDATED");
  const [force, setForce] = useState(false);
  const [rows, setRows] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);
  const [running, setRunning] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState({ items: [], loading: false, error: "" });
  const cancelled = useRef(false);

  const parsed = useMemo(() => prepareUrls(text), [text]);

  const loadHistory = useCallback(async () => {
    if (!getJiraAdminToken()) return;
    setHistory((h) => ({ ...h, loading: true, error: "" }));
    try {
      const data = await fetchIndexingHistory({ limit: 50 });
      setHistory({ items: data.items, loading: false, error: "" });
    } catch (caught) {
      setHistory((h) => ({ ...h, loading: false, error: caught.message }));
    }
  }, []);

  useEffect(() => {
    if (!adminToken) {
      setConfig(null);
      return;
    }
    let live = true;
    fetchIndexingStatus()
      .then((data) => live && setConfig(data))
      .catch((caught) => live && setConfig({ configured: false, message: caught.message }));
    loadHistory();
    return () => {
      live = false;
    };
  }, [adminToken, loadHistory]);

  useEffect(() => () => {
    cancelled.current = true;
  }, []);

  const patchRow = (url, patch) => setRows((current) => current.map((row) => (row.url === url ? { ...row, ...patch } : row)));

  async function submit() {
    if (running || !parsed.valid.length) return;
    cancelled.current = false;
    setBatchError("");
    setInvalidRows(parsed.invalid);
    const queue = parsed.valid.map((item) => item.url);
    setRows(queue.map((url) => ({ url, status: "pending", message: "", submittedAt: "" })));
    setRunning(true);

    let halt = null;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length && !cancelled.current) {
        const url = queue[cursor++];
        if (halt) {
          patchRow(url, { status: "failed", message: halt, submittedAt: new Date().toISOString() });
          continue;
        }
        patchRow(url, { status: "processing" });
        try {
          const data = await submitIndexingUrls({ urls: [url], type, force });
          const result = data.results[0];
          if (result) patchRow(url, { status: result.status, message: result.message, code: result.code, submittedAt: result.submittedAt });
          if (result?.status === "failed" && (result.code === "QUOTA_EXCEEDED" || result.code === "AUTH_FAILED" || result.code === "API_DISABLED")) {
            halt = result.message;
          }
        } catch (caught) {
          // A request-level failure (config, auth, network) - same message for the rest.
          patchRow(url, { status: "failed", message: caught.message, code: caught.code, submittedAt: new Date().toISOString() });
          if (caught.code === "NOT_CONFIGURED" || caught.code === "BAD_CONFIG" || caught.code === "AUTH_FAILED" || caught.status === 401) {
            halt = caught.message;
            setBatchError(caught.message);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
    loadHistory();
  }

  const summary = useMemo(() => {
    const count = (status) => rows.filter((row) => row.status === status).length;
    return {
      total: rows.length + invalidRows.length,
      submitted: count("submitted"),
      failed: count("failed"),
      already: count("already_submitted"),
      invalid: invalidRows.length,
      done: rows.filter((row) => row.status !== "pending" && row.status !== "processing").length,
    };
  }, [rows, invalidRows]);

  useEffect(() => {
    onSubmittedChange?.(summary.submitted);
  }, [summary.submitted, onSubmittedChange]);

  const progress = rows.length ? Math.round((summary.done / rows.length) * 100) : 0;

  return (
    <div className="mt-5 space-y-5">
      {!adminToken && <JiraAdminTokenGate token={adminToken} onChange={setAdminToken} />}

      {adminToken && config && !config.configured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Google Indexing API is not ready</p>
            <p className="mt-1 text-xs text-amber-200/80">{config.message}</p>
          </div>
        </div>
      )}

      {adminToken && config?.configured && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-xs text-emerald-200/90">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Submitting as <span className="font-mono">{config.clientEmail}</span>. This account must be an <b>Owner</b> of each site in Google Search
            Console, and the Web Search Indexing API must be enabled for its Google Cloud project.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white/85">URLs to submit to Google</span>
          <span className="text-xs text-white/30">
            {parsed.valid.length} valid
            {parsed.invalid.length > 0 && <span className="text-rose-300"> · {parsed.invalid.length} invalid</span>}
            {parsed.duplicates.length > 0 && <span className="text-amber-300"> · {parsed.duplicates.length} duplicate</span>}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          disabled={running}
          className="w-full resize-none rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          placeholder={"One URL per line\n\nhttps://example.com/my-page\nhttps://example.com/another-page"}
        />

        {parsed.invalid.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs text-rose-200">
            {parsed.invalid.slice(0, 10).map((item, i) => (
              <li key={i}>
                <span className="font-mono">{item.url}</span> - {item.reason}
              </li>
            ))}
            {parsed.invalid.length > 10 && <li>…and {parsed.invalid.length - 10} more. Invalid URLs are never sent to Google.</li>}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
          <label className="flex items-center gap-2">
            Action
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={running}
              className="rounded-lg border border-white/[0.08] bg-ink-900/80 px-2 py-1 text-white/80"
            >
              <option value="URL_UPDATED">URL updated / new</option>
              <option value="URL_DELETED">URL removed</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} disabled={running} />
            Resubmit anyway (skip the 24-hour duplicate check)
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={running || !parsed.valid.length || !adminToken || (config && !config.configured)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {running ? `Submitting… ${summary.done}/${rows.length}` : "Submit for Google Indexing"}
        </button>

        <p className="mt-3 flex items-start gap-2 text-[11px] text-white/40">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            "Submitted to Google" means the Indexing API accepted your notification. It is <b>not</b> a guarantee that the URL is crawled or indexed.
            Google officially supports this API for job-posting and livestream pages; other pages may be ignored. Default quota: 200 submissions/day.
          </span>
        </p>
      </div>

      {batchError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-4 text-sm text-rose-200">{batchError}</div>
      )}

      {(rows.length > 0 || invalidRows.length > 0) && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Total", summary.total, "text-white/80"],
              ["Submitted", summary.submitted, "text-emerald-300"],
              ["Failed", summary.failed, "text-rose-300"],
              ["Invalid", summary.invalid, "text-rose-300"],
              ["Already sent", summary.already, "text-amber-300"],
            ].map(([label, value, cls]) => (
              <div key={label} className="rounded-xl bg-white/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
                <div className={`text-lg font-bold ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
          {running && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <ResultsTable
            rows={[
              ...rows,
              ...invalidRows.map((item) => ({ url: item.url, status: "failed", invalid: true, message: item.reason })),
            ]}
          />
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-white/85">
            <History className="h-4 w-4 text-violet-400" /> Submission history
          </span>
          <button type="button" onClick={loadHistory} className="flex items-center gap-1 text-xs text-violet-300 hover:underline">
            <RefreshCw className={`h-3 w-3 ${history.loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        {history.error && <p className="text-xs text-rose-300">{history.error}</p>}
        {!history.error && !history.items.length && !history.loading && <p className="text-xs text-white/35">No submissions yet.</p>}
        {history.items.length > 0 && (
          <ResultsTable
            rows={history.items.map((item) => ({
              url: item.url,
              status: item.status,
              message: item.message,
              submittedAt: item.submittedAt,
              type: item.type,
            }))}
          />
        )}
      </div>
    </div>
  );
}

function ResultsTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-white/35">
          <tr>
            <th className="py-2 pr-3">URL</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Google response / details</th>
            <th className="py-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.url}-${i}`} className="border-t border-white/[0.05] align-top">
              <td className="max-w-[260px] break-all py-2 pr-3 font-mono text-white/70">{row.url}</td>
              <td className="py-2 pr-3">
                {row.invalid ? (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Invalid</span>
                ) : (
                  <StatusBadge status={row.status} />
                )}
              </td>
              <td className={`py-2 pr-3 ${row.status === "failed" ? "text-rose-200/90" : "text-white/50"}`}>{row.message || "-"}</td>
              <td className="whitespace-nowrap py-2 text-white/40">{row.invalid ? "-" : formatTime(row.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
