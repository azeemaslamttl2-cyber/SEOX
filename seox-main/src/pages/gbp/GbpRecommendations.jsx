import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Info,
  Lightbulb,
  Loader2,
  Play,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  LocationPicker,
  NoLocation,
  NoProject,
  Notice,
  Spinner,
  card,
  useGbpLocation,
} from './gbpUi.jsx';
import {
  executeGbpRecommendation,
  ignoreGbpRecommendation,
  listGbpRecommendations,
  runGbpRecommendations,
  syncGbpSearchKeywords,
} from '../../lib/gbpApi.js';

const PRIORITY_META = {
  high: { label: 'High', className: 'border-rose-500/30 bg-rose-500/[0.07]', text: 'text-rose-300', Icon: AlertCircle },
  medium: { label: 'Medium', className: 'border-amber-500/30 bg-amber-500/[0.07]', text: 'text-amber-300', Icon: Info },
  low: { label: 'Low', className: 'border-white/[0.12] bg-white/[0.03]', text: 'text-white/60', Icon: Info },
  opportunity: { label: 'Opportunity', className: 'border-emerald-500/25 bg-emerald-500/[0.06]', text: 'text-emerald-300', Icon: Lightbulb },
};

const ACTION_META = {
  fix: { label: 'Fix', Icon: Wrench },
  generate: { label: 'Generate', Icon: Sparkles },
  schedule: { label: 'Schedule', Icon: CalendarClock },
  ignore: { label: 'Ignore', Icon: X },
};

const EVIDENCE_LABELS = {
  keyword: 'Keyword',
  gbpImpressionsPerMonth: 'GBP impressions / month',
  websitePosition: 'Website position (GSC)',
  websiteImpressions: 'Website impressions (GSC)',
  rankGridAverage: 'RankGrid average',
  competitorAverage: 'Competitor average',
  daysSinceLastPost: 'Days since last post',
  postsLast30Days: 'Posts in last 30 days',
  targetCadenceDays: 'Target cadence (days)',
  unanswered: 'Unanswered',
  urgentUnanswered: 'Unanswered at ≤2 stars',
  totalUnanswered: 'Total unanswered',
  total: 'Total',
  averageRating: 'Average rating',
  totalReviews: 'Total reviews',
  serviceCount: 'Services listed',
  photoCount: 'Photos',
  target: 'Target',
  pointsLost: 'Health score points lost',
  pointsPossible: 'Points available',
  auditScore: 'Audit score',
  metric: 'Metric',
  current: 'This period',
  previous: 'Previous period',
  changePercent: 'Change',
};

function EvidenceTable({ evidence }) {
  const entries = Object.entries(evidence || {});
  if (!entries.length) return null;

  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="text-white/40">{EVIDENCE_LABELS[key] || key}</dt>
          <dd className={value === null ? 'text-white/25 italic' : 'font-semibold text-white/75'}>
            {value === null
              ? 'not connected'
              : typeof value === 'number'
                ? value.toLocaleString()
                : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function GbpRecommendations() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await listGbpRecommendations({ projectId, locationRowId, status }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, locationRowId, status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (key, task) => {
    setBusy(key);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleRun = () =>
    run('run', async () => {
      setResult(null);
      const outcome = await runGbpRecommendations({ projectId, locationRowId });
      setResult({ kind: 'run', ...outcome });
      await load();
    });

  const handleSyncKeywords = () =>
    run('keywords', async () => {
      const outcome = await syncGbpSearchKeywords({ projectId, locationRowId });
      setResult({ kind: 'keywords', ...outcome });
      await load();
    });

  const handleAction = (recommendation, actionKey) =>
    run(`action:${recommendation.id}:${actionKey}`, async () => {
      if (actionKey === 'ignore') {
        await ignoreGbpRecommendation({ projectId, recommendationId: recommendation.id });
        await load();
        return;
      }

      const outcome = await executeGbpRecommendation({
        projectId,
        recommendationId: recommendation.id,
        actionKey,
      });

      if (outcome.kind === 'navigate') {
        navigate(outcome.reviewUrl);
        return;
      }
      setResult({ kind: 'draft', title: recommendation.title, ...outcome });
      await load();
    });

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading recommendations…" />;
  if (!locations.length) return <NoLocation />;

  const counts = data?.counts || {};
  const missing = data?.lastRun?.sourcesMissing || [];
  const used = data?.lastRun?.sourcesUsed || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Local SEO Opportunities</h1>
          <p className="mt-1 text-sm text-white/45">
            {data?.businessName}
            {data?.lastRun ? ` · last run ${new Date(data.lastRun.createdAt).toLocaleString()}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={handleSyncKeywords}
            disabled={busy === 'keywords'}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.05] disabled:opacity-50"
          >
            {busy === 'keywords' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Sync search keywords
          </button>
          <button
            onClick={handleRun}
            disabled={busy === 'run'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run engine
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Request failed">{error}</Notice> : null}

      {/* Safe AI Actions: what an action produced */}
      {result?.kind === 'draft' ? (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/[0.07] p-4">
          <p className="flex items-center gap-2 font-semibold text-teal-200">
            <CheckCircle2 className="h-4 w-4" />
            {result.drafted} draft{result.drafted === 1 ? '' : 's'} generated
          </p>
          <p className="mt-1 text-sm text-white/60">
            Nothing has been published. Review and approve them before they go live.
          </p>
          {result.failures?.length ? (
            <p className="mt-1 text-xs text-amber-300">
              {result.failures.length} could not be drafted: {result.failures[0].reason}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => navigate(result.reviewUrl)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/[0.1] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/[0.16]"
            >
              Review all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setResult(null)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/45 hover:text-white/70"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {result?.kind === 'keywords' ? (
        <Notice tone="success" title={`${result.keywords} search keywords synced for ${result.month}`}>
          {result.thresholdOnly ? (
            <>
              {result.thresholdOnly} of them are reported by Google as a threshold ("fewer than N")
              rather than an exact count, and are excluded from keyword recommendations.
            </>
          ) : (
            'All returned with exact impression counts.'
          )}
        </Notice>
      ) : null}

      {result?.kind === 'run' ? (
        <Notice tone="info" title="Engine run complete">
          {result.resolvedSinceLastRun ? `${result.resolvedSinceLastRun} previously open items are now resolved. ` : ''}
          {result.skippedBecauseDecided
            ? `${result.skippedBecauseDecided} were left alone because you already actioned or ignored them.`
            : ''}
        </Notice>
      ) : null}

      {data?.needsFirstRun ? (
        <div className={card}>
          <Notice tone="info" title="No run yet">
            Press <span className="text-white/80">Run engine</span> to build recommendations from the
            profile, reviews, posts, performance and Search Console data SEOX already holds.
          </Notice>
        </div>
      ) : null}

      {/* Sources */}
      {data?.lastRun ? (
        <div className={card}>
          <h2 className="text-sm font-semibold">What this run looked at</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {used.map((source) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
              >
                <CheckCircle2 className="h-3 w-3" />
                {source}
              </span>
            ))}
          </div>
          {missing.length ? (
            <>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Not considered
              </p>
              <ul className="mt-2 space-y-1">
                {missing.map((entry) => (
                  <li key={entry.source} className="text-xs text-white/40">
                    <span className="text-white/60">{entry.source}</span> — {entry.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Counts + status filter */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(PRIORITY_META).map(([key, meta]) => (
          <span
            key={key}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${meta.className}`}
          >
            <span className={meta.text}>{counts[key] || 0}</span>{' '}
            <span className="text-white/50">{meta.label}</span>
          </span>
        ))}
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="ml-auto rounded-lg border border-white/10 bg-ink-900 px-3 py-1.5 text-xs text-white/80"
        >
          <option value="open">Open</option>
          <option value="actioned">Actioned</option>
          <option value="ignored">Ignored</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        {(data?.recommendations || []).length === 0 && !data?.needsFirstRun ? (
          <div className={card}>
            <p className="text-sm text-white/40">Nothing in this bucket.</p>
          </div>
        ) : null}

        {(data?.recommendations || []).map((recommendation) => {
          const meta = PRIORITY_META[recommendation.priority] || PRIORITY_META.low;
          const Icon = meta.Icon;

          return (
            <div key={recommendation.id} className={`rounded-2xl border p-5 ${meta.className}`}>
              <div className="flex flex-wrap items-start gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.text}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/55">
                      {meta.label}
                    </span>
                    {recommendation.status !== 'open' ? (
                      <span className="text-[11px] text-white/35">{recommendation.status}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold">{recommendation.title}</h3>
                  {recommendation.detail ? (
                    <p className="mt-1 text-xs leading-relaxed text-white/50">{recommendation.detail}</p>
                  ) : null}

                  <EvidenceTable evidence={recommendation.evidence} />

                  {recommendation.recommended ? (
                    <p className="mt-3 border-t border-white/[0.08] pt-3 text-sm text-white/70">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                        Recommended
                      </span>
                      <br />
                      {recommendation.recommended}
                    </p>
                  ) : null}

                  {recommendation.actionResult?.drafted ? (
                    <p className="mt-2 text-xs text-teal-300">
                      {recommendation.actionResult.drafted} draft
                      {recommendation.actionResult.drafted === 1 ? '' : 's'} created
                      {recommendation.actionedAt
                        ? ` on ${new Date(recommendation.actionedAt).toLocaleDateString()}`
                        : ''}
                      {recommendation.actionedBy ? ` by ${recommendation.actionedBy}` : ''}.
                    </p>
                  ) : null}
                </div>
              </div>

              {recommendation.status === 'open' ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.08] pt-3">
                  {recommendation.actions.map((actionKey) => {
                    const actionMeta = ACTION_META[actionKey];
                    if (!actionMeta) return null;
                    const ActionIcon = actionMeta.Icon;
                    const key = `action:${recommendation.id}:${actionKey}`;

                    return (
                      <button
                        key={actionKey}
                        onClick={() => handleAction(recommendation, actionKey)}
                        disabled={busy === key}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                          actionKey === 'ignore'
                            ? 'text-white/45 hover:bg-white/[0.06] hover:text-white/70'
                            : 'bg-white/[0.1] text-white/85 hover:bg-white/[0.16]'
                        }`}
                      >
                        {busy === key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ActionIcon className="h-3.5 w-3.5" />
                        )}
                        {actionMeta.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-white/30">
        Every figure above is read from stored data, not produced by the model. Generate and Schedule
        create drafts only — nothing on this page publishes to Google.
      </p>
    </div>
  );
}
