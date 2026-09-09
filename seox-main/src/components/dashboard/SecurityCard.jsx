import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import { getSessionToken } from '../../lib/authSession.js';

const ENDPOINT = '/api/tech-seo/wordpress-security';

async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const headers = new Headers();
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');

  const response = await fetch(url.pathname + url.search, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function relativeTime(value) {
  if (!value) return null;
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Site security at a glance, with the scan the user can actually run from here.
 * The endpoint stores every scan, so pressing Scan on the dashboard and opening
 * the full page later show the same result.
 */
export default function SecurityCard({ projectId, projectLabel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await api(ENDPOINT, { params: { projectId } }));
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

  const handleScan = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await api(ENDPOINT, {
        method: 'POST',
        body: { action: 'scan', projectId },
      });
      setData((current) => ({ ...current, ...result, needsFirstScan: false }));
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  if (!projectId) return null;

  const scan = data?.scan;
  const counts = scan?.counts || {};
  const critical = counts.critical || 0;
  const high = counts.high || 0;
  const actionable = critical + high;
  const otherFindings = (counts.medium || 0) + (counts.low || 0) + (counts.info || 0);

  const tone = !scan
    ? 'neutral'
    : !scan.isWordPress
      ? 'neutral'
      : actionable > 0
        ? 'bad'
        : otherFindings > 0
          ? 'warn'
          : 'good';

  const toneStyles = {
    good: { border: 'border-emerald-500/20', from: 'from-emerald-500/[0.06]', chip: 'bg-emerald-500/15', icon: 'text-emerald-400', Icon: ShieldCheck },
    warn: { border: 'border-amber-500/20', from: 'from-amber-500/[0.06]', chip: 'bg-amber-500/15', icon: 'text-amber-400', Icon: AlertTriangle },
    bad: { border: 'border-rose-500/25', from: 'from-rose-500/[0.07]', chip: 'bg-rose-500/15', icon: 'text-rose-400', Icon: ShieldAlert },
    neutral: { border: 'border-white/10', from: 'from-white/[0.04]', chip: 'bg-white/[0.06]', icon: 'text-white/40', Icon: ShieldQuestion },
  }[tone];

  const ToneIcon = toneStyles.Icon;

  return (
    <div
      className={`mt-5 overflow-hidden rounded-2xl border bg-gradient-to-r to-transparent p-5 ${toneStyles.border} ${toneStyles.from}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${toneStyles.chip}`}>
          <ToneIcon className={`h-4.5 w-4.5 ${toneStyles.icon}`} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-sm font-bold">
            Site Security
            {scan?.isWordPress ? (
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-white/55">
                WordPress{scan.coreVersion ? ` ${scan.coreVersion}` : ''}
              </span>
            ) : null}
            {actionable > 0 ? (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                {actionable} need{actionable === 1 ? 's' : ''} attention
              </span>
            ) : null}
          </h3>

          {loading ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading last scan…
            </p>
          ) : error ? (
            <p className="mt-0.5 text-xs text-rose-300">{error}</p>
          ) : !scan ? (
            <p className="mt-0.5 text-xs text-white/45">
              {projectLabel} has never been scanned. Check it against the WPScan vulnerability
              database — the result is saved and tracked over time.
            </p>
          ) : !scan.isWordPress ? (
            <p className="mt-0.5 text-xs text-white/45">
              This site does not look like WordPress, so no WordPress checks ran. Scanned{' '}
              {relativeTime(scan.createdAt)}.
            </p>
          ) : actionable > 0 ? (
            <p className="mt-0.5 text-xs text-white/50">
              {critical ? `${critical} critical` : ''}
              {critical && high ? ' and ' : ''}
              {high ? `${high} high-severity` : ''} finding{actionable === 1 ? '' : 's'} on{' '}
              {scan.pluginsFound} plugin{scan.pluginsFound === 1 ? '' : 's'} and {scan.themesFound}{' '}
              theme{scan.themesFound === 1 ? '' : 's'} · scanned {relativeTime(scan.createdAt)}
            </p>
          ) : otherFindings > 0 ? (
            <p className="mt-0.5 text-xs text-white/50">
              Nothing critical. {otherFindings} hardening item{otherFindings === 1 ? '' : 's'} worth
              tidying · scanned {relativeTime(scan.createdAt)}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-white/50">
              Nothing reportable on what the scan could see · scanned {relativeTime(scan.createdAt)}
            </p>
          )}

          {scan?.isWordPress ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['Critical', counts.critical, 'text-rose-300'],
                ['High', counts.high, 'text-amber-300'],
                ['Medium', counts.medium, 'text-sky-300'],
                ['Low', counts.low, 'text-white/55'],
                ['Info', counts.info, 'text-white/45'],
              ].map(([label, value, colour]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs"
                >
                  <span className="text-white/40">{label}</span>
                  <span className={`font-bold ${colour}`}>{value ?? 0}</span>
                </span>
              ))}
            </div>
          ) : null}

          {scan?.findings?.length ? (
            <ul className="mt-3 space-y-1">
              {scan.findings
                .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
                .slice(0, 3)
                .map((finding, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-xs text-white/55">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-400" />
                    <span className="min-w-0 truncate">
                      {finding.componentName ? `${finding.componentName}: ` : ''}
                      {finding.title}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}

          {!data?.vulnDbConfigured && scan?.isWordPress ? (
            <p className="mt-2 text-[11px] text-amber-300/80">
              No WPScan API token configured, so components were listed but not checked against the
              vulnerability database.
            </p>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 flex-col gap-2">
          <button
            onClick={handleScan}
            disabled={scanning || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {scan ? 'Rescan' : 'Scan now'}
          </button>
          <Link
            to="/tech-seo/wordpress-security"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05]"
          >
            Full report
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
