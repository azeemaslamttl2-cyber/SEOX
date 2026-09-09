import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Info,
  Loader2,
  MinusCircle,
  Puzzle,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import { useCrawl } from '../../context/CrawlContext.jsx';
import { getSessionToken } from '../../lib/authSession.js';

const card = 'rounded-2xl border border-white/10 bg-white/[0.02] p-5';

const SEVERITY_META = {
  critical: { label: 'Critical', className: 'border-rose-500/30 bg-rose-500/[0.07]', text: 'text-rose-300', Icon: AlertCircle },
  high: { label: 'High', className: 'border-amber-500/30 bg-amber-500/[0.07]', text: 'text-amber-300', Icon: AlertTriangle },
  medium: { label: 'Medium', className: 'border-sky-500/25 bg-sky-500/[0.06]', text: 'text-sky-300', Icon: Info },
  low: { label: 'Low', className: 'border-white/[0.12] bg-white/[0.03]', text: 'text-white/60', Icon: MinusCircle },
  info: { label: 'Info', className: 'border-white/[0.10] bg-white/[0.02]', text: 'text-white/45', Icon: Info },
};

const KIND_LABELS = { core: 'WordPress core', plugin: 'Plugin', theme: 'Theme', exposure: 'Exposure' };

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

export default function WordPressSecurity() {
  const { project } = useCrawl();
  const projectId = project?.id || '';

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
      setData(await api('/api/tech-seo/wordpress-security', { params: { projectId } }));
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

  const handleScan = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await api('/api/tech-seo/wordpress-security', {
        method: 'POST',
        body: { action: 'scan', projectId },
      });
      setData((current) => ({ ...current, ...result }));
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  if (!projectId) {
    return (
      <div className={card}>
        <p className="text-sm text-white/50">
          Select a project first. SEOX only scans sites you have a project for.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading last scanâ€¦
      </div>
    );
  }

  const scan = data?.scan;
  const counts = scan?.counts || {};
  const actionable = (counts.critical || 0) + (counts.high || 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">WordPress Security</h1>
          <p className="mt-1 text-sm text-white/45">
            Passive check of {project?.domain || project?.name} against the WPScan vulnerability
            database.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Run scan
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!data?.vulnDbConfigured ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm">
          <p className="font-semibold text-amber-200">No WPScan API token configured</p>
          <p className="mt-1 leading-relaxed text-white/60">
            Components will be listed but not checked against the vulnerability database. Add{' '}
            <code className="text-white/75">WPSCAN_API_TOKEN</code> to enable it. The free tier is 25
            requests a day and is licensed for non-commercial use â€” a commercial install needs a paid
            plan.
          </p>
        </div>
      ) : null}

      {!scan ? (
        <div className={card}>
          <p className="text-sm text-white/50">
            No scan yet. Press <span className="text-white/80">Run scan</span> to fingerprint the site
            and check what it exposes.
          </p>
        </div>
      ) : !scan.isWordPress ? (
        <div className={card}>
          <p className="flex items-center gap-2 font-semibold">
            <ShieldQuestion className="h-4 w-4 text-white/40" />
            This site does not look like WordPress
          </p>
          <p className="mt-2 text-sm text-white/45">
            No WordPress checks were run. Scanned {scan.targetUrl} on{' '}
            {new Date(scan.createdAt).toLocaleString()}.
          </p>
        </div>
      ) : (
        <>
          <div className={card}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {Object.entries(SEVERITY_META).map(([key, meta]) => (
                <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    {meta.label}
                  </p>
                  <p className={`mt-1 font-display text-xl font-bold ${meta.text}`}>
                    {counts[key] ?? 0}
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Core version
                </p>
                <p className="mt-1 font-display text-lg font-bold">{scan.coreVersion || 'â€”'}</p>
                {scan.coreVersionSource ? (
                  <p className="mt-0.5 text-[10px] text-white/30">{scan.coreVersionSource}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Components seen
                </p>
                <p className="mt-1 font-display text-lg font-bold">
                  {scan.pluginsFound}
                  <span className="text-xs font-normal text-white/35"> plugins</span>
                </p>
                <p className="text-[10px] text-white/30">{scan.themesFound} themes</p>
              </div>
            </div>

            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-white/30">
              Scanned {scan.targetUrl} on {new Date(scan.createdAt).toLocaleString()}
              {scan.vulnDbRemaining !== null && scan.vulnDbRemaining !== undefined
                ? ` Â· ${scan.vulnDbRemaining} WPScan requests left today`
                : ''}
            </p>
          </div>

          {scan.warnings?.length ? (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4 text-sm">
              <p className="font-semibold text-sky-200">What this scan could not see</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-white/60">
                {scan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={card}>
            <h2 className="font-semibold">
              Findings
              <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
                {scan.findings.length}
              </span>
            </h2>

            {scan.findings.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Nothing reportable found on what the scan could see.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {scan.findings.map((finding, index) => {
                  const meta = SEVERITY_META[finding.severity] || SEVERITY_META.info;
                  const Icon = meta.Icon;
                  return (
                    <li key={index} className={`rounded-xl border p-4 ${meta.className}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.text}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{finding.title}</span>
                            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-white/35">
                              {KIND_LABELS[finding.kind] || finding.kind}
                            </span>
                            {!finding.confirmed ? (
                              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/45">
                                Unconfirmed
                              </span>
                            ) : null}
                            {finding.cvssScore ? (
                              <span className="text-[11px] text-white/35">
                                CVSS {finding.cvssScore}
                              </span>
                            ) : null}
                          </div>

                          {finding.componentSlug && finding.kind !== 'exposure' ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                              <Puzzle className="h-3 w-3" />
                              {finding.componentName}
                              {finding.installedVersion ? ` ${finding.installedVersion}` : ''}
                              {finding.fixedIn ? ` â†’ fixed in ${finding.fixedIn}` : ''}
                            </p>
                          ) : null}

                          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                            {finding.detail}
                          </p>

                          {finding.evidence ? (
                            <p className="mt-1 truncate font-mono text-[11px] text-white/30">
                              {finding.evidence}
                            </p>
                          ) : null}

                          {finding.cve ? (
                            <p className="mt-1 text-[11px] text-white/40">{finding.cve}</p>
                          ) : null}

                          {finding.references?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {finding.references.slice(0, 3).map((reference) => (
                                <a
                                  key={reference}
                                  href={reference}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 text-[11px] text-teal-300 hover:underline"
                                >
                                  Reference <ExternalLink className="h-3 w-3" />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {actionable === 0 && scan.findings.length > 0 ? (
              <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-white/40">
                Nothing critical or high. The rest are hardening items rather than live exposures.
              </p>
            ) : null}
          </div>

          {scan.fingerprint?.plugins?.length || scan.fingerprint?.themes?.length ? (
            <div className={card}>
              <h2 className="font-semibold">Components detected</h2>
              <p className="mt-1 text-xs text-white/35">
                Read from the asset URLs the page already loads. Plugins that only run on inner pages
                are not visible to a passive scan.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {['plugins', 'themes'].map((kind) => (
                  <div key={kind}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                      {kind}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {(scan.fingerprint[kind] || []).map((component) => (
                        <li key={component.slug} className="flex items-center gap-2 text-sm">
                          <span className="text-white/65">{component.slug}</span>
                          <span className="text-xs text-white/30">
                            {component.version ? `advertised ${component.version}` : 'no version'}
                          </span>
                        </li>
                      ))}
                      {(scan.fingerprint[kind] || []).length === 0 ? (
                        <li className="text-xs text-white/30">None seen</li>
                      ) : null}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-white/30">
        This scan is passive: it reads the pages the site already serves publicly and the standard
        WordPress files. It does not bruteforce plugin or theme names, enumerate users, or attempt
        any login. Version numbers a site advertises can be stripped or faked, so a finding marked
        Unconfirmed means the version could not be compared against the fix.
      </p>
    </div>
  );
}


