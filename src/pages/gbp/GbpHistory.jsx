import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, History, Minus } from 'lucide-react';
import {
  LocationPicker,
  NoLocation,
  NoProject,
  Notice,
  Spinner,
  card,
  scoreColor,
  useGbpLocation,
} from './gbpUi.jsx';
import { getGbpHistory } from '../../lib/gbpApi.js';

function ChangeRow({ change }) {
  const Icon = change.delta > 0 ? ArrowUpRight : change.delta < 0 ? ArrowDownRight : Minus;
  const tone = change.improved ? 'text-emerald-400' : 'text-rose-400';

  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
      <span className={`font-semibold ${tone}`}>
        {change.delta > 0 ? '+' : ''}
        {change.delta}
        {change.suffix}
      </span>
      <span className="text-white/65">{change.label}</span>
      <span className="text-white/30">
        {change.from}
        {change.suffix} → {change.to}
        {change.suffix}
      </span>
    </li>
  );
}

export default function GbpHistory() {
  const { projectId, locations, locationRowId, setLocationRowId, loadingLocations } = useGbpLocation();

  const [data, setData] = useState(null);
  const [compare, setCompare] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await getGbpHistory({ projectId, locationRowId, compare: compare || undefined }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, locationRowId, compare]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const chartData = useMemo(
    () =>
      (data?.timeline || []).map((entry) => ({
        date: new Date(entry.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        score: entry.score,
      })),
    [data]
  );

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading audit history…" />;
  if (!locations.length) return <NoLocation />;

  const timeline = data?.timeline || [];
  const diff = data?.diff;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Audit History</h1>
          <p className="mt-1 text-sm text-white/45">
            {data?.businessName} · {timeline.length} run{timeline.length === 1 ? '' : 's'} stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          {timeline.length > 1 ? (
            <select
              value={compare}
              onChange={(event) => setCompare(event.target.value)}
              className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white/80"
            >
              <option value="">Compare with previous run</option>
              {timeline
                .filter((entry) => entry.id !== data?.current?.id)
                .slice()
                .reverse()
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {new Date(entry.createdAt).toLocaleDateString()} · score {entry.score}
                  </option>
                ))}
            </select>
          ) : null}
        </div>
      </div>

      {error ? <Notice tone="error" title="Could not load history">{error}</Notice> : null}

      {data?.needsFirstRun ? (
        <div className={card}>
          <Notice tone="info" title="No audits yet">
            Run the first audit on the{' '}
            <Link to="/local-seo/gbp/audit" className="text-teal-300 hover:underline">
              Health Audit
            </Link>{' '}
            page. Every run is stored, so nothing is ever overwritten.
          </Notice>
        </div>
      ) : null}

      {timeline.length ? (
        <div className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            <History className="h-4 w-4 text-teal-400" />
            Score over time
          </h2>

          {chartData.length > 1 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={11} tickMargin={8} />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#12121a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2dd4bf"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#2dd4bf' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <ul className="mt-4 divide-y divide-white/[0.06]">
            {[...timeline].reverse().map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-white/45">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
                <span className={`w-14 font-display text-lg font-bold ${scoreColor(entry.score)}`}>
                  {entry.score}
                </span>
                <span className="flex flex-wrap gap-1.5 text-[11px]">
                  {entry.counts.critical ? (
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">
                      {entry.counts.critical} critical
                    </span>
                  ) : null}
                  {entry.counts.high ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                      {entry.counts.high} high
                    </span>
                  ) : null}
                  {entry.counts.medium ? (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                      {entry.counts.medium} medium
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data?.needsSecondRun && timeline.length === 1 ? (
        <Notice tone="info" title="Only one audit so far">
          Run a second audit to see what changed between them.
        </Notice>
      ) : null}

      {diff ? (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Changes since {new Date(diff.since).toLocaleDateString()}
            </h2>
            <span
              className={`inline-flex items-center gap-1 font-display text-lg font-bold ${
                diff.scoreDelta > 0
                  ? 'text-emerald-400'
                  : diff.scoreDelta < 0
                    ? 'text-rose-400'
                    : 'text-white/45'
              }`}
            >
              {diff.scoreDelta > 0 ? <ArrowUpRight className="h-4 w-4" /> : null}
              {diff.scoreDelta < 0 ? <ArrowDownRight className="h-4 w-4" /> : null}
              Score {diff.scoreFrom} → {diff.scoreTo}
            </span>
          </div>

          {diff.changes.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">
              No measured signal changed between these two runs.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {diff.changes.map((change) => (
                <ChangeRow key={change.key} change={change} />
              ))}
            </ul>
          )}

          <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/30">
            Only signals that were read in both runs are compared. One that failed to fetch in either
            run is left out rather than shown as a change. Grid rank is absent because RankGrid is not
            linked to GBP locations yet.
          </p>
        </div>
      ) : null}
    </div>
  );
}
