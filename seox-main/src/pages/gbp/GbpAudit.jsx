import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Check, Loader2, Play, ShieldCheck } from 'lucide-react';
import {
  LocationPicker,
  NoLocation,
  NoProject,
  Notice,
  SEVERITY_META,
  Spinner,
  card,
  scoreColor,
  useGbpLocation,
} from './gbpUi.jsx';
import { getGbpAudit, getGbpAuditHistory, runGbpAudit } from '../../lib/gbpApi.js';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'opportunity'];

function ScoreRing({ score }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const stroke = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#fb7185';

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-2xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-white/30">/ 100</span>
      </div>
    </div>
  );
}

function HistoryBar({ history }) {
  if (history.length < 2) return null;
  const scores = [...history].reverse();
  const max = 100;

  return (
    <div className="flex h-16 items-end gap-1">
      {scores.map((entry) => (
        <div
          key={entry.id}
          title={`${entry.score} on ${new Date(entry.createdAt).toLocaleDateString()}`}
          className="flex-1 rounded-t bg-teal-500/40 transition hover:bg-teal-400/60"
          style={{ height: `${Math.max(4, (entry.score / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function GbpAudit() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [audit, historyData] = await Promise.all([
        getGbpAudit({ projectId, locationRowId }),
        getGbpAuditHistory({ projectId, locationRowId }).catch(() => ({ history: [] })),
      ]);
      setData(audit);
      setHistory(historyData.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, locationRowId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    setError('');
    setWarnings([]);
    try {
      const result = await runGbpAudit({ projectId, locationRowId });
      setWarnings(result.warnings || []);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading audit…" />;
  if (!locations.length) return <NoLocation />;

  const audit = data?.audit;
  const failing = (audit?.issues || []).filter((issue) => !issue.passed);
  const passing = (audit?.issues || []).filter((issue) => issue.passed);
  const visible = filter === 'all' ? failing : failing.filter((issue) => issue.severity === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">GBP Health Audit</h1>
          <p className="mt-1 text-sm text-white/45">
            {data?.businessName || 'Business Profile'} · every run is stored, never overwritten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run audit
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Audit failed">{error}</Notice> : null}
      {warnings.length ? (
        <Notice tone="warn" title="Some signals could not be read">
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {!audit ? (
        <div className={card}>
          <Notice tone="info" title="No audit yet">
            Run the first audit to score this listing across profile, media, reputation and engagement.
          </Notice>
        </div>
      ) : (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={audit.score} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold">GBP Health Score</h2>
                  {data.diff && data.diff.scoreDelta !== 0 ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-sm font-semibold ${
                        data.diff.scoreDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {data.diff.scoreDelta > 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {Math.abs(data.diff.scoreDelta)} since last run
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-white/35">
                  Last run {new Date(audit.createdAt).toLocaleString()}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {SEVERITY_ORDER.map((severity) => {
                    const count = audit.counts[severity] || 0;
                    const meta = SEVERITY_META[severity];
                    return (
                      <button
                        key={severity}
                        onClick={() => setFilter(filter === severity ? 'all' : severity)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${meta.className} ${
                          filter === severity ? 'ring-1 ring-white/25' : ''
                        }`}
                      >
                        <span className={meta.text}>{count}</span>{' '}
                        <span className="text-white/50">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {history.length > 1 ? (
                <div className="w-full max-w-[220px]">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    Score history
                  </p>
                  <HistoryBar history={history} />
                </div>
              ) : null}
            </div>

            {audit.signals?.byCategory ? (
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(audit.signals.byCategory).map(([category, value]) => (
                  <div key={category} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="text-[11px] text-white/40">{category}</p>
                    <p className="mt-0.5 font-display text-base font-bold">
                      {value.earned}
                      <span className="text-xs font-normal text-white/30"> / {value.possible}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {audit.skippedChecks?.length ? (
            <Notice tone="info" title={`${audit.skippedChecks.length} checks were not scored`}>
              <ul className="list-disc space-y-0.5 pl-5">
                {audit.skippedChecks.map((entry) => (
                  <li key={entry.key}>
                    <span className="text-white/70">{entry.key}</span> — {entry.reason}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-white/40">
                Skipped weights are removed from the total, so the score is not penalised for them.
              </p>
            </Notice>
          ) : null}

          <div className={card}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {filter === 'all' ? 'All issues' : `${SEVERITY_META[filter].label} issues`}
                <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
                  {visible.length}
                </span>
              </h2>
              {filter !== 'all' ? (
                <button
                  onClick={() => setFilter('all')}
                  className="text-xs font-semibold text-white/45 hover:text-white/70"
                >
                  Clear filter
                </button>
              ) : null}
            </div>

            {visible.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Nothing failing in this bucket.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {visible.map((issue) => {
                  const meta = SEVERITY_META[issue.severity];
                  const Icon = meta.Icon;
                  return (
                    <li key={issue.key} className={`rounded-xl border p-4 ${meta.className}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.text}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{issue.title}</span>
                            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-white/30">
                              {issue.category} · {issue.pointsEarned}/{issue.pointsPossible} pts
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-white/50">{issue.detail}</p>
                        </div>
                        {issue.actionLabel && issue.actionTarget ? (
                          <Link
                            to={issue.actionTarget}
                            className="shrink-0 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.14]"
                          >
                            {issue.actionLabel}
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {passing.length ? (
              <details className="mt-5 border-t border-white/[0.06] pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-white/50 hover:text-white/70">
                  {passing.length} checks passing
                </summary>
                <ul className="mt-3 space-y-1.5">
                  {passing.map((issue) => (
                    <li key={issue.key} className="flex items-center gap-2 text-sm text-white/50">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      {issue.title}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          {data.diff?.movements?.length ? (
            <div className={card}>
              <h2 className="font-semibold">Changes since the previous audit</h2>
              <ul className="mt-3 space-y-1.5">
                {data.diff.movements.map((movement) => (
                  <li key={movement.key} className="flex items-center gap-2 text-sm">
                    <span
                      className={`font-semibold ${movement.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {movement.delta > 0 ? '+' : ''}
                      {movement.delta}
                    </span>
                    <span className="text-white/60">{movement.key}</span>
                    <span className="text-white/30">
                      ({movement.from} → {movement.to})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
