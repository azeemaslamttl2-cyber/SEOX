import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ExternalLink,
  Info,
  Lightbulb,
  Loader2,
  MapPin,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useCrawl } from '../../context/CrawlContext.jsx';
import {
  getGbpOverview,
  listAttachedLocations,
  refreshGbpOverview,
} from '../../lib/gbpApi.js';

const card = 'rounded-2xl border border-white/10 bg-white/[0.02] p-5';

const RANGES = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 180, label: '6m' },
  { days: 365, label: '12m' },
];

const METRIC_LABELS = {
  searchViews: 'Search views',
  mapsViews: 'Maps views',
  calls: 'Calls',
  websiteClicks: 'Website clicks',
  directions: 'Directions',
  messages: 'Messages',
};

const METRIC_GROUPS = {
  searchViews: ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'],
  mapsViews: ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'],
  calls: ['CALL_CLICKS'],
  websiteClicks: ['WEBSITE_CLICKS'],
  directions: ['BUSINESS_DIRECTION_REQUESTS'],
  messages: ['BUSINESS_CONVERSATIONS'],
};

const SEVERITY = {
  critical: { label: 'Critical', className: 'border-rose-500/30 bg-rose-500/[0.07]', dot: 'bg-rose-400', Icon: AlertCircle },
  high: { label: 'High', className: 'border-amber-500/30 bg-amber-500/[0.07]', dot: 'bg-amber-400', Icon: AlertTriangle },
  medium: { label: 'Medium', className: 'border-sky-500/25 bg-sky-500/[0.06]', dot: 'bg-sky-400', Icon: Info },
  opportunity: { label: 'Opportunity', className: 'border-emerald-500/25 bg-emerald-500/[0.06]', dot: 'bg-emerald-400', Icon: Lightbulb },
};

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString();
}

function scoreColor(score) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

function Stat({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${accent || 'text-white'}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-white/35">{hint}</p> : null}
    </div>
  );
}

function Delta({ change }) {
  if (change === null || change === undefined) return <span className="text-[11px] text-white/30">no baseline</span>;
  const positive = change >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        positive ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(change)}%
    </span>
  );
}

export default function GbpOverview() {
  const { project } = useCrawl();
  const [params, setParams] = useSearchParams();
  const projectId = project?.id || '';

  const [locations, setLocations] = useState([]);
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);

  const locationRowId = params.get('location') || '';

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [locationData, overview] = await Promise.all([
        listAttachedLocations(projectId).catch(() => ({ locations: [] })),
        getGbpOverview({ projectId, locationRowId, days }),
      ]);
      setLocations(locationData.locations || []);
      setData(overview);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, locationRowId, days]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    setWarnings([]);
    try {
      const fresh = await refreshGbpOverview({ projectId, locationRowId, days });
      setData(fresh);
      setWarnings(fresh.warnings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const chartData = useMemo(() => {
    if (!data?.series?.length) return [];
    const byDate = new Map();
    for (const row of data.series) {
      const date = String(row.metric_date).slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, { date });
      const bucket = byDate.get(date);
      for (const [key, metrics] of Object.entries(METRIC_GROUPS)) {
        if (!metrics.includes(row.metric)) continue;
        bucket[key] = (bucket[key] || 0) + Number(row.value || 0);
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const metricByKey = useMemo(
    () => Object.fromEntries((data?.metrics || []).map((metric) => [metric.key, metric])),
    [data]
  );

  if (!projectId) {
    return (
      <div className={card}>
        <p className="text-sm text-white/50">Select a project to view its Business Profile dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Business Profile dashboard…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={card}>
        <p className="text-sm text-rose-300">{error}</p>
        <Link
          to="/local-seo/gbp"
          className="mt-4 inline-block rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.1]"
        >
          Go to connection settings
        </Link>
      </div>
    );
  }

  const { location, headline, health, completeness, issues, range } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <MapPin className="h-5 w-5 text-teal-400" />
            <span className="truncate">{location.businessName}</span>
          </h1>
          <p className="mt-1 truncate text-sm text-white/45">
            {[location.primaryCategory, location.address].filter(Boolean).join(' · ')}
            {location.mapsUri ? (
              <a
                href={location.mapsUri}
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-teal-300 hover:underline"
              >
                View on Maps <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {locations.length > 1 ? (
            <select
              value={locationRowId || String(location.id)}
              onChange={(event) => setParams({ location: event.target.value })}
              className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white/80"
            >
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.businessName}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex rounded-lg border border-white/10 p-0.5">
            {RANGES.map((option) => (
              <button
                key={option.days}
                onClick={() => setDays(option.days)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  days === option.days ? 'bg-white/[0.1] text-white' : 'text-white/45 hover:text-white/70'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync from Google
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-sm text-rose-200">{error}</div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm">
          <p className="font-semibold text-amber-200">Synced with warnings</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-white/55">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.needsFirstSync ? (
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-4 text-sm">
          <p className="font-semibold text-teal-200">No data yet</p>
          <p className="mt-1 text-white/55">
            This location has not been synced. Press <span className="text-white/80">Sync from Google</span> to
            pull the profile, reviews, posts and performance metrics.
          </p>
        </div>
      ) : null}

      {/* Headline */}
      <div className={card}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Health score"
            value={`${health.score} / 100`}
            accent={scoreColor(health.score)}
            hint={`Profile ${completeness.percent}% complete`}
          />
          <Stat
            label="Google rating"
            value={headline.averageRating ? headline.averageRating.toFixed(1) : '—'}
            hint={headline.totalReviews ? `${formatNumber(headline.totalReviews)} reviews` : 'no reviews yet'}
          />
          <Stat
            label="Unanswered"
            value={formatNumber(headline.unansweredReviews)}
            accent={headline.unansweredReviews ? 'text-rose-400' : 'text-emerald-400'}
            hint="in recent reviews"
          />
          <Stat
            label="Posts / 30d"
            value={formatNumber(headline.postsLast30Days)}
            hint={
              headline.lastPostAt
                ? `last ${new Date(headline.lastPostAt).toLocaleDateString()}`
                : 'never posted'
            }
          />
          <Stat
            label="Verification"
            value={location.verificationStatus === 'VERIFIED' ? 'Verified' : 'Action needed'}
            accent={location.verificationStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'}
          />
          <Stat
            label="Local rank avg"
            value="—"
            hint="RankGrid link lands in phase 4"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.keys(METRIC_LABELS).map((key) => {
            const metric = metricByKey[key];
            return (
              <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  {METRIC_LABELS[key]}
                </p>
                <p className="mt-1 font-display text-xl font-bold">{formatNumber(metric?.current)}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Delta change={metric?.change} />
                  <span className="text-[11px] text-white/25">vs {formatNumber(metric?.previous)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-white/30">
          {range.current.from} → {range.current.to} · Google publishes performance data with a{' '}
          {range.metricLagDays}-day lag, so the window ends before today.
        </p>
      </div>

      {/* Trend */}
      {chartData.length ? (
        <div className={card}>
          <h2 className="font-semibold">Interactions</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gbpSearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gbpMaps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={11} tickMargin={8} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: '#12121a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="searchViews"
                  name="Search views"
                  stroke="#2dd4bf"
                  fill="url(#gbpSearch)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="mapsViews"
                  name="Maps views"
                  stroke="#f97316"
                  fill="url(#gbpMaps)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Issues */}
        <div className={card}>
          <h2 className="font-semibold">What needs attention</h2>
          {issues.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">
              Nothing flagged. Sync again after making changes in Google.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {issues.map((issue, index) => {
                const meta = SEVERITY[issue.severity] || SEVERITY.medium;
                const Icon = meta.Icon;
                return (
                  <li
                    key={`${issue.severity}-${issue.title}-${index}`}
                    className={`rounded-xl border p-3.5 ${meta.className}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{issue.title}</span>
                          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-white/50">{issue.detail}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Completeness */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Profile completeness</h2>
            <span className={`font-display text-lg font-bold ${scoreColor(completeness.percent)}`}>
              {completeness.percent}%
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-teal-400 transition-all"
              style={{ width: `${completeness.percent}%` }}
            />
          </div>

          <ul className="mt-4 space-y-1.5">
            {completeness.checks.map((check) => (
              <li key={check.key} className="flex items-center gap-2 text-sm">
                {check.ok ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                )}
                <span className={check.ok ? 'text-white/60' : 'text-white/85'}>{check.label}</span>
              </li>
            ))}
          </ul>

          {completeness.pending?.length ? (
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/30">
              Not scored yet: {completeness.pending.join(', ')}. These need the media, services and Q&amp;A
              endpoints, which arrive in later phases.
            </p>
          ) : null}
        </div>
      </div>

      {/* Score breakdown */}
      <div className={card}>
        <h2 className="font-semibold">Health score breakdown</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(health.breakdown).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="text-[11px] capitalize text-white/40">
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </p>
              <p className="mt-1 font-display text-lg font-bold">
                {value}
                <span className="text-sm font-normal text-white/30"> / {health.weights[key]}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-white/30">
        <Star className="h-3 w-3" />
        Last synced:{' '}
        {location.lastSyncAt ? new Date(location.lastSyncAt).toLocaleString() : 'never'}
      </p>
    </div>
  );
}
