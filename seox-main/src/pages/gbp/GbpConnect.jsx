import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Check,
  ExternalLink,
  Loader2,
  MapPin,
  Plug,
  RefreshCw,
  Star,
  Trash2,
  Unplug,
} from 'lucide-react';
import { useCrawl } from '../../context/CrawlContext.jsx';
import {
  attachLocations,
  detachLocation,
  disconnectGbp,
  getConnectionStatus,
  getGbpAuthUrl,
  listAttachedLocations,
  listGbpAccounts,
  listGoogleLocations,
  resyncLocations,
  selectGbpAccount,
  setPrimaryLocation,
} from '../../lib/gbpApi.js';

const card = 'rounded-2xl border border-white/10 bg-white/[0.02] p-5';

function VerificationBadge({ status }) {
  const map = {
    VERIFIED: { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-300', Icon: BadgeCheck },
    UNVERIFIED: { label: 'Unverified', className: 'bg-rose-500/15 text-rose-300', Icon: AlertTriangle },
    UNKNOWN: { label: 'Unknown', className: 'bg-white/[0.06] text-white/50', Icon: AlertCircle },
  };
  const { label, className, Icon } = map[status] || map.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Notice({ tone = 'info', title, children }) {
  const tones = {
    info: 'border-teal-500/25 bg-teal-500/[0.06] text-teal-200',
    warn: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-200',
    error: 'border-rose-500/25 bg-rose-500/[0.06] text-rose-200',
  };
  return (
    <div className={`rounded-xl border p-4 text-sm ${tones[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className="mt-1 leading-relaxed text-white/60">{children}</div>
    </div>
  );
}

export default function GbpConnect() {
  const { project } = useCrawl();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const projectId = project?.id || '';

  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [attached, setAttached] = useState([]);
  const [available, setAvailable] = useState(null);
  const [selection, setSelection] = useState(() => new Set());

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const noAccounts = params.get('noAccounts') === '1';

  const loadStatus = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const next = await getConnectionStatus(projectId);
      setStatus(next);
      if (next.connected) {
        const [accountData, attachedData] = await Promise.all([
          listGbpAccounts(projectId).catch((err) => ({ accounts: [], error: err.message })),
          listAttachedLocations(projectId).catch(() => ({ locations: [] })),
        ]);
        setAccounts(accountData.accounts || []);
        setAttached(attachedData.locations || []);
      } else {
        setAccounts([]);
        setAttached([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    setAvailable(null);
    loadStatus();
  }, [loadStatus]);

  const run = useCallback(
    async (key, task) => {
      setBusy(key);
      setError('');
      try {
        await task();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy('');
      }
    },
    []
  );

  const handleConnect = () =>
    run('connect', async () => {
      const authUrl = await getGbpAuthUrl(projectId, '/local-seo/gbp');
      window.location.assign(authUrl);
    });

  const handleDisconnect = () =>
    run('disconnect', async () => {
      await disconnectGbp(projectId);
      setParams({});
      setAvailable(null);
      await loadStatus();
    });

  const handleSelectAccount = (account) =>
    run(`account:${account.accountId}`, async () => {
      await selectGbpAccount(projectId, account);
      setAvailable(null);
      await loadStatus();
    });

  const handleLoadLocations = () =>
    run('locations', async () => {
      const data = await listGoogleLocations(projectId);
      setAvailable(data.locations || []);
      setSelection(new Set());
    });

  const handleAttach = () =>
    run('attach', async () => {
      const result = await attachLocations(projectId, [...selection]);
      setSelection(new Set());
      setAvailable(null);
      await loadStatus();
      if (result.missing?.length) {
        setError(`Google no longer lists: ${result.missing.join(', ')}`);
      }
    });

  const handleResync = () =>
    run('resync', async () => {
      const result = await resyncLocations(projectId);
      await loadStatus();
      if (result.lost?.length) {
        setError(
          `These locations are attached in SEOX but no longer visible in the Google account: ${result.lost.join(', ')}`
        );
      }
    });

  const toggleSelection = (locationId) => {
    setSelection((previous) => {
      const next = new Set(previous);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.accountId === status?.accountId) || null,
    [accounts, status]
  );

  if (!projectId) {
    return (
      <div className={card}>
        <Notice tone="warn" title="Select a project first">
          Business Profile connections are stored per project. Pick a project from the selector above,
          then connect the listing that belongs to it.
        </Notice>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Business Profile connection…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Google Business Profile</h1>
          <p className="mt-1 text-sm text-white/45">
            Connect the listing for <span className="text-white/70">{project?.name || project?.domain}</span> and
            attach the locations SEOX should manage.
          </p>
        </div>
        {status?.connected ? (
          <button
            onClick={handleDisconnect}
            disabled={busy === 'disconnect'}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {busy === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
            Disconnect
          </button>
        ) : null}
      </div>

      {error ? <Notice tone="error" title="Something went wrong">{error}</Notice> : null}

      {status?.status === 'needs_reauth' ? (
        <Notice tone="warn" title="Authorisation expired">
          {status.statusDetail || 'Google revoked the stored access.'} Reconnect to resume syncing.
        </Notice>
      ) : null}

      {/* Step 1 — connect */}
      {!status?.connected ? (
        <div className={card}>
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-teal-500/10 p-3">
              <Plug className="h-5 w-5 text-teal-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Connect a Google account</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Sign in with the Google account that owns or manages the listing. API approval lets SEOX
                ask Google for the data — it does not grant access to a profile the signed-in account
                cannot already manage in Business Profile Manager.
              </p>
              <button
                onClick={handleConnect}
                disabled={busy === 'connect'}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Connect Google Business Profile
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 2 — pick the account */}
      {status?.connected ? (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Building2 className="h-4 w-4 text-teal-400" />
              Business Profile account
            </h2>
            <span className="text-xs text-white/40">Signed in as {status.googleEmail || 'unknown'}</span>
          </div>

          {noAccounts || accounts.length === 0 ? (
            <div className="mt-4">
              <Notice tone="warn" title="This Google account manages no Business Profiles">
                Ask the client to add <span className="text-white/80">{status.googleEmail}</span> as a
                manager on the listing, then reload this page.{' '}
                <a
                  href="https://business.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-300 hover:underline"
                >
                  Business Profile Manager <ExternalLink className="h-3 w-3" />
                </a>
              </Notice>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {accounts.map((account) => {
                const isSelected = account.accountId === status.accountId;
                return (
                  <li key={account.accountId}>
                    <button
                      onClick={() => handleSelectAccount(account)}
                      disabled={busy === `account:${account.accountId}`}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-teal-500/40 bg-teal-500/[0.08]'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{account.accountName}</p>
                        <p className="truncate text-xs text-white/40">
                          {account.accountId}
                          {account.accountType ? ` · ${account.accountType}` : ''}
                          {account.role ? ` · ${account.role}` : ''}
                        </p>
                      </div>
                      {busy === `account:${account.accountId}` ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/40" />
                      ) : isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-teal-400" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* Step 3 — attach locations */}
      {status?.connected && status.accountId ? (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-teal-400" />
              Attached locations
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
                {attached.length}
              </span>
            </h2>
            <div className="flex gap-2">
              {attached.length > 0 ? (
                <button
                  onClick={handleResync}
                  disabled={busy === 'resync'}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {busy === 'resync' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Resync from Google
                </button>
              ) : null}
              <button
                onClick={handleLoadLocations}
                disabled={busy === 'locations'}
                className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                {busy === 'locations' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Building2 className="h-3.5 w-3.5" />
                )}
                Browse Google locations
              </button>
            </div>
          </div>

          {attached.length === 0 && !available ? (
            <p className="mt-4 text-sm text-white/40">
              No locations attached yet. Browse the account to pick the listings this project should manage.
            </p>
          ) : null}

          {attached.length > 0 ? (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {attached.map((location) => (
                <li key={location.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{location.businessName}</p>
                      <VerificationBadge status={location.verificationStatus} />
                      {location.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-300">
                          <Star className="h-3 w-3" /> Primary
                        </span>
                      ) : null}
                      {location.hasGoogleUpdates ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                          Google update pending
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-white/40">
                      {[location.primaryCategory, location.address].filter(Boolean).join(' · ') ||
                        location.locationId}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/local-seo/gbp/overview?location=${location.id}`)}
                      className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.1]"
                    >
                      Open dashboard
                    </button>
                    {!location.isPrimary ? (
                      <button
                        title="Make primary"
                        onClick={() =>
                          run(`primary:${location.id}`, async () => {
                            await setPrimaryLocation(projectId, location.id);
                            await loadStatus();
                          })
                        }
                        className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-brand-300"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      title="Detach"
                      onClick={() =>
                        run(`detach:${location.id}`, async () => {
                          await detachLocation(projectId, location.id);
                          await loadStatus();
                        })
                      }
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {available ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {available.length} location{available.length === 1 ? '' : 's'} in{' '}
                  {selectedAccount?.accountName || 'this account'}
                </p>
                <button
                  onClick={handleAttach}
                  disabled={selection.size === 0 || busy === 'attach'}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
                >
                  {busy === 'attach' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Attach {selection.size || ''} selected
                </button>
              </div>

              <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto no-scrollbar">
                {available.map((location) => (
                  <li key={location.locationId}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                        location.attached
                          ? 'border-white/[0.06] bg-white/[0.01] opacity-50'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={location.attached}
                        checked={selection.has(location.locationId)}
                        onChange={() => toggleSelection(location.locationId)}
                        className="h-4 w-4 accent-brand-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm">{location.businessName}</span>
                          <VerificationBadge status={location.verificationStatus} />
                          {location.attached ? (
                            <span className="text-[11px] text-white/35">already attached</span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-white/35">
                          {[location.storeCode, location.primaryCategory, location.address]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {status?.lastSync ? (
        <p className="text-xs text-white/30">
          Last sync: {status.lastSync.type} · {status.lastSync.status} ·{' '}
          {new Date(status.lastSync.at).toLocaleString()}
          {status.lastSync.message ? ` · ${status.lastSync.message}` : ''}
        </p>
      ) : null}
    </div>
  );
}
