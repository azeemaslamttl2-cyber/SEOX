import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  CalendarClock,
  Copy,
  Loader2,
  Repeat,
  Send,
  Sparkles,
  Trash2,
  Unlock,
  XCircle,
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
  cancelGbpPostSeries,
  clearGbpPostingBlock,
  deleteGbpPost,
  deleteGbpTemplate,
  generateGbpPost,
  listGbpPostSchedules,
  listGbpPosts,
  listGbpTemplates,
  publishGbpPost,
  saveGbpPost,
  saveGbpTemplate,
  scheduleGbpPost,
  scheduleRecurringGbpPost,
} from '../../lib/gbpApi.js';

const TOPIC_TYPES = [
  { value: 'STANDARD', label: 'Update' },
  { value: 'EVENT', label: 'Event' },
  { value: 'OFFER', label: 'Offer' },
];

const CTA_TYPES = ['LEARN_MORE', 'BOOK', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL'];

const CADENCES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const STATUS_STYLES = {
  draft: 'bg-white/[0.06] text-white/60',
  pending_approval: 'bg-amber-500/15 text-amber-300',
  scheduled: 'bg-sky-500/15 text-sky-300',
  published: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-rose-500/15 text-rose-300',
};

const EMPTY = {
  postId: null,
  topicType: 'STANDARD',
  summary: '',
  ctaType: 'LEARN_MORE',
  ctaUrl: '',
  mediaUrl: '',
  eventTitle: '',
  eventStart: '',
  eventEnd: '',
  offerCoupon: '',
  offerTerms: '',
  offerRedeemUrl: '',
  scheduledAt: '',
  utmSource: 'google',
  utmMedium: 'gbp',
  utmCampaign: '',
};

export default function GbpPosts() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [posts, setPosts] = useState([]);
  const [blocked, setBlocked] = useState(null);
  const [successfulPosts, setSuccessfulPosts] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [notice, setNotice] = useState('');
  const [recurring, setRecurring] = useState({ enabled: false, cadence: 'weekly', occurrences: 4 });
  const [aiTopic, setAiTopic] = useState('');
  const [aiKeyword, setAiKeyword] = useState('');
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [templateName, setTemplateName] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [data, templateData, scheduleData] = await Promise.all([
        listGbpPosts({ projectId, locationRowId }),
        listGbpTemplates(projectId).catch(() => ({ templates: [] })),
        listGbpPostSchedules({ projectId, locationRowId }).catch(() => ({ schedules: [] })),
      ]);
      setPosts(data.posts || []);
      setBlocked(data.blocked || null);
      setSuccessfulPosts(data.successfulPosts || 0);
      setTemplates(templateData.templates || []);
      setSchedules(scheduleData.schedules || []);
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

  const patch = (changes) => setForm((current) => ({ ...current, ...changes }));

  const payload = () => ({
    projectId,
    locationRowId,
    postId: form.postId,
    topicType: form.topicType,
    summary: form.summary,
    ctaType: form.ctaType || null,
    ctaUrl: form.ctaUrl || null,
    mediaUrl: form.mediaUrl || null,
    eventTitle: form.eventTitle || null,
    eventStart: form.eventStart || null,
    eventEnd: form.eventEnd || null,
    offerCoupon: form.offerCoupon || null,
    offerTerms: form.offerTerms || null,
    offerRedeemUrl: form.offerRedeemUrl || null,
    scheduledAt: form.scheduledAt || null,
    utm: {
      source: form.utmSource || null,
      medium: form.utmMedium || null,
      campaign: form.utmCampaign || null,
    },
  });

  const run = async (key, task) => {
    setBusy(key);
    setError('');
    setValidationErrors([]);
    setWarnings([]);
    setNotice('');
    try {
      await task();
    } catch (err) {
      if (err.payload?.validationErrors) setValidationErrors(err.payload.validationErrors);
      else setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleGenerate = () =>
    run('generate', async () => {
      const result = await generateGbpPost({
        projectId,
        locationRowId,
        topicType: form.topicType,
        topic: aiTopic || null,
        keyword: aiKeyword || null,
      });
      patch({
        summary: result.draft.summary,
        ctaType: result.draft.ctaType || form.ctaType,
        eventTitle: result.draft.eventTitle || form.eventTitle,
      });
      setWarnings(result.validation?.warnings || []);
      setNotice('Draft generated. Review it before publishing.');
    });

  const handleSave = () =>
    run('save', async () => {
      const result = await saveGbpPost(payload());
      setWarnings(result.warnings || []);
      setNotice('Saved as a draft.');
      setForm(EMPTY);
      await load();
    });

  const handleSchedule = () =>
    run('schedule', async () => {
      if (recurring.enabled) {
        const result = await scheduleRecurringGbpPost({
          ...payload(),
          cadence: recurring.cadence,
          occurrences: recurring.occurrences,
        });
        setNotice(`${result.count} posts scheduled.`);
      } else {
        const result = await scheduleGbpPost(payload());
        setWarnings(result.warnings || []);
        setNotice('Scheduled. The scheduler worker publishes it at that time.');
      }
      setForm(EMPTY);
      await load();
    });

  const handlePublish = () =>
    run('publish', async () => {
      const result = await publishGbpPost(payload());
      setWarnings(result.warnings || []);
      setNotice('Published to Google.');
      setForm(EMPTY);
      await load();
    });

  const handleSaveTemplate = () =>
    run('template:save', async () => {
      if (!templateName.trim()) {
        setError('Give the template a name first.');
        return;
      }
      await saveGbpTemplate({
        projectId,
        name: templateName.trim(),
        topicType: form.topicType,
        summary: form.summary,
        ctaType: form.ctaType || null,
        ctaUrl: form.ctaUrl || null,
        mediaUrl: form.mediaUrl || null,
        utmSource: form.utmSource,
        utmMedium: form.utmMedium,
        utmCampaign: form.utmCampaign,
      });
      setTemplateName('');
      setNotice('Template saved.');
      await load();
    });

  const applyTemplate = (template) =>
    setForm((current) => ({
      ...current,
      topicType: template.topic_type || 'STANDARD',
      summary: template.summary || '',
      ctaType: template.cta_type || '',
      ctaUrl: template.cta_url || '',
      mediaUrl: template.media_url || '',
      utmSource: template.utm_source || current.utmSource,
      utmMedium: template.utm_medium || current.utmMedium,
      utmCampaign: template.utm_campaign || current.utmCampaign,
    }));

  const handleCancelSeries = (scheduleId) =>
    run(`series:${scheduleId}`, async () => {
      const result = await cancelGbpPostSeries({ projectId, locationRowId, scheduleId });
      setNotice(
        `Series cancelled. ${result.removedUpcoming} unpublished post${
          result.removedUpcoming === 1 ? '' : 's'
        } removed; anything already live on Google stays there.`
      );
      await load();
    });

  const handleDelete = (postId) =>
    run(`delete:${postId}`, async () => {
      await deleteGbpPost({ projectId, locationRowId, postId });
      await load();
    });

  const handleClearBlock = () =>
    run('unblock', async () => {
      await clearGbpPostingBlock({ projectId, locationRowId });
      setNotice('Posting block cleared.');
      await load();
    });

  const loadIntoForm = (post) =>
    setForm({
      ...EMPTY,
      postId: post.id,
      topicType: post.topicType,
      summary: post.summary,
      ctaType: post.ctaType || '',
      ctaUrl: post.ctaUrl || '',
      mediaUrl: post.mediaUrl || '',
      eventTitle: post.eventTitle || '',
      offerCoupon: post.offerCoupon || '',
      offerTerms: post.offerTerms || '',
    });

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading posts…" />;
  if (!locations.length) return <NoLocation />;

  const isEvent = form.topicType === 'EVENT' || form.topicType === 'OFFER';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Posts Manager</h1>
          <p className="mt-1 text-sm text-white/45">
            {successfulPosts} successful post{successfulPosts === 1 ? '' : 's'} from this location.
          </p>
        </div>
        <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
      </div>

      {blocked ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-4">
          <p className="flex items-center gap-2 font-semibold text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            Posting is paused for this location
          </p>
          <p className="mt-1 text-sm text-white/60">
            {blocked.failures} consecutive rejections. Paused until{' '}
            {new Date(`${blocked.until}Z`).toLocaleString()}. Reason: {blocked.reason}
          </p>
          <button
            onClick={handleClearBlock}
            disabled={busy === 'unblock'}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.14] disabled:opacity-50"
          >
            {busy === 'unblock' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
            I fixed the cause — resume posting
          </button>
        </div>
      ) : null}

      {error ? <Notice tone="error" title="Request failed">{error}</Notice> : null}
      {validationErrors.length ? (
        <Notice tone="warn" title="Not sent to Google — fix these first">
          <ul className="list-disc space-y-0.5 pl-5">
            {validationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {warnings.length ? (
        <Notice tone="info" title="Worth a second look">
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {notice ? <Notice tone="success" title={notice} /> : null}

      {/* Composer */}
      <div className={card}>
        <h2 className="font-semibold">{form.postId ? 'Edit post' : 'New post'}</h2>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {TOPIC_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => patch({ topicType: type.value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  form.topicType === type.value
                    ? 'bg-teal-500/15 text-teal-200'
                    : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
              Templates
            </p>
            {templates.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {templates.map((template) => (
                  <span
                    key={template.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] py-1 pl-2.5 pr-1 text-xs"
                  >
                    <button
                      onClick={() => applyTemplate(template)}
                      className="text-white/75 hover:text-white"
                    >
                      {template.name}
                    </button>
                    <button
                      onClick={() =>
                        run(`template:del:${template.id}`, async () => {
                          await deleteGbpTemplate({ projectId, templateId: template.id });
                          await load();
                        })
                      }
                      className="rounded-full p-0.5 text-white/30 hover:text-rose-300"
                      title="Delete template"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/30">
                No templates yet. Save the current composer as one below.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-[220px]`}
                placeholder="Template name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <button
                onClick={handleSaveTemplate}
                disabled={busy === 'template:save' || !form.summary}
                className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-40"
              >
                {busy === 'template:save' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                Save as template
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
              AI draft
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${inputClass} max-w-[220px]`}
                placeholder="Topic (optional)"
                value={aiTopic}
                onChange={(event) => setAiTopic(event.target.value)}
              />
              <input
                className={`${inputClass} max-w-[220px]`}
                placeholder="Target keyword (optional)"
                value={aiKeyword}
                onChange={(event) => setAiKeyword(event.target.value)}
              />
              <button
                onClick={handleGenerate}
                disabled={busy === 'generate'}
                className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                {busy === 'generate' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate
              </button>
            </div>
          </div>

          <Field
            label="Post text"
            hint={`${form.summary.length} / 1500. No phone numbers — Google rejects them in post copy.`}
          >
            <textarea
              rows={5}
              className={inputClass}
              value={form.summary}
              onChange={(event) => patch({ summary: event.target.value })}
            />
          </Field>

          {isEvent ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Title">
                <input
                  className={inputClass}
                  value={form.eventTitle}
                  onChange={(event) => patch({ eventTitle: event.target.value })}
                />
              </Field>
              <Field label="Starts">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.eventStart}
                  onChange={(event) => patch({ eventStart: event.target.value })}
                />
              </Field>
              <Field label="Ends">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.eventEnd}
                  onChange={(event) => patch({ eventEnd: event.target.value })}
                />
              </Field>
            </div>
          ) : null}

          {form.topicType === 'OFFER' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Coupon code">
                <input
                  className={inputClass}
                  value={form.offerCoupon}
                  onChange={(event) => patch({ offerCoupon: event.target.value })}
                />
              </Field>
              <Field label="Redeem URL">
                <input
                  className={inputClass}
                  value={form.offerRedeemUrl}
                  onChange={(event) => patch({ offerRedeemUrl: event.target.value })}
                />
              </Field>
              <Field label="Terms">
                <input
                  className={inputClass}
                  value={form.offerTerms}
                  onChange={(event) => patch({ offerTerms: event.target.value })}
                />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Call to action">
              <select
                className={inputClass}
                value={form.ctaType}
                onChange={(event) => patch({ ctaType: event.target.value })}
              >
                <option value="">None</option>
                {CTA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Landing URL" hint={form.ctaType === 'CALL' ? 'Not used for Call.' : null}>
              <input
                className={inputClass}
                placeholder="https://"
                value={form.ctaUrl}
                onChange={(event) => patch({ ctaUrl: event.target.value })}
              />
            </Field>
            <Field label="Image URL" hint="Must be a public URL Google can fetch.">
              <input
                className={inputClass}
                placeholder="https://"
                value={form.mediaUrl}
                onChange={(event) => patch({ mediaUrl: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="UTM source">
              <input
                className={inputClass}
                value={form.utmSource}
                onChange={(event) => patch({ utmSource: event.target.value })}
              />
            </Field>
            <Field label="UTM medium">
              <input
                className={inputClass}
                value={form.utmMedium}
                onChange={(event) => patch({ utmMedium: event.target.value })}
              />
            </Field>
            <Field label="UTM campaign">
              <input
                className={inputClass}
                value={form.utmCampaign}
                onChange={(event) => patch({ utmCampaign: event.target.value })}
              />
            </Field>
            <Field label="Schedule for">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.scheduledAt}
                onChange={(event) => patch({ scheduledAt: event.target.value })}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recurring.enabled}
                onChange={(event) => setRecurring({ ...recurring, enabled: event.target.checked })}
                className="h-4 w-4 accent-brand-500"
              />
              <Repeat className="h-4 w-4 text-teal-400" />
              Repeat this post
            </label>
            {recurring.enabled ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Cadence">
                  <select
                    className={inputClass}
                    value={recurring.cadence}
                    onChange={(event) => setRecurring({ ...recurring, cadence: event.target.value })}
                  >
                    {CADENCES.map((cadence) => (
                      <option key={cadence.value} value={cadence.value}>
                        {cadence.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Occurrences" hint="Expanded into individual scheduled posts.">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    className={inputClass}
                    value={recurring.occurrences}
                    onChange={(event) =>
                      setRecurring({ ...recurring, occurrences: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={busy === 'save' || !form.summary}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.05] disabled:opacity-40"
            >
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </button>
            <button
              onClick={handleSchedule}
              disabled={busy === 'schedule' || !form.summary || !form.scheduledAt}
              className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.14] disabled:opacity-40"
            >
              {busy === 'schedule' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Schedule
            </button>
            <button
              onClick={handlePublish}
              disabled={busy === 'publish' || !form.summary || Boolean(blocked)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish now
            </button>
            {form.postId ? (
              <button
                onClick={() => setForm(EMPTY)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white/45 hover:text-white/70"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Recurring series */}
      {schedules.filter((schedule) => schedule.status === 'active').length ? (
        <div className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Repeat className="h-4 w-4 text-teal-400" />
            Recurring series
          </h2>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {schedules
              .filter((schedule) => schedule.status === 'active')
              .map((schedule) => (
                <li key={schedule.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{schedule.name || 'Post series'}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {schedule.cadence} · {schedule.occurrences} occurrence
                      {schedule.occurrences === 1 ? '' : 's'} · from{' '}
                      {new Date(schedule.starts_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelSeries(schedule.id)}
                    disabled={busy === `series:${schedule.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                  >
                    {busy === `series:${schedule.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    Cancel series
                  </button>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-[11px] text-white/30">
            Cancelling removes the scheduled occurrences that have not published yet. Posts already
            live on Google are left alone.
          </p>
        </div>
      ) : null}

      {/* Post list */}
      <div className={card}>
        <h2 className="font-semibold">
          Posts
          <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
            {posts.length}
          </span>
        </h2>

        {posts.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No posts yet for this location.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {posts.map((post) => (
              <li key={post.id} className="py-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          STATUS_STYLES[post.status] || STATUS_STYLES.draft
                        }`}
                      >
                        {post.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-white/35">{post.topicType}</span>
                      {post.origin !== 'manual' ? (
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                          {post.origin}
                        </span>
                      ) : null}
                      {post.scheduledAt ? (
                        <span className="text-[11px] text-white/35">
                          {new Date(post.scheduledAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-white/70">{post.summary}</p>
                    {post.lastError ? (
                      <p className="mt-1 text-xs text-rose-300">{post.lastError}</p>
                    ) : null}
                    {post.sourceUrl ? (
                      <p className="mt-1 truncate text-[11px] text-white/30">from {post.sourceUrl}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => loadIntoForm(post)}
                      title="Load into composer"
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={busy === `delete:${post.id}`}
                      title="Delete"
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                    >
                      {busy === `delete:${post.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
