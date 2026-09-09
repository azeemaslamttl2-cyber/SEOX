import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Lightbulb, Loader2, MinusCircle } from 'lucide-react';
import { useCrawl } from '../../context/CrawlContext.jsx';
import { listAttachedLocations } from '../../lib/gbpApi.js';

export const card = 'rounded-2xl border border-white/10 bg-white/[0.02] p-5';

export const SEVERITY_META = {
  critical: { label: 'Critical', className: 'border-rose-500/30 bg-rose-500/[0.07]', text: 'text-rose-300', Icon: AlertCircle },
  high: { label: 'High', className: 'border-amber-500/30 bg-amber-500/[0.07]', text: 'text-amber-300', Icon: AlertTriangle },
  medium: { label: 'Medium', className: 'border-sky-500/25 bg-sky-500/[0.06]', text: 'text-sky-300', Icon: Info },
  low: { label: 'Low', className: 'border-white/[0.12] bg-white/[0.03]', text: 'text-white/60', Icon: MinusCircle },
  opportunity: { label: 'Opportunity', className: 'border-emerald-500/25 bg-emerald-500/[0.06]', text: 'text-emerald-300', Icon: Lightbulb },
};

export function Notice({ tone = 'info', title, children }) {
  const tones = {
    info: 'border-teal-500/25 bg-teal-500/[0.06]',
    warn: 'border-amber-500/25 bg-amber-500/[0.06]',
    error: 'border-rose-500/25 bg-rose-500/[0.06]',
    success: 'border-emerald-500/25 bg-emerald-500/[0.06]',
  };
  const titleTones = {
    info: 'text-teal-200',
    warn: 'text-amber-200',
    error: 'text-rose-200',
    success: 'text-emerald-200',
  };
  return (
    <div className={`rounded-xl border p-4 text-sm ${tones[tone]}`}>
      {title ? <p className={`font-semibold ${titleTones[tone]}`}>{title}</p> : null}
      {children ? <div className="mt-1 leading-relaxed text-white/60">{children}</div> : null}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/50">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function scoreColor(score) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-white/30">{hint}</p> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-teal-500/40 focus:outline-none';

/**
 * Shared plumbing for every GBP page: the selected project, its attached
 * locations, and the location the page is currently showing.
 */
export function useGbpLocation() {
  const { project } = useCrawl();
  const projectId = project?.id || '';
  const [locations, setLocations] = useState([]);
  const [locationRowId, setLocationRowId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      setLocations([]);
      return;
    }
    try {
      const data = await listAttachedLocations(projectId);
      const rows = data.locations || [];
      setLocations(rows);
      setLocationRowId((current) => {
        if (current && rows.some((row) => String(row.id) === String(current))) return current;
        const primary = rows.find((row) => row.isPrimary) || rows[0];
        return primary ? String(primary.id) : '';
      });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return {
    project,
    projectId,
    locations,
    locationRowId,
    setLocationRowId,
    loadingLocations: loading,
    locationError: error,
    reloadLocations: reload,
  };
}

export function LocationPicker({ locations, value, onChange }) {
  if (locations.length <= 1) return null;
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white/80"
    >
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.businessName}
        </option>
      ))}
    </select>
  );
}

export function NoProject() {
  return (
    <div className={card}>
      <Notice tone="warn" title="Select a project first">
        Business Profile data is stored per project. Pick a project from the selector above.
      </Notice>
    </div>
  );
}

export function NoLocation() {
  return (
    <div className={card}>
      <Notice tone="warn" title="No location attached">
        Connect a Business Profile and attach at least one location before using this page.
      </Notice>
    </div>
  );
}
