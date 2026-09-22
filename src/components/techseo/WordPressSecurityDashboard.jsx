import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Bug,
  Clock,
  Database,
  FileWarning,
  Globe,
  HardDriveDownload,
  Info,
  Lock,
  MinusCircle,
  Package,
  Palette,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';

/**
 * Renders the dashboard the site's own SEOX plugin returns.
 *
 * Everything here comes from wp-security-portal.js, which has already given
 * every field a safe default, so this file renders what it is handed and shows
 * an explicit placeholder where the plugin reported nothing. A missing value is
 * never drawn as a zero or as an "off" switch - both would be a lie about the
 * site's state.
 */

const card = 'rounded-2xl border border-white/10 bg-white/[0.02] p-5';

export const SEVERITY_META = {
  critical: {
    label: 'Critical',
    className: 'border-rose-500/30 bg-rose-500/[0.07]',
    text: 'text-rose-300',
    Icon: AlertCircle,
  },
  high: {
    label: 'High',
    className: 'border-amber-500/30 bg-amber-500/[0.07]',
    text: 'text-amber-300',
    Icon: AlertTriangle,
  },
  medium: {
    label: 'Medium',
    className: 'border-sky-500/25 bg-sky-500/[0.06]',
    text: 'text-sky-300',
    Icon: Info,
  },
  low: {
    label: 'Low',
    className: 'border-white/[0.12] bg-white/[0.03]',
    text: 'text-white/60',
    Icon: MinusCircle,
  },
  info: {
    label: 'Info',
    className: 'border-white/[0.10] bg-white/[0.02]',
    text: 'text-white/45',
    Icon: Info,
  },
};

const RISK_META = {
  critical: { label: 'Critical risk', text: 'text-rose-300', ring: '#f43f5e', chip: 'border-rose-500/30 bg-rose-500/[0.08] text-rose-200' },
  high: { label: 'High risk', text: 'text-rose-300', ring: '#fb7185', chip: 'border-rose-500/25 bg-rose-500/[0.06] text-rose-200' },
  medium: { label: 'Medium risk', text: 'text-amber-300', ring: '#f59e0b', chip: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-200' },
  low: { label: 'Low risk', text: 'text-emerald-300', ring: '#10b981', chip: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200' },
  minimal: { label: 'Minimal risk', text: 'text-emerald-300', ring: '#10b981', chip: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200' },
};

// A status that means "this check needs something connected first", not "this
// check failed". Drawing these as failures is the single easiest way to make a
// clean site look compromised.
const UNAVAILABLE_STATUSES = new Set([
  'portal_required',
  'integration_required',
  'unavailable',
  'not_configured',
  'unknown',
  'disabled',
  'skipped',
]);

const MALWARE_FINDINGS_PREVIEW = 20;

function riskMeta(riskLevel) {
  return RISK_META[String(riskLevel || '').toLowerCase()] || {
    label: riskLevel ? `${riskLevel} risk` : 'Risk not reported',
    text: 'text-white/60',
    ring: '#64748b',
    chip: 'border-white/[0.12] bg-white/[0.03] text-white/60',
  };
}

function titleCase(value) {
  const text = String(value || '').replace(/[_-]+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
}

function formatBytes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Small building blocks ── */

function Gauge({ score, color, size = 132 }) {
  const known = typeof score === 'number' && Number.isFinite(score);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(known ? score : 0, 0), 100) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="relative z-10 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-black text-white">{known ? score : '—'}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">/ 100</span>
      </div>
    </div>
  );
}

function Tile({ label, value, valueClass = '', hint }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-white/30">{hint}</p> : null}
    </div>
  );
}

function Field({ label, value, mono = false }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p className={`mt-1 truncate text-sm ${empty ? 'text-white/30' : 'text-white/80'} ${mono ? 'font-mono text-xs' : ''}`}>
        {empty ? 'Not reported' : value}
      </p>
    </div>
  );
}

/**
 * A yes/no check. `good` says which way is healthy, so the colour describes the
 * site's security rather than the literal boolean. An unreported check stays
 * grey and reads "Unknown".
 */
function Signal({ label, value, onLabel = 'Enabled', offLabel = 'Disabled', good = true }) {
  if (value === null || value === undefined) {
    return (
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
        <p className="mt-1 text-sm text-white/30">Unknown</p>
      </div>
    );
  }

  const healthy = value === good;
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p className={`mt-1 text-sm font-medium ${healthy ? 'text-emerald-300' : 'text-amber-300'}`}>
        {value ? onLabel : offLabel}
      </p>
    </div>
  );
}

function CategoryCard({ title, Icon, children, className = '' }) {
  return (
    <div className={`${card} ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-white/40" />
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Shown for a check the plugin could not run, e.g. portal_required. */
function AvailabilityNotice({ status, message, fallback }) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-sky-200">
        <Info className="h-4 w-4 shrink-0" />
        {titleCase(status) || 'Not available'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/55">{message || fallback}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || '').toLowerCase();
  const tone =
    value === 'active'
      ? 'bg-emerald-500/10 text-emerald-300'
      : value === 'inactive'
      ? 'bg-amber-500/10 text-amber-300'
      : 'bg-white/[0.06] text-white/45';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {titleCase(status) || 'Unknown'}
    </span>
  );
}

/* ── Sections ── */

function Overview({ portal }) {
  const risk = riskMeta(portal.riskLevel);
  const { meta, summary } = portal;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-6">
        <Gauge score={portal.securityScore} color={risk.ring} />

        <div className="min-w-[200px] flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Overall security score
          </p>
          <p className={`mt-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${risk.chip}`}>
            <ShieldCheck className="h-4 w-4" />
            {risk.label}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">Site</dt>
              <dd className="truncate text-white/70">{meta.siteName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">WordPress</dt>
              <dd className="text-white/70">{meta.wordpress || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">PHP</dt>
              <dd className="text-white/70">{meta.php || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/35">Plugin</dt>
              <dd className="text-white/70">{meta.pluginVersion || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(SEVERITY_META).map(([key, severity]) => (
          <Tile key={key} label={severity.label} value={summary[key] ?? 0} valueClass={severity.text} />
        ))}
      </div>

      {meta.generatedAt || meta.siteUrl ? (
        <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-white/30">
          {meta.siteUrl ? `${meta.siteUrl} · ` : ''}
          {meta.generatedAt ? `Reported ${formatDateTime(meta.generatedAt)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function LastScan({ lastScan }) {
  const pendingLook = lastScan.status && lastScan.status !== 'completed' && lastScan.status !== 'failed';

  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="h-4 w-4 text-white/40" />
        Last scan
        {lastScan.status ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              lastScan.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-300'
                : lastScan.status === 'failed'
                ? 'bg-rose-500/10 text-rose-300'
                : 'bg-sky-500/10 text-sky-300'
            }`}
          >
            {titleCase(lastScan.status)}
          </span>
        ) : null}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Scan ID" value={lastScan.scanId} mono />
        <Field label="Type" value={titleCase(lastScan.scanType)} />
        <Field label="Started" value={lastScan.startedAt ? formatDateTime(lastScan.startedAt) : ''} />
        <Field label="Completed" value={lastScan.completedAt ? formatDateTime(lastScan.completedAt) : ''} />
        <Field label="Duration" value={lastScan.duration} />
        <Field label="Scanner" value={lastScan.scannerVersion} />
      </div>

      {pendingLook ? (
        <p className="mt-3 text-xs text-sky-200/80">
          The site reported this scan as {lastScan.status}. Results will fill in once it finishes.
        </p>
      ) : null}
    </div>
  );
}

function TopIssues({ issues }) {
  return (
    <div className={card}>
      <h2 className="font-semibold">
        Top security issues
        <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
          {issues.length}
        </span>
      </h2>

      {issues.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          The site reported no priority issues.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {issues.map((issue) => {
            const severity = SEVERITY_META[issue.severity] || SEVERITY_META.info;
            const Icon = severity.Icon;
            return (
              <li key={issue.id} className={`rounded-xl border p-4 ${severity.className}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${severity.text}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{issue.title}</span>
                      <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                        {severity.label}
                      </span>
                      {issue.category ? (
                        <span className="text-[11px] text-white/35">{titleCase(issue.category)}</span>
                      ) : null}
                    </div>

                    {issue.description ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-white/55">{issue.description}</p>
                    ) : null}

                    {issue.evidence ? (
                      <p className="mt-1 truncate font-mono text-[11px] text-white/30">{issue.evidence}</p>
                    ) : null}

                    {issue.remediation ? (
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-white/70">
                        <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                        {issue.remediation}
                      </p>
                    ) : null}

                    {issue.discoveredAt ? (
                      <p className="mt-2 text-[11px] text-white/30">
                        Discovered {formatDateTime(issue.discoveredAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Malware({ malware }) {
  const [showAll, setShowAll] = useState(false);
  const unavailable = UNAVAILABLE_STATUSES.has(malware.status);
  const findings = showAll ? malware.findings : malware.findings.slice(0, MALWARE_FINDINGS_PREVIEW);
  const modified = malware.coreChecksum.modifiedFiles;

  return (
    <CategoryCard title="Malware" Icon={Bug}>
      {unavailable ? (
        <AvailabilityNotice
          status={malware.status}
          message={malware.message}
          fallback="Deep malware scanning is not available for this site yet."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Status" value={titleCase(malware.status)} valueClass="text-sm" hint={malware.scanner} />
            <Tile label="Files scanned" value={formatNumber(malware.scannedFiles)} />
            <Tile
              label="Findings"
              value={formatNumber(malware.findings.length)}
              valueClass={malware.findings.length ? 'text-amber-300' : 'text-emerald-300'}
            />
            <Tile
              label="Core files changed"
              value={
                malware.coreChecksum.status ? formatNumber(modified.length) : '—'
              }
              valueClass={modified.length ? 'text-rose-300' : 'text-emerald-300'}
              hint={malware.coreChecksum.status ? `Checksum ${malware.coreChecksum.status}` : ''}
            />
          </div>

          {malware.message ? (
            <p className="mt-3 text-xs leading-relaxed text-white/50">{malware.message}</p>
          ) : null}

          {malware.findings.length ? (
            <>
              <ul className="mt-4 space-y-2">
                {findings.map((finding) => {
                  const severity = SEVERITY_META[finding.severity] || SEVERITY_META.info;
                  return (
                    <li key={finding.id} className={`rounded-xl border p-3 ${severity.className}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <FileWarning className={`h-3.5 w-3.5 shrink-0 ${severity.text}`} />
                        <span className="text-xs font-semibold">{finding.title}</span>
                        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                          {severity.label}
                        </span>
                      </div>
                      {finding.path ? (
                        <p className="mt-1 break-all font-mono text-[11px] text-white/35">{finding.path}</p>
                      ) : null}
                      {finding.description ? (
                        <p className="mt-1 text-xs text-white/55">{finding.description}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-white/30">
                        {[
                          finding.modified ? `Modified ${formatDateTime(finding.modified)}` : '',
                          formatBytes(finding.size),
                          finding.signals.length ? finding.signals.join(', ') : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </li>
                  );
                })}
              </ul>

              {malware.findings.length > MALWARE_FINDINGS_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAll((open) => !open)}
                  className="mt-3 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:text-white"
                >
                  {showAll
                    ? 'Show fewer'
                    : `Show all ${malware.findings.length} flagged files`}
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              No suspicious files were flagged.
            </p>
          )}
        </>
      )}
    </CategoryCard>
  );
}

function Plugins({ plugins }) {
  const inactive = plugins.items.filter((plugin) => plugin.status !== 'active');

  return (
    <CategoryCard title="Plugins" Icon={Package}>
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Installed" value={formatNumber(plugins.installed)} />
        <Tile label="Active" value={formatNumber(plugins.active)} valueClass="text-emerald-300" />
        <Tile
          label="Inactive"
          value={formatNumber(plugins.inactive)}
          valueClass={plugins.inactive ? 'text-amber-300' : ''}
        />
      </div>

      {plugins.items.length ? (
        <>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {plugins.items.map((plugin) => (
              <li key={plugin.file || plugin.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="text-sm text-white/80">{plugin.name}</span>
                {plugin.version ? <span className="text-xs text-white/40">{plugin.version}</span> : null}
                <StatusBadge status={plugin.status} />
                {plugin.updateAvailable ? (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                    Update {plugin.updateVersion || 'available'}
                  </span>
                ) : null}
                <span className="ml-auto min-w-0 text-right">
                  {plugin.author ? <span className="text-xs text-white/35">{plugin.author}</span> : null}
                  {plugin.file ? (
                    <span className="block truncate font-mono text-[10px] text-white/25">{plugin.file}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {inactive.length ? (
            <p className="mt-3 text-xs leading-relaxed text-amber-200/70">
              {inactive.length} installed {inactive.length === 1 ? 'plugin is' : 'plugins are'} inactive.
              Inactive plugins still ship code to the server, so remove what the site does not use.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-white/30">The site did not return a plugin list.</p>
      )}
    </CategoryCard>
  );
}

function Themes({ themes }) {
  return (
    <CategoryCard title="Themes" Icon={Palette}>
      {themes.active ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Active theme" value={themes.active.name} />
          <Field label="Version" value={themes.active.version} />
          <Field label="Author" value={themes.active.author} />
          <Field label="Installed" value={formatNumber(themes.installed)} />
        </div>
      ) : (
        <p className="text-sm text-white/30">The site did not report an active theme.</p>
      )}

      {themes.items.length > 1 ? (
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {themes.items.map((theme) => (
            <li key={theme.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="text-sm text-white/80">{theme.name}</span>
              {theme.version ? <span className="text-xs text-white/40">{theme.version}</span> : null}
              <StatusBadge status={theme.status} />
              {theme.author ? <span className="ml-auto text-xs text-white/35">{theme.author}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </CategoryCard>
  );
}

function UsersCard({ users }) {
  return (
    <CategoryCard title="Users" Icon={Users}>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Total users" value={formatNumber(users.totalUsers)} />
        <Tile label="Administrators" value={formatNumber(users.admins)} />
      </div>

      {users.roles.length ? (
        <ul className="mt-3 space-y-1">
          {users.roles.map((role) => (
            <li key={role.role} className="flex items-center justify-between text-sm">
              <span className="text-white/55">{titleCase(role.role) || 'No role'}</span>
              <span className="text-white/80">{formatNumber(role.count)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <Signal
          label="Default admin username"
          value={users.defaultAdmin}
          onLabel="Present"
          offLabel="Not present"
          good={false}
        />
      </div>
    </CategoryCard>
  );
}

function Core({ core }) {
  return (
    <CategoryCard title="Core" Icon={ShieldCheck}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="WordPress version" value={core.wordpressVersion} />
        <Signal label="Debug mode" value={core.debug} good={false} />
        <Signal label="XML-RPC" value={core.xmlrpc} good={false} />
        <Signal label="Automatic updates" value={core.autoUpdates} good />
      </div>
    </CategoryCard>
  );
}

function ServerCard({ server }) {
  return (
    <CategoryCard title="Server" Icon={Server}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="PHP version" value={server.php} />
        <Field label="WordPress" value={server.wordpress} />
        <Signal label="HTTPS" value={server.https} onLabel="Serving" offLabel="Not serving" good />
      </div>

      {server.headersExpected.length ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Expected security headers
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {server.headersExpected.map((header) => (
              <span
                key={header}
                className="rounded-full border border-white/[0.10] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-white/50"
              >
                {header}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </CategoryCard>
  );
}

function Ssl({ ssl }) {
  return (
    <CategoryCard title="SSL" Icon={Lock}>
      <div className="grid gap-4">
        <Signal label="HTTPS detected" value={ssl.httpsDetected} onLabel="Yes" offLabel="No" good />
        <Field label="Home URL" value={ssl.homeUrl} mono />
      </div>
    </CategoryCard>
  );
}

function DatabaseCard({ database }) {
  return (
    <CategoryCard title="Database" Icon={Database}>
      <div className="grid gap-4">
        <Field label="Server" value={database.server} />
        <Field label="Table prefix" value={database.prefix} mono />
      </div>
      {database.prefix && database.prefix.toLowerCase() === 'wp_' ? (
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          The default prefix is in use. Changing it is optional hardening, not a fix on its own.
        </p>
      ) : null}
    </CategoryCard>
  );
}

function Backups({ backups }) {
  const unavailable = UNAVAILABLE_STATUSES.has(backups.status);
  return (
    <CategoryCard title="Backups" Icon={HardDriveDownload}>
      {unavailable ? (
        <AvailabilityNotice
          status={backups.status}
          message={backups.message}
          fallback="Connect a backup provider to report backup status here."
        />
      ) : (
        <div className="grid gap-4">
          <Field label="Status" value={titleCase(backups.status)} />
          {backups.message ? <p className="text-xs leading-relaxed text-white/50">{backups.message}</p> : null}
        </div>
      )}
    </CategoryCard>
  );
}

function Monitoring({ monitoring }) {
  return (
    <CategoryCard title="Monitoring" Icon={Globe}>
      <div className="grid grid-cols-2 gap-4">
        <Signal label="Debug log" value={monitoring.debugLog} onLabel="Writing" offLabel="Off" good={false} />
        <Signal label="WP-Cron" value={monitoring.cron} onLabel="Running" offLabel="Not running" good />
      </div>
    </CategoryCard>
  );
}

export default function WordPressSecurityDashboard({ portal }) {
  if (!portal) return null;
  const { categories } = portal;

  return (
    <div className="space-y-5">
      <Overview portal={portal} />
      <LastScan lastScan={portal.lastScan} />
      <TopIssues issues={portal.topIssues} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Core core={categories.core} />
        <UsersCard users={categories.users} />
        <ServerCard server={categories.server} />
        <Ssl ssl={categories.ssl} />
        <DatabaseCard database={categories.database} />
        <Monitoring monitoring={categories.monitoring} />
        <Backups backups={categories.backups} />
        <Themes themes={categories.themes} />
      </div>

      <Plugins plugins={categories.plugins} />
      <Malware malware={categories.malware} />
    </div>
  );
}
