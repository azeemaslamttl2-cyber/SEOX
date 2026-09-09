import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronDown,
  Eye,
  Hash,
  Monitor,
  MousePointerClick,
  Percent,
  Smartphone,
  Tablet,
} from "lucide-react";
import {
  siteUrlFromId,
  useGscInsights,
} from "../../context/GscInsightsContext.jsx";

function formatNum(n) {
  const value = Number(n) || 0;
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export default function GscOverview() {
  const { siteId } = useParams();
  const {
    datePreset,
    datePresets,
    device,
    deviceOptions,
    error,
    handleSignIn,
    isLoadingSelected,
    isSignedIn,
    searchType,
    searchTypeOptions,
    selectedData,
    selectedSite,
    selectedSiteInfo,
    setDatePreset,
    setDevice,
    setSearchType,
    setSelectedSite,
  } = useGscInsights();
  const [showClicks, setShowClicks] = useState(true);
  const [showImpressions, setShowImpressions] = useState(true);

  useEffect(() => {
    const decodedSite = siteUrlFromId(siteId);
    if (decodedSite && decodedSite !== selectedSite) setSelectedSite(decodedSite);
  }, [selectedSite, setSelectedSite, siteId]);

  const summary = selectedData.summary || selectedSiteInfo;
  const routeSiteUrl = siteUrlFromId(siteId);
  const displayName = summary?.name || selectedSiteInfo?.name || routeSiteUrl || "GSC property";
  const topKeywords = selectedData.keywords.slice(0, 8);
  const topPages = selectedData.pages.slice(0, 8);

  const currentDateLabel = useMemo(() => {
    const preset = datePresets.find((item) => item.id === datePreset);
    return preset?.label || "Date range";
  }, [datePreset, datePresets]);

  if (!isSignedIn) {
    return (
      <StatePanel
        title="Connect Google Search Console"
        body="Connect GSC to load this property's live overview."
        actionLabel="Connect GSC"
        onAction={handleSignIn}
        error={error}
      />
    );
  }

  if (!summary && isLoadingSelected) {
    return <StatePanel title="Loading overview" body="Fetching live Search Console rows." />;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 max-w-3xl truncate text-sm text-white/50">
            {displayName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label={currentDateLabel}
            options={datePresets}
            value={datePreset}
            onChange={setDatePreset}
            optionLabel={(option) => option.label}
            optionValue={(option) => option.id}
          />
          <FilterPill
            label={`Search type: ${searchType}`}
            options={searchTypeOptions}
            value={searchType}
            onChange={setSearchType}
          />
          <FilterPill
            label={device === "All" ? "Device" : device}
            options={deviceOptions}
            value={device}
            onChange={setDevice}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-5 flex flex-wrap gap-4">
          <MetricToggle
            checked={showClicks}
            onChange={setShowClicks}
            color="bg-blue-500"
            icon={MousePointerClick}
            label="Total clicks"
            value={formatNum(summary?.totalClicks || 0)}
          />
          <MetricToggle
            checked={showImpressions}
            onChange={setShowImpressions}
            color="bg-violet-500"
            icon={Eye}
            label="Total impressions"
            value={formatNum(summary?.totalImpressions || 0)}
          />
          <MetricValue
            icon={Percent}
            label="Average CTR"
            value={`${Number(summary?.avgCtr || 0).toFixed(2)}%`}
          />
          <MetricValue
            icon={Hash}
            label="Average position"
            value={summary?.avgPosition ? summary.avgPosition.toFixed(1) : "0"}
          />
        </div>

        <PerformanceChart
          data={selectedData.dailyData}
          showClicks={showClicks}
          showImpressions={showImpressions}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/60">Position distribution</h2>
          <PositionBuckets buckets={selectedData.positionBuckets} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/60">
            Performance by device
          </h2>
          <DeviceBars devices={selectedData.devices} />
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60">CTR by position</h2>
        </div>
        <CtrByPositionChart data={selectedData.ctrByPosition} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DataTable
          title="Top keywords"
          viewAllTo={`/gsc/${siteId}/keywords`}
          columns={["Keyword", "Clicks", "Impressions", "Position"]}
          rows={topKeywords.map((row) => [
            row.keyword,
            formatNum(row.clicks),
            formatNum(row.impressions),
            row.position || "0",
          ])}
        />
        <DataTable
          title="Top pages"
          viewAllTo={`/gsc/${siteId}/pages`}
          columns={["URL", "Clicks", "Impressions", "Top keyword"]}
          rows={topPages.map((row) => [
            row.url,
            formatNum(row.clicks),
            formatNum(row.impressions),
            row.topKeyword || "-",
          ])}
          wideFirst
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DataTable
          title="Low-hanging fruit keywords"
          columns={["Keyword", "Position", "Impressions"]}
          rows={selectedData.lowHangingFruit.slice(0, 8).map((row) => [
            row.keyword,
            row.position,
            formatNum(row.impressions),
          ])}
        />
        <DataTable
          title="Potential cannibalization"
          columns={["Keyword", "URLs", "Impressions"]}
          rows={selectedData.cannibalization.slice(0, 8).map((row) => [
            row.keyword,
            row.urls,
            formatNum(row.impressions),
          ])}
        />
      </div>
    </div>
  );
}

function MetricToggle({ checked, onChange, color, icon: Icon, label, value }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex min-w-[170px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
        checked
          ? "border-white/20 bg-white/[0.04]"
          : "border-white/5 bg-white/[0.01] opacity-70"
      }`}
    >
      <span className={`h-3.5 w-3.5 rounded ${checked ? color : "bg-white/15"}`} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[11px] text-white/50">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="block font-display text-lg font-bold">{value}</span>
      </span>
    </button>
  );
}

function MetricValue({ icon: Icon, label, value }) {
  return (
    <div className="min-w-[170px] rounded-xl border border-white/5 bg-white/[0.01] px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-white/50">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function PerformanceChart({ data, showClicks, showImpressions }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-white/5 bg-white/[0.015] text-xs text-white/35">
        No performance rows for this date range.
      </div>
    );
  }

  const rows = data.slice(-180);
  const width = 900;
  const height = 220;
  const denominator = Math.max(1, rows.length - 1);
  const maxClicks = Math.max(...rows.map((row) => row.clicks), 1);
  const maxImpressions = Math.max(...rows.map((row) => row.impressions), 1);
  const x = (index) => (index / denominator) * width;
  const yClicks = (value) => height - (value / maxClicks) * (height - 20);
  const yImpressions = (value) =>
    height - (value / maxImpressions) * (height - 20);
  const clickPoints = rows.map((row, index) => `${x(index)},${yClicks(row.clicks)}`).join(" ");
  const impressionPoints = rows
    .map((row, index) => `${x(index)},${yImpressions(row.impressions)}`)
    .join(" ");
  const labelStep = Math.max(1, Math.floor(rows.length / 6));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-64 w-full min-w-[620px]">
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            y1={height - fraction * (height - 20)}
            x2={width}
            y2={height - fraction * (height - 20)}
            stroke="#eef0f5"
          />
        ))}

        {showImpressions && (
          <polyline
            points={impressionPoints}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {showClicks && (
          <polyline
            points={clickPoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {rows
          .filter((_, index) => index % labelStep === 0 || index === rows.length - 1)
          .map((row) => {
            const index = rows.indexOf(row);
            return (
              <text
                key={row.date}
                x={x(index)}
                y={height + 18}
                fill="#727a94"
                fontSize="10"
                textAnchor="middle"
              >
                {formatDate(row.date)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

function PositionBuckets({ buckets }) {
  const max = Math.max(...(buckets || []).map((bucket) => bucket.count), 1);

  return (
    <div className="space-y-3">
      {(buckets || []).map((bucket) => (
        <div key={bucket.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-white/55">{bucket.label}</span>
            <span className="font-semibold text-white">{bucket.count.toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-brand-400"
              style={{ width: `${Math.max(2, (bucket.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeviceBars({ devices }) {
  if (!devices || devices.length === 0) {
    return <EmptyMini text="No device rows for this period." />;
  }

  const icons = { Desktop: Monitor, Mobile: Smartphone, Tablet };
  const maxClicks = Math.max(...devices.map((row) => row.clicks), 1);

  return (
    <div className="space-y-4">
      {devices.map((row) => {
        const Icon = icons[row.device] || Monitor;
        return (
          <div key={row.device}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-white/55">
                <Icon className="h-3.5 w-3.5" />
                {row.device}
              </span>
              <span className="font-semibold text-white">{formatNum(row.clicks)} clicks</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.max(2, (row.clicks / maxClicks) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-white/35">
              {formatNum(row.impressions)} impressions, {row.ctr}% CTR
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CtrByPositionChart({ data }) {
  if (!data || data.length === 0) return <EmptyMini text="No keyword position data yet." />;

  const width = 760;
  const height = 170;
  const maxCtr = Math.max(...data.map((row) => row.ctr), 1);
  const maxPosition = Math.max(...data.map((row) => row.position), 1);
  const points = data
    .map((row) => {
      const x = ((row.position - 1) / Math.max(1, maxPosition - 1)) * width;
      const y = height - (row.ctr / maxCtr) * (height - 18);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="h-52 w-full min-w-[560px]">
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            y1={height - fraction * (height - 18)}
            x2={width}
            y2={height - fraction * (height - 18)}
            stroke="#eef0f5"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {data.map((row) => {
          const x = ((row.position - 1) / Math.max(1, maxPosition - 1)) * width;
          const y = height - (row.ctr / maxCtr) * (height - 18);
          return <circle key={row.position} cx={x} cy={y} r="3" fill="#3b82f6" />;
        })}
      </svg>
    </div>
  );
}

function DataTable({ title, columns, rows, viewAllTo, wideFirst }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/60">{title}</h2>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-xs font-medium text-brand-300 hover:underline">
            View all
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyMini text="No rows for this period." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/40">
                {columns.map((column, index) => (
                  <th
                    key={column}
                    className={`pb-2 font-medium ${
                      index > 0 && !wideFirst ? "text-right" : ""
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-b border-white/5">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cellIndex}-${cell}`}
                      className={`max-w-[320px] py-2 ${
                        cellIndex === 0
                          ? "truncate text-blue-300"
                          : wideFirst
                            ? "text-white/70"
                            : "text-right text-white/70"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FilterPill({
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
        <div className="absolute left-0 top-9 z-30 min-w-[170px] overflow-hidden rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl">
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

function EmptyMini({ text }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-white/5 bg-white/[0.015] px-4 text-center text-xs text-white/35">
      {text}
    </div>
  );
}

function StatePanel({ title, body, actionLabel, onAction, error }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">{body}</p>
      {error && (
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      )}
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
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
