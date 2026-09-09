import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  HelpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import {
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
  deleteGbpAnswer,
  draftGbpAnswer,
  draftGbpAnswersBulk,
  listGbpQuestions,
  publishGbpAnswer,
  syncGbpQuestions,
} from '../../lib/gbpApi.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'answered', label: 'Answered' },
];

export default function GbpQanda() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [lowConfidence, setLowConfidence] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await listGbpQuestions({ projectId, locationRowId, status }));
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
      const result = await syncGbpQuestions({ projectId, locationRowId });
      setNotice(`${result.synced} questions synced.`);
      await load();
    });

  const handleDraft = (questionRowId) =>
    run(`draft:${questionRowId}`, async () => {
      const result = await draftGbpAnswer({ projectId, locationRowId, questionRowId });
      const entry = result.drafted?.[0];
      if (entry) {
        setDrafts((current) => ({ ...current, [questionRowId]: entry.question.draftAnswer }));
        setLowConfidence((current) => ({
          ...current,
          [questionRowId]: entry.confident ? null : entry.missing || 'The profile does not contain this.',
        }));
      } else if (result.skipped?.length) {
        setError(result.skipped[0].reason);
      }
      await load();
    });

  const handleDraftAll = () =>
    run('draft-all', async () => {
      const result = await draftGbpAnswersBulk({ projectId, locationRowId, limit: 10 });
      setNotice(
        `${result.drafted?.length || 0} answers drafted.${
          result.skipped?.length ? ` ${result.skipped.length} skipped.` : ''
        }`
      );
      await load();
    });

  const handlePublish = (questionRowId, answer) =>
    run(`publish:${questionRowId}`, async () => {
      const result = await publishGbpAnswer({ projectId, locationRowId, questionRowId, answer });
      if (!result.success) {
        setError((result.errors || ['Answer was not published.']).join(' '));
        return;
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[questionRowId];
        return next;
      });
      setNotice('Answer published.');
      await load();
    });

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading questions…" />;
  if (!locations.length) return <NoLocation />;

  const counts = data?.counts || {};
  const authorized = Boolean(data?.authorization?.authorized);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Q&amp;A Manager</h1>
          <p className="mt-1 text-sm text-white/45">{data?.businessName}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={handleSync}
            disabled={busy === 'sync'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync questions
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Request failed">{error}</Notice> : null}
      {notice ? <Notice tone="success" title={notice} /> : null}

      {!authorized ? (
        <Notice tone="warn" title="Client authorisation required">
          Answers are published publicly as the business. Record the client’s authorisation on the{' '}
          <Link to="/local-seo/gbp/reviews" className="text-teal-300 hover:underline">
            Review Management
          </Link>{' '}
          page before any answer can be published. Drafting is allowed without it.
        </Notice>
      ) : null}

      <div className={card}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Total', counts.total, ''],
            ['Answered', counts.answered, 'text-emerald-400'],
            ['Unanswered', counts.unanswered, counts.unanswered ? 'text-amber-400' : 'text-emerald-400'],
            ['Drafts ready', counts.drafts, ''],
          ].map(([label, value, accent]) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
              <p className={`mt-1 font-display text-xl font-bold ${accent}`}>{value ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setStatus(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === option.value
                ? 'bg-teal-500/15 text-teal-200'
                : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
            }`}
          >
            {option.label}
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
          Draft answers for unanswered
        </button>
      </div>

      <div className="space-y-3">
        {(data?.questions || []).length === 0 ? (
          <div className={card}>
            <p className="text-sm text-white/40">
              No questions in this filter. Press <span className="text-white/70">Sync questions</span> to
              pull them from Google.
            </p>
          </div>
        ) : null}

        {(data?.questions || []).map((question) => {
          const draft = drafts[question.id] ?? question.draftAnswer ?? '';
          const missing = lowConfidence[question.id];

          return (
            <div key={question.id} className={card}>
              <div className="flex flex-wrap items-start gap-2">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-white/80">{question.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                    <span>{question.authorName || 'Anonymous'}</span>
                    {question.createTime ? (
                      <span>{new Date(question.createTime).toLocaleDateString()}</span>
                    ) : null}
                    {question.upvoteCount ? (
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {question.upvoteCount}
                      </span>
                    ) : null}
                    {question.totalAnswerCount ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {question.totalAnswerCount} answer{question.totalAnswerCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Answers other people wrote — worth seeing before answering. */}
              {question.topAnswers?.filter((answer) => answer.authorType !== 'MERCHANT').length ? (
                <details className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-white/50">
                    {question.topAnswers.filter((answer) => answer.authorType !== 'MERCHANT').length}{' '}
                    answers from other users
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {question.topAnswers
                      .filter((answer) => answer.authorType !== 'MERCHANT')
                      .map((answer, index) => (
                        <li key={index} className="text-xs text-white/50">
                          <span className="text-white/70">{answer.authorName || 'Anonymous'}:</span>{' '}
                          {answer.text}
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}

              {question.ownerAnswer ? (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                        Your answer
                        {question.ownerAnswerTime
                          ? ` · ${new Date(question.ownerAnswerTime).toLocaleDateString()}`
                          : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-white/70">
                        {question.ownerAnswer}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        run(`del:${question.id}`, async () => {
                          await deleteGbpAnswer({ projectId, locationRowId, questionRowId: question.id });
                          await load();
                        })
                      }
                      disabled={busy === `del:${question.id}` || !authorized}
                      title="Delete answer"
                      className="shrink-0 rounded-lg p-1.5 text-white/35 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {question.draftStatus === 'awaiting_approval' || missing ? (
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      The profile did not contain a confident answer
                      {missing ? `: ${missing}` : ''}. Check the draft before publishing.
                    </p>
                  ) : null}
                  <textarea
                    rows={3}
                    className={inputClass}
                    placeholder="Write an answer, or generate a draft from the profile…"
                    value={draft}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                  />
                  {question.lastError ? (
                    <p className="text-xs text-rose-300">{question.lastError}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDraft(question.id)}
                      disabled={busy === `draft:${question.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      {busy === `draft:${question.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      AI draft
                    </button>
                    <button
                      onClick={() => handlePublish(question.id, draft)}
                      disabled={!draft.trim() || !authorized || busy === `publish:${question.id}`}
                      title={authorized ? undefined : 'Record the client’s authorisation first'}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                    >
                      {busy === `publish:${question.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Publish answer
                    </button>
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
