import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Eye,
  Globe2,
  Hash,
  MousePointerClick,
  Percent,
  RefreshCw,
  Search,
} from "lucide-react";
import { useGscInsights } from "../../context/GscInsightsContext.jsx";

function formatNum(n) {
  const value = Number(n) || 0;
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export default function GscDashboard() {
  const {
    datePreset,
    datePresets,
    device,
    deviceOptions,
    error,
    fetchSiteSummaries,
    handleSignIn,
    isCheckingConnection,
    isLoadingSites,
    isLoadingSummaries,
    isSignedIn,
    normalizedSites,
    searchType,
    searchTypeOptions,
    setDatePreset,
    setDevice,
    setSearchType,
    siteSummaries,
  } = useGscInsights();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const summariesByUrl = new Map(siteSummaries.map((site) => [site.siteUrl, site]));
    return normalizedSites
      .map((site) => {
        const summary = summariesByUrl.get(site.siteUrl);
        return (
          summary || {
            ...site,
            totalClicks: 0,
            totalImpressions: 0,
            avgCtr: 0,
            avgPosition: 0,
            dailyData: [],
            changes: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
          }
        );
      })
      .filter(
        (site) =>
          site.name.toLowerCase().includes(query.toLowerCase()) ||
          site.domain.toLowerCase().includes(query.toLowerCase()) ||
          site.siteUrl.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => b.totalClicks - a.totalClicks);
  }, [normalizedSites, query, siteSummaries]);

  const totals = useMemo(() => {
    const totalClicks = rows.reduce((sum, site) => sum + site.totalClicks, 0);
    const totalImpressions = rows.reduce((sum, site) => sum + site.totalImpressions, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPosition =
      totalImpressions > 0
        ? rows.reduce(
            (sum, site) => sum + site.avgPosition * site.totalImpressions,
            0
          ) / totalImpressions
        : 0;

    return {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
    };
  }, [rows]);

  if (isCheckingConnection) {
    return <FullPageState title="Checking Search Console" body="Restoring your connection." />;
  }

  if (!isSignedIn) {
    return (
      <FullPageState
        title="Connect Google Search Console"
        body="Sign in with Google to load your verified properties and live performance data."
        actionLabel="Connect GSC"
        onAction={handleSignIn}
        error={error}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            GSC Insights
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live Google Search Console performance across connected properties.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label={searchType}
            options={searchTypeOptions}
            value={searchType}
            onChange={setSearchType}
          />
          <FilterDropdown
            label={device === "All" ? "Device" : device}
            options={deviceOptions}
            value={device}
            onChange={setDevice}
          />
          <FilterDropdown
            label={datePresets.find((preset) => preset.id === datePreset)?.label || "Date"}
            options={datePresets}
            value={datePreset}
            onChange={setDatePreset}
            optionLabel={(option) => option.label}
            optionValue={(option) => option.id}
          />
          <button
            onClick={fetchSiteSummaries}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Clicks"
          value={formatNum(totals.totalClicks)}
          icon={MousePointerClick}
          accent="clicks"
        />
        <StatCard
          label="Total Impressions"
          value={formatNum(totals.totalImpressions)}
          icon={Eye}
          accent="impressions"
        />
        <StatCard
          label="Average CTR"
          value={`${totals.avgCtr.toFixed(2)}%`}
          icon={Percent}
        />
        <StatCard
          label="Average Position"
          value={totals.avgPosition ? totals.avgPosition.toFixed(1) : "0"}
          icon={Hash}
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <Search className="h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search connected properties..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <span className="text-xs text-white/40">{rows.length} properties</span>
      </div>

      <div className="mt-4 space-y-3">
        {(isLoadingSites || isLoadingSummaries) && rows.length === 0 && (
          <FullPageState title="Loading GSC data" body="Fetching live properties and performance rows." compact />
        )}

        {!isLoadingSites && normalizedSites.length === 0 && (
          <FullPageState
            title="No verified properties found"
            body="This Google account did not return any Search Console properties."
            actionLabel="Reconnect GSC"
            onAction={handleSignIn}
            error={error}
            compact
          />
        )}

        {rows.map((site) => (
          <SiteRow key={site.id} site={site} />
        ))}

        {normalizedSites.length > 0 && rows.length === 0 && !isLoadingSummaries && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <Globe2 className="mx-auto h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm text-white/40">No properties match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SiteRow({ site }) {
  const [showClicks, setShowClicks] = useState(true);
  const [showImpressions, setShowImpressions] = useState(true);

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-white/15">
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
        <Link to={`/gsc/${site.id}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white/10 to-white/5 text-white/40">
            <Globe2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-base font-bold text-white">
                {site.name}
              </h3>
              {site.verified && (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                  Verified
                </span>
              )}
            </div>
            <p className="truncate text-xs text-white/45">{site.siteUrl}</p>
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-white/5 px-5 py-3">
        <MetricToggle
          checked={showClicks}
          onChange={setShowClicks}
          color="bg-blue-500"
          label="Total clicks"
          value={formatNum(site.totalClicks)}
        />
        <MetricToggle
          checked={showImpressions}
          onChange={setShowImpressions}
          color="bg-violet-500"
          label="Total impressions"
          value={formatNum(site.totalImpressions)}
        />
        <MetricValue label="Average CTR" value={`${Number(site.avgCtr || 0).toFixed(2)}%`} />
        <MetricValue
          label="Average position"
          value={site.avgPosition ? site.avgPosition.toFixed(1) : "0"}
        />
      </div>

      <Link to={`/gsc/${site.id}`} className="block px-3 pb-4 pt-2">
        <DualAxisChart
          data={site.dailyData}
          showClicks={showClicks}
          showImpressions={showImpressions}
        />
      </Link>
    </div>
  );
}

function DualAxisChart({ data, showClicks, showImpressions }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl border border-white/5 bg-white/[0.015] text-xs text-white/35">
        No performance rows for this period.
      </div>
    );
  }

  const slice = data.slice(-180);
  const width = 900;
  const height = 170;
  const padL = 44;
  const padR = 52;
  const padT = 8;
  const padB = 22;
  const chartWidth = width - padL - padR;
  const chartHeight = height - padT - padB;
  const denominator = Math.max(1, slice.length - 1);

  const maxClicks = Math.max(...slice.map((row) => row.clicks), 1);
  const maxImpressions = Math.max(...slice.map((row) => row.impressions), 1);

  const clickY = (value) => padT + chartHeight - (value / maxClicks) * chartHeight;
  const impressionY = (value) =>
    padT + chartHeight - (value / maxImpressions) * chartHeight;
  const xPos = (index) => padL + (index / denominator) * chartWidth;

  const clickPoints = slice
    .map((row, index) => `${xPos(index)},${clickY(row.clicks)}`)
    .join(" ");
  const impressionPoints = slice
    .map((row, index) => `${xPos(index)},${impressionY(row.impressions)}`)
    .join(" ");
  const labelStep = Math.max(1, Math.floor(slice.length / 6));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full min-w-[700px]">
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padL}
            y1={padT + chartHeight - fraction * chartHeight}
            x2={width - padR}
            y2={padT + chartHeight - fraction * chartHeight}
            stroke="#eef0f5"
          />
        ))}

        {showImpressions && (
          <polyline
            points={impressionPoints}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        )}

        {showClicks && (
          <polyline
            points={clickPoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        )}

        {slice
          .filter((_, index) => index % labelStep === 0 || index === slice.length - 1)
          .map((row, index) => {
            const originalIndex = slice.indexOf(row);
            return (
              <text
                key={`${row.date}-${index}`}
                x={xPos(originalIndex)}
                y={height - 5}
                textAnchor="middle"
                fill="#727a94"
                fontSize="9"
              >
                {formatDate(row.date)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

function MetricToggle({ checked, onChange, color, label, value }) {
  return (
    <button
      onClick={(event) => {
        event.preventDefault();
        onChange(!checked);
      }}
      className="flex items-center gap-2"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border-2 transition ${
          checked ? `${color} border-transparent` : "border-white/20 bg-transparent"
        }`}
      />
      <MetricValue label={label} value={value} />
    </button>
  );
}

function MetricValue({ label, value }) {
  return (
    <div className="text-left">
      <div className="text-[11px] leading-tight text-white/45">{label}</div>
      <div className="font-display text-xl font-bold leading-tight">{value}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = "neutral" }) {
  return (
    <div className={`gsc-stat-card gsc-stat-card-${accent} rounded-2xl border border-white/10 bg-white/[0.02] p-4`}>
      <div className="flex items-center gap-2 text-[11px] text-white/45">
        <span className="gsc-stat-icon flex h-6 w-6 items-center justify-center rounded-lg">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
  optionLabel = (option) => option,
  optionValue = (option) => option,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((state) => !state)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/[0.08]"
      >
        {label}
        <ChevronDown className="h-3 w-3 text-white/40" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 min-w-[150px] overflow-hidden rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl">
          {options.map((option) => {
            const nextValue = optionValue(option);
            return (
              <button
                key={nextValue}
                onClick={() => {
                  onChange(nextValue);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-lg px-3 py-1.5 text-xs transition ${
                  nextValue === value
                    ? "bg-brand-500/15 text-brand-200"
                    : "text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {optionLabel(option)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FullPageState({ title, body, actionLabel, onAction, error, compact = false }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.02] px-6 text-center ${
        compact ? "py-12" : "py-24"
      }`}
    >
      <Globe2 className="mx-auto h-10 w-10 text-white/20" />
      <h2 className="mt-4 font-display text-lg font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">{body}</p>
      {error && (
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      )}
      {actionLabel && (
        <button
          onClick={onAction}
          className="ui-button btn-primary mt-5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en", { day: "numeric", month: "short" });
}
