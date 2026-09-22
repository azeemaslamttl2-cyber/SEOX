import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Puzzle,
  Radar,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
} from 'lucide-react';
import { useSelectedProjectDomain } from '../../hooks/useSelectedProjectDomain.js';
import { getSessionToken } from '../../lib/authSession.js';
import WordPressSecurityDashboard, {
  SEVERITY_META,
} from '../../components/techseo/WordPressSecurityDashboard.jsx';

const card = 'rounded-2xl border border-white/10 bg-white/[0.02] p-5';

const KIND_LABELS = { core: 'WordPress core', plugin: 'Plugin', theme: 'Theme', exposure: 'Exposure' };

// The plugin answers synchronously today. These only matter for a build that
// queues the scan and reports it as running.
const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 5000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Development tracing for the scan: which project, which website URL, which
 * endpoint, what came back. Silent in a production build, and the admin token
 * is never part of it - the browser never holds one.
 */
function devLog(message, detail) {
  if (import.meta.env?.DEV) console.debug(`[WordPress security] ${message}`, detail);
}

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
  // The site picker at the top of the app is the only place a website URL is
  // chosen; this page reads it from there and never asks for it again.
  const { project, projectUrl } = useSelectedProjectDomain();
  const projectId = project?.id || '';

  const [data, setData] = useState(null);
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [portalScanning, setPortalScanning] = useState(false);
  const [portalNotice, setPortalNotice] = useState('');
  const [error, setError] = useState('');

  // A scan can outlive the page: the plugin walks every file on the site and a
  // large install takes a while. Nothing is written to state after unmount.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Token panel. `tokenInput` is only ever the value being typed - a saved
  // token is never sent back from the server, so there is nothing to prefill.
  const [tokenInput, setTokenInput] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenNotice, setTokenNotice] = useState('');
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const result = await api('/api/tech-seo/wordpress-security', { params: { projectId } });
      setData(result);
      setPortal(result?.portal || null);
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

  /**
   * Ask the SEOX plugin on the site to audit itself. The credentials never
   * touch this component: the server resolves them from the signed-in account
   * and the selected project.
   */
  const handlePortalScan = async () => {
    setPortalScanning(true);
    setError('');
    setPortalNotice('');
    setTokenNotice('');

    devLog('Run scan requested', {
      project: project?.name || project?.domain || projectId,
      projectId,
      websiteUrl: projectUrl || '(none in the selected project)',
    });

    try {
      const request = () =>
        api('/api/tech-seo/wordpress-security', {
          method: 'POST',
          // The URL comes from the selected project. The server checks it is
          // that project's own host before it scans anything.
          body: { action: 'portal-scan', projectId, siteUrl: projectUrl, scanType: 'full' },
        });

      let result = await request();
      if (mounted.current) setPortal(result.portal);
      devLog('Scan response', {
        endpoint: result.portal?.endpoint,
        status: result.portal?.lastScan?.status,
        securityScore: result.portal?.securityScore,
      });

      // Only a plugin build that queues the scan ever reports it as running;
      // the current one returns finished results in the first response.
      for (let attempt = 0; attempt < POLL_ATTEMPTS && result.portal?.pending; attempt += 1) {
        await wait(POLL_DELAY_MS);
        if (!mounted.current) return;
        result = await request();
        if (mounted.current) setPortal(result.portal);
      }

      if (!mounted.current) return;

      const score = result.portal?.securityScore;
      setPortalNotice(
        result.portal?.pending
          ? 'The site is still running the scan. Results will update on the next run.'
          : `Scan complete${typeof score === 'number' ? ` — security score ${score}/100.` : '.'}`
      );
    } catch (err) {
      devLog('Scan failed', { status: err.status, message: err.message });
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setPortalScanning(false);
    }
  };

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

  const saveToken = async () => {
    setTokenBusy(true);
    setError('');
    setTokenNotice('');
    try {
      const result = await api('/api/tech-seo/wordpress-security', {
        method: 'POST',
        body: { action: 'save-token', projectId, token: tokenInput.trim() },
      });
      setData((current) => ({ ...current, ...result }));
      setTokenInput('');
      setTokenPanelOpen(false);
      setTokenNotice('Token saved for this project.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTokenBusy(false);
    }
  };

  const clearToken = async () => {
    setTokenBusy(true);
    setError('');
    setTokenNotice('');
    try {
      const result = await api('/api/tech-seo/wordpress-security', {
        method: 'POST',
        body: { action: 'clear-token', projectId },
      });
      setData((current) => ({ ...current, ...result }));
      setTokenInput('');
      setTokenNotice('Token removed from this project.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTokenBusy(false);
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
        Loading last scan…
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
            Security audit of {project?.domain || project?.name}, run by the SEOX plugin on the site
            itself.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleScan}
            disabled={scanning || portalScanning}
            title="Check the public site against the WPScan vulnerability database"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:text-white disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            Passive scan
          </button>
          <button
            onClick={handlePortalScan}
            disabled={portalScanning || scanning}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {portalScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {portalScanning ? 'Scanning…' : 'Run scan'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {portalNotice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          {portalNotice}
        </div>
      ) : null}

      {/* The scan runs inside WordPress and can take a minute on a large site,
          so the page says what is happening rather than looking frozen. */}
      {portalScanning ? (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4 text-sm text-sky-200">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Running the security scan on {project?.domain || project?.name}. Checking core, plugins,
          themes, users, malware, database, server, SSL, backups and monitoring…
        </div>
      ) : null}

      {portal ? (
        <WordPressSecurityDashboard portal={portal} />
      ) : (
        <div className={card}>
          <p className="text-sm text-white/50">
            No security scan yet. Press <span className="text-white/80">Run scan</span> to have the
            SEOX plugin on {project?.domain || project?.name} audit the site and report back.
          </p>
        </div>
      )}

      <div className="border-t border-white/[0.08] pt-5">
        <h2 className="font-display text-sm font-bold text-white/70">Passive WPScan check</h2>
        <p className="mt-1 text-xs text-white/35">
          A second, outside-in view: what the site exposes publicly, matched against the WPScan
          vulnerability database. It needs no plugin on the site.
        </p>
      </div>

      {tokenNotice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          {tokenNotice}
        </div>
      ) : null}

      {/* Vulnerability database token.
          Amber while nothing is configured, because the scan then runs with
          no CVE matching at all; neutral once a token is in place. */}
      <div
        className={
          data?.vulnDbConfigured
            ? 'rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm'
            : 'rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm'
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={
                data?.vulnDbConfigured
                  ? 'flex items-center gap-2 font-semibold text-white/80'
                  : 'flex items-center gap-2 font-semibold text-amber-200'
              }
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              {data?.vulnDbConfigured
                ? 'WPScan vulnerability database connected'
                : 'No WPScan API token configured'}
            </p>

            {data?.tokenError ? (
              <p className="mt-1 leading-relaxed text-rose-300">{data.tokenError}</p>
            ) : data?.vulnDbConfigured ? (
              <p className="mt-1 leading-relaxed text-white/55">
                {data.tokenSource === 'project' ? (
                  <>
                    Using this project&apos;s own token
                    {data.tokenPreview ? (
                      <>
                        {' '}
                        (<code className="text-white/75">{data.tokenPreview}</code>)
                      </>
                    ) : null}
                    , so scans here spend its quota and not the install-wide one.
                  </>
                ) : (
                  <>
                    Using the install-wide <code className="text-white/75">WPSCAN_API_TOKEN</code>{' '}
                    and its shared daily quota. Add a token below to give this project its own.
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 leading-relaxed text-white/60">
                Components will be listed but not checked against the vulnerability database. Add a
                token for this project below, or set{' '}
                <code className="text-white/75">WPSCAN_API_TOKEN</code> for the whole install. The
                free tier is 25 requests a day and is licensed for non-commercial use — a commercial
                install needs a paid plan.
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTokenPanelOpen((open) => !open);
                setTokenNotice('');
              }}
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white"
            >
              {data?.tokenSource === 'project' ? 'Replace token' : 'Add token'}
            </button>
            {data?.tokenSource === 'project' ? (
              <button
                type="button"
                onClick={clearToken}
                disabled={tokenBusy}
                title="Remove this project's token"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-500/40 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
          </div>
        </div>

        {tokenPanelOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tokenInput.trim()) saveToken();
            }}
            className="mt-4 border-t border-white/[0.08] pt-4"
          >
            <label htmlFor="wpscan-token" className="text-xs font-semibold text-white/60">
              WPScan API token for {project?.domain || project?.name}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="wpscan-token"
                type="password"
                autoComplete="off"
                spellCheck="false"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste the token from your WPScan profile"
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-brand-500/50"
              />
              <button
                type="submit"
                disabled={tokenBusy || !tokenInput.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {tokenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/35">
              Stored against this project only and never shown again after saving
              {data?.tokenEncrypted ? ', encrypted at rest with AES-256-GCM' : ''}. Get one from
              your profile at{' '}
              <a
                href="https://wpscan.com/api"
                target="_blank"
                rel="noreferrer noopener"
                className="text-white/55 underline decoration-white/20 hover:text-white/80"
              >
                wpscan.com/api
              </a>
              .
            </p>
          </form>
        ) : null}
      </div>

      {!scan ? (
        <div className={card}>
          <p className="text-sm text-white/50">
            No passive scan yet. Press <span className="text-white/80">Passive scan</span> to
            fingerprint the site and check what it exposes.
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
                <p className="mt-1 font-display text-lg font-bold">{scan.coreVersion || '—'}</p>
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
                ? ` · ${scan.vulnDbRemaining} WPScan requests left today`
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
                              {finding.fixedIn ? ` → fixed in ${finding.fixedIn}` : ''}
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
        The WPScan check above is passive: it reads the pages the site already serves publicly and
        the standard WordPress files. It does not bruteforce plugin or theme names, enumerate users, or attempt
        any login. Version numbers a site advertises can be stripped or faked, so a finding marked
        Unconfirmed means the version could not be compared against the fix.
      </p>
    </div>
  );
}


