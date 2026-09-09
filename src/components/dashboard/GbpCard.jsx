import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  MapPin,
  MessageSquare,
  Megaphone,
  Plug,
  RefreshCw,
  Star,
} from 'lucide-react';
import { getConnectionStatus, getGbpOverview, refreshGbpOverview } from '../../lib/gbpApi.js';

function relativeTime(value) {
  if (!value) return null;
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Stat({ label, value, accent, hint }) {
  return (
    <span className="inline-flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/35">{label}</span>
      <span className={`text-sm font-bold ${accent || 'text-white/80'}`}>{value}</span>
      {hint ? <span className="text-[10px] text-white/30">{hint}</span> : null}
    </span>
  );
}

/**
 * Business Profile at a glance, with the sync the user can run from here.
 *
 * Reads the stored copy on load — the overview GET costs no Google quota — and
 * only spends quota when Sync is pressed.
 */
export default function GbpCard({ projectId, projectLabel }) {
  const [status, setStatus] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const connection = await getConnectionStatus(projectId);
      setStatus(connection);

      if (connection.connected && connection.locationCount > 0) {
        setOverview(await getGbpOverview({ projectId, days: 30 }).catch(() => null));
      } else {
        setOverview(null);
      }
    } catch (err) {
      // A dashboard card must never take the page down with it.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      setOverview(await refreshGbpOverview({ projectId, days: 30 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (!projectId) return null;

  const connected = Boolean(status?.connected);
  const needsReauth = status?.status === 'needs_reauth';
  const noAccount = connected && !status?.accountId;
  const noLocations = connected && status?.accountId && !status?.locationCount;

  const headline = overview?.headline;
  const location = overview?.location;
  const unanswered = headline?.unansweredReviews || 0;
  const hasGoogleUpdate = location?.hasGoogleUpdates;
  const unverified = location && location.verificationStatus !== 'VERIFIED';

  const tone = !connected || needsReauth
    ? 'neutral'
    : unverified || unanswered > 0 || hasGoogleUpdate
      ? 'warn'
      : 'good';

  const toneStyles = {
    good: { border: 'border-teal-500/20', from: 'from-teal-500/[0.06]', chip: 'bg-teal-500/15', icon: 'text-teal-400' },
    warn: { border: 'border-amber-500/20', from: 'from-amber-500/[0.06]', chip: 'bg-amber-500/15', icon: 'text-amber-400' },
    neutral: { border: 'border-white/10', from: 'from-white/[0.04]', chip: 'bg-white/[0.06]', icon: 'text-white/40' },
  }[tone];

  return (
    <div
      className={`mt-5 overflow-hidden rounded-2xl border bg-gradient-to-r to-transparent p-5 ${toneStyles.border} ${toneStyles.from}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${toneStyles.chip}`}>
          <MapPin className={`h-4.5 w-4.5 ${toneStyles.icon}`} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-sm font-bold">
            Google Business Profile
            {connected && location?.businessName ? (
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-white/55">
                {location.businessName}
              </span>
            ) : null}
            {status?.locationCount > 1 ? (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/45">
                {status.locationCount} locations
              </span>
            ) : null}
            {unanswered > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                {unanswered} unanswered
              </span>
            ) : null}
          </h3>

          {loading ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading Business Profile…
            </p>
          ) : error ? (
            <p className="mt-0.5 text-xs text-rose-300">{error}</p>
          ) : needsReauth ? (
            <p className="mt-0.5 text-xs text-amber-300">
              {status.statusDetail || 'Google revoked the stored access.'} Reconnect to resume syncing.
            </p>
          ) : !connected ? (
            <p className="mt-0.5 text-xs text-white/45">
              {projectLabel} has no Business Profile connected. Sign in with the Google account that
              manages the listing to track reviews, posts and local performance.
            </p>
          ) : noAccount ? (
            <p className="mt-0.5 text-xs text-white/45">
              Connected as {status.googleEmail}, but no Business Profile account is selected yet.
            </p>
          ) : noLocations ? (
            <p className="mt-0.5 text-xs text-white/45">
              Account selected, but no locations are attached. Pick the listings this project manages.
            </p>
          ) : !overview || overview.needsFirstSync ? (
            <p className="mt-0.5 text-xs text-white/45">
              Location attached but never synced. Press Sync to pull the profile, reviews, posts and
              performance.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-white/50">
              {location.primaryCategory ? `${location.primaryCategory} · ` : ''}
              {location.address || ''}
              {location.lastSyncAt ? ` · synced ${relativeTime(location.lastSyncAt)}` : ''}
            </p>
          )}

          {connected && headline ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Stat
                label="Health"
                value={`${headline.healthScore ?? 0}/100`}
                accent={
                  (headline.healthScore ?? 0) >= 80
                    ? 'text-emerald-400'
                    : (headline.healthScore ?? 0) >= 60
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }
              />
              <Stat
                label="Rating"
                value={headline.averageRating ? headline.averageRating.toFixed(1) : '—'}
                hint={headline.totalReviews ? `${headline.totalReviews} reviews` : 'no reviews'}
              />
              <Stat
                label="Unanswered"
                value={unanswered}
                accent={unanswered ? 'text-amber-400' : 'text-emerald-400'}
              />
              <Stat
                label="Posts 30d"
                value={headline.postsLast30Days ?? 0}
                hint={headline.lastPostAt ? relativeTime(headline.lastPostAt) : 'never'}
              />
              {(overview.metrics || []).slice(0, 2).map((metric) => (
                <Stat
                  key={metric.key}
                  label={metric.key === 'searchViews' ? 'Search' : metric.key === 'mapsViews' ? 'Maps' : metric.key}
                  value={(metric.current ?? 0).toLocaleString()}
                  hint={metric.change === null ? null : `${metric.change > 0 ? '+' : ''}${metric.change}%`}
                />
              ))}
            </div>
          ) : null}

          {(unverified || hasGoogleUpdate) && overview ? (
            <ul className="mt-3 space-y-1">
              {unverified ? (
                <li className="flex items-start gap-1.5 text-xs text-white/55">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-400" />
                  Listing is not verified — it will not rank in the local pack or publish posts.
                </li>
              ) : null}
              {hasGoogleUpdate ? (
                <li className="flex items-start gap-1.5 text-xs text-white/55">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
                  Google has suggested a profile change. It overwrites your data if left unreviewed.
                </li>
              ) : null}
            </ul>
          ) : null}

          {connected && overview ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/local-seo/gbp/reviews"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.06]"
              >
                <Star className="h-3 w-3" /> Reviews
              </Link>
              <Link
                to="/local-seo/gbp/posts"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.06]"
              >
                <Megaphone className="h-3 w-3" /> Posts
              </Link>
              <Link
                to="/local-seo/gbp/qanda"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.06]"
              >
                <MessageSquare className="h-3 w-3" /> Q&amp;A
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 flex-col gap-2">
          {connected && status?.locationCount > 0 ? (
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          ) : (
            <Link
              to="/local-seo/gbp"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
            >
              <Plug className="h-3.5 w-3.5" />
              {needsReauth ? 'Reconnect' : connected ? 'Finish setup' : 'Connect'}
            </Link>
          )}
          <Link
            to="/local-seo/gbp/overview"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05]"
          >
            Dashboard
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
