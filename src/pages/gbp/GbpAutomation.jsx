import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ListChecks,
  Loader2,
  Play,
  Plus,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  Field,
  LocationPicker,
  NoLocation,
  NoProject,
  Notice,
  Spinner,
  card,
  inputClass,
  useGbpLocation,
} from './gbpUi.jsx';
import {
  deleteGbpRule,
  listGbpRules,
  listGbpSources,
  runGbpRule,
  saveGbpRule,
  skipGbpSource,
} from '../../lib/gbpApi.js';

const RULE_TYPES = [
  {
    value: 'website_to_post',
    label: 'Website → GBP posts',
    blurb: 'New pages on the site become drafted GBP posts.',
  },
  {
    value: 'service_gap',
    label: 'Service gap check',
    blurb: 'Service pages on the site that are missing from the GBP service list.',
  },
];

const MODES = [
  { value: 'manual', label: 'Manual', blurb: 'Discover pages only. Nothing is drafted.' },
  { value: 'approval', label: 'Approval', blurb: 'Drafts wait for a human. Recommended.' },
  { value: 'auto', label: 'Full auto', blurb: 'Drafts are scheduled without review.' },
];

function newRuleDraft(locationRowId) {
  return {
    id: null,
    ruleType: 'website_to_post',
    name: 'Blog to GBP posts',
    mode: 'approval',
    enabled: true,
    locationRowId,
    config: {
      sitemapUrl: '',
      include: ['/blog/'],
      exclude: ['/tag/', '/category/', '/author/'],
      ctaType: 'LEARN_MORE',
      maxPerRun: 3,
      scheduleOffsetHours: 2,
      utm: { source: 'google', medium: 'gbp', campaign: 'gbp_post' },
      useSourceImage: true,
    },
  };
}

export default function GbpAutomation() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [rules, setRules] = useState([]);
  const [sources, setSources] = useState([]);
  const [draft, setDraft] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [ruleData, sourceData] = await Promise.all([
        listGbpRules(projectId),
        listGbpSources({ projectId }).catch(() => ({ sources: [] })),
      ]);
      setRules(ruleData.rules || []);
      setSources(sourceData.sources || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (key, task) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleSaveRule = () =>
    run('save', async () => {
      await saveGbpRule({ projectId, ...draft });
      setDraft(null);
      setNotice('Rule saved.');
      await load();
    });

  const handleRunRule = (rule) =>
    run(`run:${rule.id}`, async () => {
      const data = await runGbpRule({ projectId, ruleId: rule.id });
      setResult({ ruleType: rule.ruleType, ...data.result });
      await load();
    });

  const handleDeleteRule = (ruleId) =>
    run(`delete:${ruleId}`, async () => {
      await deleteGbpRule({ projectId, ruleId });
      await load();
    });

  const handleSkip = (sourceId) =>
    run(`skip:${sourceId}`, async () => {
      await skipGbpSource({ projectId, sourceId, reason: 'Skipped by user.' });
      await load();
    });

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading automation rules…" />;
  if (!locations.length) return <NoLocation />;

  const patchConfig = (changes) =>
    setDraft((current) => ({ ...current, config: { ...current.config, ...changes } }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Website → GBP Automation</h1>
          <p className="mt-1 text-sm text-white/45">
            Turn new website pages into Business Profile posts, and spot services the listing is missing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={() => setDraft(newRuleDraft(locationRowId))}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New rule
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Request failed">{error}</Notice> : null}
      {notice ? <Notice tone="success" title={notice} /> : null}

      <Notice tone="info" title="Scheduled publishing needs the scheduler worker">
        A rule in <span className="text-white/80">approval</span> mode drafts posts and stops. In{' '}
        <span className="text-white/80">full auto</span> it schedules them — but nothing publishes on a
        timer until <code className="text-white/70">worker/gbp-scheduler</code> is deployed, or something
        else calls <code className="text-white/70">POST /api/gbp/jobs</code> on a schedule.
      </Notice>

      {/* Rule editor */}
      {draft ? (
        <div className={card}>
          <h2 className="font-semibold">{draft.id ? 'Edit rule' : 'New rule'}</h2>

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rule type">
                <select
                  className={inputClass}
                  value={draft.ruleType}
                  disabled={Boolean(draft.id)}
                  onChange={(event) => {
                    const ruleType = event.target.value;
                    setDraft({
                      ...draft,
                      ruleType,
                      name: RULE_TYPES.find((type) => type.value === ruleType).label,
                      config:
                        ruleType === 'service_gap'
                          ? { sitemapUrl: draft.config.sitemapUrl, include: ['/services/'], exclude: [] }
                          : newRuleDraft(locationRowId).config,
                    });
                  }}
                >
                  {RULE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name">
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
            </div>

            {draft.ruleType === 'website_to_post' ? (
              <Field label="Mode">
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setDraft({ ...draft, mode: mode.value })}
                      className={`rounded-xl border p-3 text-left transition ${
                        draft.mode === mode.value
                          ? 'border-teal-500/40 bg-teal-500/[0.08]'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <p className="text-sm font-semibold">{mode.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{mode.blurb}</p>
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sitemap URL" hint="Leave empty to use the project's own /sitemap.xml">
                <input
                  className={inputClass}
                  placeholder="https://example.com/sitemap.xml"
                  value={draft.config.sitemapUrl || ''}
                  onChange={(event) => patchConfig({ sitemapUrl: event.target.value })}
                />
              </Field>
              <Field label="Location">
                <select
                  className={inputClass}
                  value={draft.locationRowId || ''}
                  onChange={(event) => setDraft({ ...draft, locationRowId: event.target.value })}
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.businessName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Only URLs containing" hint="One per line. Plain text, not regex.">
                <textarea
                  rows={3}
                  className={inputClass}
                  value={(draft.config.include || []).join('\n')}
                  onChange={(event) =>
                    patchConfig({ include: event.target.value.split('\n').filter(Boolean) })
                  }
                />
              </Field>
              <Field label="Skip URLs containing">
                <textarea
                  rows={3}
                  className={inputClass}
                  value={(draft.config.exclude || []).join('\n')}
                  onChange={(event) =>
                    patchConfig({ exclude: event.target.value.split('\n').filter(Boolean) })
                  }
                />
              </Field>
            </div>

            {draft.ruleType === 'website_to_post' ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Max per run">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className={inputClass}
                    value={draft.config.maxPerRun}
                    onChange={(event) => patchConfig({ maxPerRun: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Schedule offset (hours)" hint="Auto mode only.">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={draft.config.scheduleOffsetHours}
                    onChange={(event) =>
                      patchConfig({ scheduleOffsetHours: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="UTM campaign">
                  <input
                    className={inputClass}
                    value={draft.config.utm?.campaign || ''}
                    onChange={(event) =>
                      patchConfig({ utm: { ...draft.config.utm, campaign: event.target.value } })
                    }
                  />
                </Field>
                <Field label="Use page image">
                  <select
                    className={inputClass}
                    value={draft.config.useSourceImage ? 'yes' : 'no'}
                    onChange={(event) => patchConfig({ useSourceImage: event.target.value === 'yes' })}
                  >
                    <option value="yes">Yes — use og:image</option>
                    <option value="no">No image</option>
                  </select>
                </Field>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                onClick={handleSaveRule}
                disabled={busy === 'save'}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save rule
              </button>
              <button
                onClick={() => setDraft(null)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white/45 hover:text-white/70"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Rules */}
      <div className={card}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Workflow className="h-4 w-4 text-teal-400" />
          Rules
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
            {rules.length}
          </span>
        </h2>

        {rules.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">
            No rules yet. Create one to start turning website pages into GBP posts.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{rule.name}</span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                      {rule.ruleType.replace(/_/g, ' ')}
                    </span>
                    {rule.ruleType === 'website_to_post' ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          rule.mode === 'auto'
                            ? 'bg-rose-500/15 text-rose-300'
                            : rule.mode === 'approval'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-white/[0.06] text-white/50'
                        }`}
                      >
                        {rule.mode}
                      </span>
                    ) : null}
                    {!rule.enabled ? (
                      <span className="text-[11px] text-white/30">disabled</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/35">
                    {rule.lastRunAt
                      ? `Last run ${new Date(rule.lastRunAt).toLocaleString()} · ${rule.lastRunStatus}${
                          rule.lastRunMessage ? ` · ${rule.lastRunMessage}` : ''
                        }`
                      : 'Never run'}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => handleRunRule(rule)}
                    disabled={busy === `run:${rule.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
                  >
                    {busy === `run:${rule.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Run now
                  </button>
                  <button
                    onClick={() => setDraft({ ...rule })}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    disabled={busy === `delete:${rule.id}`}
                    className="rounded-lg p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Last run result */}
      {result ? (
        <div className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Zap className="h-4 w-4 text-amber-400" />
            Last run
          </h2>

          {result.ruleType === 'service_gap' ? (
            <>
              <p className="mt-2 text-sm text-white/55">{result.recommendation}</p>
              {result.gaps?.length ? (
                <ul className="mt-3 space-y-1.5">
                  {result.gaps.map((gap) => (
                    <li
                      key={gap.url}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-white/80">{gap.suggestedService}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-white/25" />
                      <span className="truncate text-xs text-white/35">{gap.url}</span>
                      <Link
                        to="/local-seo/gbp/profile"
                        className="ml-auto shrink-0 rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/75 hover:bg-white/[0.14]"
                      >
                        Add as service
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-white/40">Discovered</p>
                  <p className="mt-0.5 font-display text-lg font-bold">{result.discovered}</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-white/40">Queued</p>
                  <p className="mt-0.5 font-display text-lg font-bold">{result.queued}</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-white/40">Drafted</p>
                  <p className="mt-0.5 font-display text-lg font-bold text-teal-300">{result.drafted}</p>
                </div>
              </div>
              {result.note ? <p className="mt-3 text-sm text-white/45">{result.note}</p> : null}
              {result.posts?.length ? (
                <ul className="mt-3 space-y-1.5">
                  {result.posts.map((post) => (
                    <li key={post.postId} className="flex items-center gap-2 text-sm">
                      <span className="truncate text-white/70">{post.title || post.url}</span>
                      <Link
                        to="/local-seo/gbp/posts"
                        className="ml-auto shrink-0 text-[11px] font-semibold text-teal-300 hover:underline"
                      >
                        Open in Posts
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.failures?.length ? (
                <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
                  <p className="text-xs font-semibold text-amber-200">
                    {result.failures.length} page{result.failures.length === 1 ? '' : 's'} skipped
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-white/45">
                    {result.failures.map((failure) => (
                      <li key={failure.url} className="truncate">
                        {failure.url} — {failure.errors.join(' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Discovered pages */}
      {sources.length ? (
        <div className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            <ListChecks className="h-4 w-4 text-teal-400" />
            Discovered pages
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
              {sources.length}
            </span>
          </h2>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {sources.slice(0, 30).map((source) => (
              <li key={source.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    source.status === 'drafted'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : source.status === 'skipped'
                        ? 'bg-white/[0.06] text-white/45'
                        : source.status === 'error'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-sky-500/15 text-sky-300'
                  }`}
                >
                  {source.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-white/60">{source.title || source.url}</span>
                {source.skipReason ? (
                  <span className="truncate text-[11px] text-white/30">{source.skipReason}</span>
                ) : null}
                {source.status === 'new' ? (
                  <button
                    onClick={() => handleSkip(source.id)}
                    disabled={busy === `skip:${source.id}`}
                    className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/50 hover:bg-white/[0.05]"
                  >
                    Skip
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
