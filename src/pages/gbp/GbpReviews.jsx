import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Flag,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
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
  authorizeGbpReplies,
  deleteGbpReply,
  draftGbpRepliesBulk,
  draftGbpReply,
  flagGbpReview,
  listGbpReviews,
  publishGbpReply,
  setGbpAutoReply,
  syncGbpReviews,
} from '../../lib/gbpApi.js';

const FILTER_LABELS = {
  all: 'All',
  unanswered: 'Unanswered',
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  flagged: 'Flagged',
  reply_pending: 'Reply pending',
  reply_published: 'Reply published',
};

function Stars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-3.5 w-3.5 ${
            value <= rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'
          }`}
        />
      ))}
    </span>
  );
}

function TierBadge({ tier }) {
  const styles = {
    none: 'bg-white/[0.06] text-white/50',
    attention: 'bg-sky-500/15 text-sky-300',
    urgent: 'bg-rose-500/15 text-rose-300',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[tier.urgency]}`}>
      {tier.label}
    </span>
  );
}

export default function GbpReviews() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [authForm, setAuthForm] = useState({ authorizedBy: '', note: '' });

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const result = await listGbpReviews({ projectId, locationRowId, filter, limit: 100 });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, locationRowId, filter]);

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
      setError(err.payload?.validationErrors?.join(' ') || err.message);
    } finally {
      setBusy('');
    }
  };

  const handleSync = () =>
    run('sync', async () => {
      const result = await syncGbpReviews({ projectId, locationRowId });
      setNotice(
        `${result.synced} reviews synced.${result.truncated ? ' Older reviews remain — run again to continue.' : ''}`
      );
      await load();
    });

  const handleAuthorize = (authorized) =>
    run('auth', async () => {
      await authorizeGbpReplies({
        projectId,
        locationRowId,
        authorized,
        authorizedBy: authForm.authorizedBy,
        note: authForm.note,
      });
      setShowAuth(false);
      setNotice(authorized ? 'Authorisation recorded.' : 'Authorisation withdrawn — auto-reply switched off.');
      await load();
    });

  const handleAutoReply = (enabled) =>
    run('auto', async () => {
      await setGbpAutoReply({ projectId, locationRowId, enabled, minStars: 5 });
      await load();
    });

  const handleDraft = (reviewRowId) =>
    run(`draft:${reviewRowId}`, async () => {
      const result = await draftGbpReply({ projectId, locationRowId, reviewRowId });
      const entry = result.drafted?.[0];
      if (entry) {
        setDrafts((current) => ({ ...current, [reviewRowId]: entry.review.draftReply }));
      } else if (result.skipped?.length) {
        setError(result.skipped[0].reason);
      }
      await load();
    });

  const handleDraftAll = () =>
    run('draft-all', async () => {
      const result = await draftGbpRepliesBulk({
        projectId,
        locationRowId,
        limit: 10,
        allowAutoPublish: data?.authorization?.autoReplyEnabled === true,
      });
      const auto = result.autoPublished?.length || 0;
      setNotice(
        `${result.drafted?.length || 0} drafts created${auto ? `, ${auto} auto-published` : ''}.${
          result.skipped?.length ? ` ${result.skipped.length} skipped.` : ''
        }`
      );
      await load();
    });

  const handlePublish = (reviewRowId, comment) =>
    run(`publish:${reviewRowId}`, async () => {
      const result = await publishGbpReply({ projectId, locationRowId, reviewRowId, comment });
      if (!result.success) {
        setError((result.errors || ['Reply was not published.']).join(' '));
        return;
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[reviewRowId];
        return next;
      });
      setNotice('Reply published.');
      await load();
    });

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading reviews…" />;
  if (!locations.length) return <NoLocation />;

  const auth = data?.authorization || {};
  const summary = data?.summary?.counts || {};
  const ratingBreakdown = data?.summary?.ratingBreakdown || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Review Management</h1>
          <p className="mt-1 text-sm text-white/45">
            {data?.businessName} · {summary.total || 0} reviews ·{' '}
            {data?.summary?.averageRating ? `${data.summary.averageRating} average` : 'no rating yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={handleSync}
            disabled={busy === 'sync'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync reviews
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Request failed">{error}</Notice> : null}
      {notice ? <Notice tone="success" title={notice} /> : null}

      {/* Authorisation gate */}
      <div className={`${card} ${auth.authorized ? '' : 'border-amber-500/30 bg-amber-500/[0.05]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-semibold">
              {auth.authorized ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              Client authorisation
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              {auth.authorized ? (
                <>
                  Recorded by <span className="text-white/80">{auth.authorizedBy}</span> on{' '}
                  {new Date(auth.authorizedAt).toLocaleDateString()}.
                  {auth.note ? ` ${auth.note}` : ''}
                </>
              ) : (
                <>
                  Replies are published publicly as the business. Google’s API policy requires the
                  client’s authorisation to act on their behalf, so <span className="text-white/80">no
                  reply can be published</span> until it is recorded here.
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAuth((value) => !value)}
            className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.05]"
          >
            {auth.authorized ? 'Manage' : 'Record authorisation'}
          </button>
        </div>

        {showAuth ? (
          <div className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
            {!auth.authorized ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Authorised by" hint="Name and role of the person at the client.">
                    <input
                      className={inputClass}
                      placeholder="e.g. Ayesha Khan, Owner"
                      value={authForm.authorizedBy}
                      onChange={(event) => setAuthForm({ ...authForm, authorizedBy: event.target.value })}
                    />
                  </Field>
                  <Field label="Note" hint="How the authorisation was given — email, contract, meeting.">
                    <input
                      className={inputClass}
                      value={authForm.note}
                      onChange={(event) => setAuthForm({ ...authForm, note: event.target.value })}
                    />
                  </Field>
                </div>
                <button
                  onClick={() => handleAuthorize(true)}
                  disabled={busy === 'auth' || !authForm.authorizedBy.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                >
                  {busy === 'auth' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Record authorisation
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(auth.autoReplyEnabled)}
                    onChange={(event) => handleAutoReply(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-500"
                  />
                  <span>
                    Auto-publish AI replies to 5-star reviews
                    <span className="mt-0.5 block text-[11px] text-white/40">
                      Only 5-star reviews are ever eligible. 4-star and below always wait for a human,
                      and 1–2 star reviews can never auto-publish.
                    </span>
                  </span>
                </label>
                <button
                  onClick={() => handleAuthorize(false)}
                  disabled={busy === 'auth'}
                  className="rounded-lg border border-rose-500/25 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                >
                  Withdraw authorisation
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Summary */}
      <div className={card}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ['Total', summary.total, ''],
            ['Unanswered', summary.unanswered, summary.unanswered ? 'text-amber-400' : 'text-emerald-400'],
            ['Urgent', summary.urgent, summary.urgent ? 'text-rose-400' : 'text-emerald-400'],
            ['Reply pending', summary.replyPending, ''],
            ['Replied', summary.replyPublished, ''],
            ['Flagged', summary.flagged, ''],
          ].map(([label, value, accent]) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
              <p className={`mt-1 font-display text-xl font-bold ${accent}`}>{value ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingBreakdown[stars] || 0;
            const percent = summary.total ? (count / summary.total) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-white/45">{stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${percent}%` }} />
                </div>
                <span className="w-10 text-right text-white/40">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(data?.filters || []).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === value
                ? 'bg-teal-500/15 text-teal-200'
                : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
            }`}
          >
            {FILTER_LABELS[value] || value}
          </button>
        ))}
        <button
          onClick={handleDraftAll}
          disabled={busy === 'draft-all'}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          {busy === 'draft-all' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Draft replies for unanswered
        </button>
      </div>

      {/* Review list */}
      <div className="space-y-3">
        {(data?.reviews || []).length === 0 ? (
          <div className={card}>
            <p className="text-sm text-white/40">
              No reviews in this filter. Press <span className="text-white/70">Sync reviews</span> if you
              have not pulled them from Google yet.
            </p>
          </div>
        ) : null}

        {(data?.reviews || []).map((review) => {
          const draft = drafts[review.id] ?? review.draftReply ?? '';
          return (
            <div key={review.id} className={card}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{review.reviewerName}</span>
                    <Stars rating={review.starRating} />
                    <TierBadge tier={review.tier} />
                    {review.flagged ? (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                        Flagged
                      </span>
                    ) : null}
                    {review.policyViolation ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Policy: {review.policyViolation}
                      </span>
                    ) : null}
                    {review.replyModerationState ? (
                      <span className="text-[11px] text-white/35">{review.replyModerationState}</span>
                    ) : null}
                    {review.mediaCount ? (
                      <span className="text-[11px] text-white/35">{review.mediaCount} photos</span>
                    ) : null}
                    <span className="text-[11px] text-white/30">
                      {review.createTime ? new Date(review.createTime).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/70">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-white/30">Rating only, no text.</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() =>
                      run(`flag:${review.id}`, async () => {
                        await flagGbpReview({
                          projectId,
                          locationRowId,
                          reviewRowId: review.id,
                          flagged: !review.flagged,
                        });
                        await load();
                      })
                    }
                    title={review.flagged ? 'Unflag' : 'Flag for follow-up'}
                    className={`rounded-lg p-1.5 transition hover:bg-white/[0.06] ${
                      review.flagged ? 'text-rose-300' : 'text-white/35 hover:text-white/70'
                    }`}
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {review.replyComment ? (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                        Your reply
                        {review.replyUpdateTime
                          ? ` · ${new Date(review.replyUpdateTime).toLocaleDateString()}`
                          : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-white/70">{review.replyComment}</p>
                    </div>
                    <button
                      onClick={() =>
                        run(`del:${review.id}`, async () => {
                          await deleteGbpReply({ projectId, locationRowId, reviewRowId: review.id });
                          await load();
                        })
                      }
                      disabled={busy === `del:${review.id}`}
                      title="Delete reply"
                      className="shrink-0 rounded-lg p-1.5 text-white/35 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {review.draftStatus === 'awaiting_approval' ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                      Draft needs approval before it is published
                    </p>
                  ) : null}
                  <textarea
                    rows={3}
                    className={inputClass}
                    placeholder="Write a reply, or generate a draft…"
                    value={draft}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [review.id]: event.target.value }))
                    }
                  />
                  {review.lastError ? (
                    <p className="text-xs text-rose-300">{review.lastError}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDraft(review.id)}
                      disabled={busy === `draft:${review.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      {busy === `draft:${review.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      AI draft
                    </button>
                    <button
                      onClick={() => handlePublish(review.id, draft)}
                      disabled={!draft.trim() || !auth.authorized || busy === `publish:${review.id}`}
                      title={auth.authorized ? undefined : 'Record the client’s authorisation first'}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                    >
                      {busy === `publish:${review.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Publish reply
                    </button>
                    {draft ? (
                      <button
                        onClick={() =>
                          setDrafts((current) => ({ ...current, [review.id]: '' }))
                        }
                        className="rounded-lg p-1.5 text-white/30 hover:text-white/60"
                        title="Clear"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {!auth.authorized ? (
                      <span className="text-[11px] text-amber-300/80">
                        Authorisation required before publishing
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
