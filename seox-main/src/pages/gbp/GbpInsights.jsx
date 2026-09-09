import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Lightbulb, Loader2, Play, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  LocationPicker,
  NoLocation,
  NoProject,
  Notice,
  Spinner,
  card,
  useGbpLocation,
} from './gbpUi.jsx';
import { analyseGbpReviews, getGbpInsightHistory, getGbpInsights } from '../../lib/gbpApi.js';

function ThemeList({ themes, tone }) {
  if (!themes?.length) {
    return <p className="mt-3 text-sm text-white/35">Nothing recurring found.</p>;
  }
  const max = Math.max(...themes.map((theme) => theme.mentions));
  const barColor = tone === 'positive' ? 'bg-emerald-400/70' : 'bg-rose-400/70';

  return (
    <ul className="mt-3 space-y-2">
      {themes.map((theme) => (
        <li key={theme.theme} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm capitalize text-white/70">{theme.theme}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${(theme.mentions / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-white/45">
            {theme.mentions} mention{theme.mentions === 1 ? '' : 's'}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function GbpInsights() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [data, setData] = useState(null);
  const [adjusted, setAdjusted] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [insight, historyData] = await Promise.all([
        getGbpInsights({ projectId, locationRowId }),
        getGbpInsightHistory({ projectId, locationRowId }).catch(() => ({ history: [] })),
      ]);
      setData(insight);
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

  const handleAnalyse = async () => {
    setRunning(true);
    setError('');
    setAdjusted([]);
    try {
      const result = await analyseGbpReviews({ projectId, locationRowId });
      setAdjusted(result.adjustedThemes || []);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading review intelligence…" />;
  if (!locations.length) return <NoLocation />;

  const insight = data?.insight;
  const ratingBreakdown = insight?.ratingBreakdown || data?.summary?.ratingBreakdown || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Review Intelligence</h1>
          <p className="mt-1 text-sm text-white/45">
            {data?.businessName} · {data?.reviewsAvailable || 0} reviews stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={handleAnalyse}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Analyse reviews
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Analysis failed">{error}</Notice> : null}

      {adjusted.length ? (
        <Notice tone="info" title="Some counts were corrected">
          <p>
            The model’s own mention counts were checked against the stored review text. These differed
            and were replaced with the verified count:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {adjusted.map((entry) => (
              <li key={entry.theme}>
                <span className="text-white/70">{entry.theme}</span> — claimed {entry.claimed}, verified{' '}
                {entry.verified}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {!insight ? (
        <div className={card}>
          <Notice tone="info" title="No analysis yet">
            {data?.reviewsAvailable >= 5 ? (
              <>
                {data.reviewsAvailable} reviews are stored. Run the analysis to extract the themes
                customers keep raising.
              </>
            ) : (
              <>
                Only {data?.reviewsAvailable || 0} reviews are stored. Sync reviews from the{' '}
                <Link to="/local-seo/gbp/reviews" className="text-teal-300 hover:underline">
                  Review Management
                </Link>{' '}
                page first — at least 5 written reviews are needed.
              </>
            )}
          </Notice>
        </div>
      ) : (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Reviews analysed
                </p>
                <p className="mt-1 font-display text-3xl font-bold">{insight.reviewsAnalysed}</p>
                <p className="mt-0.5 text-[11px] text-white/30">
                  {new Date(insight.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                <span className="font-display text-3xl font-bold">
                  {insight.averageRating ? insight.averageRating.toFixed(1) : '—'}
                </span>
              </div>

              <div className="min-w-[200px] flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingBreakdown[stars] || 0;
                  const percent = insight.reviewsAnalysed
                    ? (count / insight.reviewsAnalysed) * 100
                    : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-white/45">{stars}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="w-8 text-right text-white/40">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={card}>
              <h2 className="flex items-center gap-2 font-semibold">
                <ThumbsUp className="h-4 w-4 text-emerald-400" />
                What customers praise
              </h2>
              <ThemeList themes={insight.positiveThemes} tone="positive" />
            </div>

            <div className={card}>
              <h2 className="flex items-center gap-2 font-semibold">
                <ThumbsDown className="h-4 w-4 text-rose-400" />
                What customers complain about
              </h2>
              <ThemeList themes={insight.negativeThemes} tone="negative" />
            </div>
          </div>

          {insight.recommendation ? (
            <div className={`${card} border-teal-500/25 bg-teal-500/[0.05]`}>
              <h2 className="flex items-center gap-2 font-semibold text-teal-200">
                <Lightbulb className="h-4 w-4" />
                Recommendation
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{insight.recommendation}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/local-seo/gbp/profile"
                  className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.14]"
                >
                  Use in the GBP description
                </Link>
                <Link
                  to="/local-seo/gbp/posts"
                  className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.14]"
                >
                  Write a post around it
                </Link>
              </div>
            </div>
          ) : null}

          {history.length > 1 ? (
            <div className={card}>
              <h2 className="font-semibold">Previous analyses</h2>
              <p className="mt-1 text-xs text-white/35">
                Each run is stored, so themes can be tracked as the review base grows.
              </p>
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="w-32 shrink-0 text-white/45">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    <span className="w-28 text-white/65">
                      {entry.reviewsAnalysed} review{entry.reviewsAnalysed === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-white/65">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {entry.averageRating ? entry.averageRating.toFixed(1) : '—'}
                    </span>
                    {entry.id === insight.id ? (
                      <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300">
                        Current
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={card}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BrainCircuit className="h-4 w-4 text-white/40" />
              How these counts are produced
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/40">
              The AI proposes themes from the review text. Each theme is then counted against the
              stored reviews by SEOX, and a theme it cannot find is dropped. Ratings, totals and the
              star breakdown are computed locally and are never asked of the model.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
