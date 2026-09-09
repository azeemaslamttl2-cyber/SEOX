import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Gauge,
  HeartPulse,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import { NoProject, Notice, Spinner, card, useGbpLocation } from './gbpUi.jsx';
import { acknowledgeGbpAlert, getGbpQueueStats } from '../../lib/gbpApi.js';

const STATUS_META = {
  pending: { label: 'Pending', className: 'text-sky-300' },
  running: { label: 'Running', className: 'text-amber-300' },
  done: { label: 'Done', className: 'text-emerald-300' },
  failed: { label: 'Failed', className: 'text-rose-300' },
  dead: { label: 'Dead-lettered', className: 'text-rose-400' },
};

const SEVERITY_META = {
  action_required: {
    label: 'Action required',
    className: 'border-rose-500/30 bg-rose-500/[0.07]',
    text: 'text-rose-300',
    Icon: ShieldAlert,
  },
  error: {
    label: 'Error',
    className: 'border-amber-500/30 bg-amber-500/[0.07]',
    text: 'text-amber-300',
    Icon: AlertTriangle,
  },
};

export default function GbpOperations() {
  const { projectId, loadingLocations } = useGbpLocation();

  const [data, setData] = useState(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await getGbpQueueStats(projectId, showAcknowledged));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, showAcknowledged]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleAcknowledge = async (alertId) => {
    setBusy(`ack:${alertId}`);
    setError('');
    try {
      await acknowledgeGbpAlert({ projectId, alertId });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading worker status…" />;

  const stats = data?.stats || {};
  const alerts = data?.alerts || [];
  const usage = data?.apiUsage24h || [];
  const heartbeat = data?.heartbeat;
  const rateLimits = data?.rateLimits || [];
  const openAlerts = alerts.filter((alert) => !alert.acknowledgedAt);
  const totalCalls = usage.reduce((sum, row) => sum + row.calls, 0);
  const totalErrors = usage.reduce((sum, row) => sum + row.errors, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Operations</h1>
          <p className="mt-1 text-sm text-white/45">
            Background worker queue, failures, and the shared Google API quota.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? <Notice tone="error" title="Could not load worker status">{error}</Notice> : null}

      {/* Heartbeat — the scheduler is the single thing everything else depends
          on, so its state is the first thing on this page. */}
      <div
        className={`${card} ${
          heartbeat?.stale ? 'border-rose-500/30 bg-rose-500/[0.06]' : 'border-emerald-500/20'
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <HeartPulse
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              heartbeat?.stale ? 'text-rose-400' : 'text-emerald-400'
            }`}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              {heartbeat?.stale ? 'Scheduler is not running' : 'Scheduler is running'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              {heartbeat?.message ||
                `Last ran ${heartbeat?.minutesSince ?? 0} minute${
                  heartbeat?.minutesSince === 1 ? '' : 's'
                } ago. It should call in every 5 minutes.`}
            </p>
            {heartbeat?.everRan ? (
              <p className="mt-1 text-[11px] text-white/30">
                {heartbeat.runsTotal?.toLocaleString?.() ?? heartbeat.runsTotal} runs recorded
                {heartbeat.lastDurationMs ? ` · last took ${heartbeat.lastDurationMs}ms` : ''}
                {heartbeat.lastStatus && heartbeat.lastStatus !== 'ok'
                  ? ` · last status ${heartbeat.lastStatus}`
                  : ''}
              </p>
            ) : null}
            {heartbeat?.stale ? (
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                Check that <code className="text-white/65">worker/gbp-scheduler</code> is deployed and
                that its <code className="text-white/65">GBP_SCHEDULER_TOKEN</code> matches the one on
                the Pages project. Nothing syncs and no scheduled post publishes while it is down.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {openAlerts.length ? (
        <Notice tone="error" title={`${openAlerts.length} unresolved worker failure${openAlerts.length === 1 ? '' : 's'}`}>
          Scheduled work failed while nobody was watching. Each one below stopped after its retries
          were exhausted.
        </Notice>
      ) : (
        <Notice tone="success" title="No unresolved worker failures" />
      )}

      {/* Queue */}
      <div className={card}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4 text-teal-400" />
          Job queue
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                {meta.label}
              </p>
              <p className={`mt-1 font-display text-xl font-bold ${meta.className}`}>
                {stats[key] ?? 0}
              </p>
            </div>
          ))}
        </div>
        {(stats.dead ?? 0) > 0 ? (
          <p className="mt-3 text-xs text-rose-300">
            {stats.dead} job{stats.dead === 1 ? '' : 's'} exhausted their retries and will not run
            again on their own.
          </p>
        ) : null}
      </div>

      {/* Quota */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Gauge className="h-4 w-4 text-teal-400" />
            Google API calls, last 24 hours
          </h2>
          <span className="text-sm text-white/50">
            {totalCalls.toLocaleString()} calls
            {totalErrors ? ` · ${totalErrors} errors` : ''}
          </span>
        </div>

        {usage.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">No API calls recorded in the last 24 hours.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {usage
              .slice()
              .sort((a, b) => b.calls - a.calls)
              .map((row) => {
                const percent = totalCalls ? (row.calls / totalCalls) * 100 : 0;
                return (
                  <li key={row.api} className="flex items-center gap-3 text-sm">
                    <span className="w-44 shrink-0 truncate text-white/65">{row.api}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-teal-400/70"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-white/45">
                      {row.calls.toLocaleString()}
                    </span>
                    <span
                      className={`w-16 shrink-0 text-right text-xs ${
                        row.errors ? 'text-rose-300' : 'text-white/25'
                      }`}
                    >
                      {row.errors ? `${row.errors} err` : '—'}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}

        <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/30">
          The GBP quota is per Google Cloud project and shared by every client on this install. If
          this number climbs faster than expected, the sync cadences in
          <code className="mx-1 text-white/50">functions/_lib/gbp-jobs.js</code>
          are the place to slow it down.
        </p>
      </div>

      {/* Rate limits */}
      {rateLimits.length ? (
        <div className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Timer className="h-4 w-4 text-teal-400" />
            Your remaining actions
          </h2>
          <p className="mt-1 text-xs text-white/35">
            Per-user limits on the actions that spend the shared Google and WPScan quota.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {rateLimits.map((entry) => {
              const used = entry.limit - entry.remaining;
              const percent = entry.limit ? (used / entry.limit) * 100 : 0;
              return (
                <li key={entry.bucket} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-white/60">{entry.bucket}</span>
                    <span className={entry.remaining === 0 ? 'text-rose-300' : 'text-white/45'}>
                      {entry.remaining} / {entry.limit} left
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${
                        entry.remaining === 0 ? 'bg-rose-400/70' : 'bg-teal-400/70'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Alerts */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Failures
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
              {alerts.length}
            </span>
          </h2>
          <label className="flex items-center gap-2 text-xs text-white/45">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(event) => setShowAcknowledged(event.target.checked)}
              className="h-3.5 w-3.5 accent-brand-500"
            />
            Include acknowledged
          </label>
        </div>

        {alerts.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Nothing has failed.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {alerts.map((alert) => {
              const meta = SEVERITY_META[alert.severity] || SEVERITY_META.error;
              const Icon = meta.Icon;
              return (
                <li
                  key={alert.id}
                  className={`rounded-xl border p-3.5 ${meta.className} ${
                    alert.acknowledgedAt ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.text}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{alert.jobType}</span>
                        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                          {meta.label}
                        </span>
                        {alert.attempts ? (
                          <span className="text-[11px] text-white/35">
                            after {alert.attempts} attempt{alert.attempts === 1 ? '' : 's'}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-white/30">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-white/55">{alert.message}</p>
                      {alert.acknowledgedAt ? (
                        <p className="mt-1 text-[11px] text-white/30">
                          Acknowledged {new Date(alert.acknowledgedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    {!alert.acknowledgedAt ? (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={busy === `ack:${alert.id}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.14] disabled:opacity-40"
                      >
                        {busy === `ack:${alert.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <BellOff className="h-3.5 w-3.5" />
                        )}
                        Acknowledge
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
