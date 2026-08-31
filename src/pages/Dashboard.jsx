import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  ShieldCheck,
  FileSearch,
  Link2,
  Bot,
  Activity,
  TrendingUp,
  Eye,
  MousePointerClick,
  BarChart3,
  ArrowRight,
  Hash,
  FolderOpen,
  Plus,
  RefreshCw,
  Target,
  Globe,
  AlertTriangle,
  ExternalLink,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCrawl } from "../context/CrawlContext.jsx";
import { useDashboardGscMetrics } from "../hooks/useDashboardGscMetrics.js";
import { useProjectToolChecks } from "../hooks/useProjectToolChecks.js";
import { averageCompletedScore } from "../lib/projectToolChecks.js";
import { formatNumber } from "../lib/techSeoTools.js";

/* ------------------------------------------------------------------ */
/*  SVG circular progress ring                                        */
/* ------------------------------------------------------------------ */
function CircularProgress({ value = 0, size = 80, strokeWidth = 6, color = "#df3c27" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline sparkline for metric cards                                  */
/* ------------------------------------------------------------------ */
function MetricSparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) return <div className="mt-3 h-10" />;
  const values = data.map((r) => Number(r[dataKey]) || 0);
  const w = 200;
  const h = 40;
  const pad = 2;
  const max = Math.max(...values, 0.001);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const denom = Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = (i / denom) * w;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const fillPoints = `${points} ${w},${h} 0,${h}`;
  const gradId = `spark-${dataKey}-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-10 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Top metric card (Clicks, Impressions, CTR, Avg. Position)         */
/* ------------------------------------------------------------------ */
function MetricCard({ icon: Icon, label, value, color, iconBg, footer = "Waiting for data", sparklineData, sparklineKey }) {
  return (
    <div className="dashboard-metric-card group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 pb-3 transition-all duration-300 hover:border-brand-500/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(249,115,22,0.2)]">
      <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: iconBg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</div>
        <span className="mb-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/45">
          {footer}
        </span>
      </div>
      <MetricSparkline data={sparklineData} dataKey={sparklineKey} color={color} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score card (Speed, E-E-A-T, On-Page, etc.)                        */
/* ------------------------------------------------------------------ */
function statusClass(status) {
  if (status === "complete") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "running") return "border border-blue-200 bg-blue-50 text-blue-700";
  if (status === "error") return "border border-rose-200 bg-rose-50 text-rose-700";
  if (status === "skipped") return "border border-amber-200 bg-amber-50 text-amber-700";
  return "border border-slate-200 bg-slate-50 text-slate-600";
}

function statusLabel(status) {
  if (status === "complete") return "Done";
  if (status === "running") return "Running";
  if (status === "error") return "Error";
  if (status === "skipped") return "Setup";
  return "Queued";
}

function metricFooter(gscMetrics, key) {
  if (gscMetrics.status === "loading") return "Fetching GSC";
  if (gscMetrics.status === "skipped") return gscMetrics.summary || "Connect GSC";
  if (gscMetrics.status === "error") return "GSC error";
  if (gscMetrics.status !== "complete") return "Waiting for GSC";

  const delta = Number(gscMetrics.deltas?.[key]) || 0;
  const sign = delta > 0 ? "+" : "";
  if (key === "ctr") return `${sign}${delta.toFixed(2)}% vs prev`;
  if (key === "position") return `${sign}${delta.toFixed(1)} vs prev`;
  return `${sign}${formatNumber(delta)} vs prev`;
}

function ScoreCard({ icon: Icon, label, subtitle, score = null, status = "queued", summary = "", color, iconBg, to }) {
  const hasScore = Number.isFinite(score);
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-all duration-300 hover:border-brand-500/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(249,115,22,0.2)]"
    >
      {/* Top-right arrow */}
      <ArrowRight className="absolute right-4 top-4 h-4 w-4 text-white/15 transition-all group-hover:text-brand-400 group-hover:translate-x-0.5" />

      <div className="flex items-start gap-4">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-bold text-white">{label}</h4>
          <p className="mt-0.5 text-[11px] text-white/45">{summary || subtitle}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`dashboard-score-status inline-flex min-w-[58px] justify-center rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide ${statusClass(status)}`}>
          {statusLabel(status)}
        </span>
        <div className="relative">
          <CircularProgress value={hasScore ? score : 0} size={64} strokeWidth={5} color={color} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-lg font-bold text-white">{hasScore ? `${score}%` : "--"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                    */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const { user } = useAuth();
  const { project, stats, storageReady } = useCrawl();
  
  // Only load tool checks and GSC metrics after:
  // 1. A project is selected
  // 2. CrawlContext is ready with database-loaded projects
  // This ensures high-priority loading of projects before other data
  const { checks, isRunning, rerun } = useProjectToolChecks(
    storageReady ? project : null, 
    user
  );
  const gscMetrics = useDashboardGscMetrics(
    storageReady ? project : null, 
    user
  );
  
  const domain = project?.domain || project?.url || "your-domain.com";
  const tools = checks?.tools || {};
  const metrics =
    gscMetrics.status === "complete"
      ? gscMetrics.metrics
      : checks?.metrics || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const overallScore = averageCompletedScore(tools);
  const [autoRunStarted, setAutoRunStarted] = useState(false);

  useEffect(() => {
    if (!project || isRunning || autoRunStarted) return;
    if (!checks || checks.status === "complete") return;

    setAutoRunStarted(true);
    rerun().catch(() => {
      // The tool run may fail silently; the dashboard state still updates.
    });
  }, [project, checks, isRunning, autoRunStarted, rerun]);

  useEffect(() => {
    setAutoRunStarted(false);
  }, [project?.id]);

  const tool = (key) => tools[key] || { status: "queued", score: null, summary: "Waiting to run" };
  const gscTool =
    gscMetrics.status === "complete"
      ? {
          ...tool("gsc"),
          status: "complete",
          score: 100,
          summary: `${formatNumber(gscMetrics.metrics.clicks)} clicks from GSC`,
        }
      : tool("gsc");

  return (
    <section className="pb-16">
      {/* Welcome banner */}
      <div className="dashboard-welcome relative overflow-hidden rounded-2xl border border-brand-600 bg-brand-500 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float-slow rounded-full bg-college-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 animate-float rounded-full bg-college-yellow/20 blur-3xl" />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome to <span>PGC</span>
          </h1>
          <p className="mt-1 text-sm text-white">
            Monitoring <span className="font-medium text-white">{domain}</span> - Track your SEO performance
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${isRunning ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300"}`}>
              {isRunning ? "Checks running" : checks?.completedAt ? "Checks complete" : "Checks pending"}
            </span>
            {checks?.updatedAt && (
                <span className="text-xs text-white">
                Updated {new Date(checks.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              type="button"
              onClick={rerun}
              disabled={!project || isRunning}
              className="ui-button ui-button-secondary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`} />
              Run checks
            </button>
          </div>
        </div>
      </div>

      {/* Top metrics row - Clicks, Impressions, CTR, Avg. Position */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={MousePointerClick}
          label="Clicks"
          value={formatNumber(metrics.clicks)}
          color="#2d2b6f"
          iconBg="rgba(124,92,240,0.15)"
          footer={metricFooter(gscMetrics, "clicks")}
          sparklineData={gscMetrics.dailyData}
          sparklineKey="clicks"
        />
        <MetricCard
          icon={Eye}
          label="Impressions"
          value={formatNumber(metrics.impressions)}
          color="#22c55e"
          iconBg="rgba(34,197,94,0.15)"
          footer={metricFooter(gscMetrics, "impressions")}
          sparklineData={gscMetrics.dailyData}
          sparklineKey="impressions"
        />
        <MetricCard
          icon={TrendingUp}
          label="CTR"
          value={`${Number(metrics.ctr || 0).toFixed(2)}%`}
          color="#f59e0b"
          iconBg="rgba(245,158,11,0.15)"
          footer={metricFooter(gscMetrics, "ctr")}
          sparklineData={gscMetrics.dailyData}
          sparklineKey="ctr"
        />
        <MetricCard
          icon={BarChart3}
          label="Avg. Position"
          value={Number(metrics.position || 0).toFixed(1)}
          color="#ef4444"
          iconBg="rgba(239,68,68,0.15)"
          footer={metricFooter(gscMetrics, "position")}
          sparklineData={gscMetrics.dailyData}
          sparklineKey="position"
        />
      </div>

      {/* Score cards grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard
          icon={Zap}
          label="Speed"
          subtitle="Page load performance"
          score={tool("speed").score}
          status={tool("speed").status}
          summary={tool("speed").summary}
          color="#22c55e"
          iconBg="rgba(34,197,94,0.15)"
          to="/tech-seo/speed"
        />
        <ScoreCard
          icon={ShieldCheck}
          label="E-E-A-T"
          subtitle="Trust & authority signals"
          score={tool("eeat").score}
          status={tool("eeat").status}
          summary={tool("eeat").summary}
          color="#22c55e"
          iconBg="rgba(34,197,94,0.15)"
          to="/tech-seo/eeat"
        />
        <ScoreCard
          icon={FileSearch}
          label="Semantic"
          subtitle="Content optimization"
          score={tool("semantic").score}
          status={tool("semantic").status}
          summary={tool("semantic").summary}
          color="#3b82f6"
          iconBg="rgba(59,130,246,0.15)"
          to="/tech-seo/semantic"
        />
        <ScoreCard
          icon={Activity}
          label="Overall"
          subtitle="Average of completed checks"
          score={overallScore}
          status={checks?.status === "complete" ? "complete" : checks?.status || "queued"}
          summary="Available tool checks only"
          color="#df3c27"
          iconBg="rgba(249,115,22,0.15)"
          to="/dashboard"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard
          icon={Activity}
          label="Crawl Optimization"
          subtitle="Indexability & structure"
          score={tool("crawlOptimization").score}
          status={tool("crawlOptimization").status}
          summary={tool("crawlOptimization").summary}
          color="#ef4444"
          iconBg="rgba(239,68,68,0.15)"
          to="/tech-seo/crawl"
        />
        <ScoreCard
          icon={Bot}
          label="Robots"
          subtitle="Crawler directives"
          score={tool("robots").score}
          status={tool("robots").status}
          summary={tool("robots").summary}
          color="#3b82f6"
          iconBg="rgba(59,130,246,0.15)"
          to="/tech-seo/robots"
        />
        <ScoreCard
          icon={FileSearch}
          label="Duplicate"
          subtitle="Repeated content"
          score={tool("duplicate").score}
          status={tool("duplicate").status}
          summary={tool("duplicate").summary}
          color="#22c55e"
          iconBg="rgba(34,197,94,0.15)"
          to="/tech-seo/duplicate"
        />
        <ScoreCard
          icon={BarChart3}
          label="GSC Audit"
          subtitle="Search Console"
          score={gscTool.score}
          status={gscMetrics.status === "loading" ? "running" : gscTool.status}
          summary={gscMetrics.status === "loading" ? "Fetching Search Console" : gscTool.summary}
          color="#14b8a6"
          iconBg="rgba(20,184,166,0.15)"
          to="/tech-seo/gsc-audit"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard
          icon={BarChart3}
          label="Bing Webmaster"
          subtitle="Bing search data"
          score={tool("bing").score}
          status={tool("bing").status}
          summary={tool("bing").summary}
          color="#38bdf8"
          iconBg="rgba(56,189,248,0.15)"
          to="/tech-seo/bing"
        />
        <ScoreCard
          icon={Link2}
          label="Backlinks"
          subtitle="Needs backlink export"
          score={tool("backlinks").score}
          status={tool("backlinks").status}
          summary={tool("backlinks").summary}
          color="#60a5fa"
          iconBg="rgba(96,165,250,0.15)"
          to="/tech-seo/backlinks"
        />
        <ScoreCard
          icon={FileSearch}
          label="Plagiarism"
          subtitle="Needs DataForSEO"
          score={tool("plagiarism").score}
          status={tool("plagiarism").status}
          summary={tool("plagiarism").summary}
          color="#a78bfa"
          iconBg="rgba(167,139,250,0.15)"
          to="/tech-seo/plagiarism"
        />
      </div>

      {/* Quick Wins Alert */}
      {gscMetrics.quickWins?.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] to-transparent p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <Target className="h-4.5 w-4.5 text-amber-400" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-bold flex items-center gap-2">
                Quick Wins
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {gscMetrics.quickWins.length} keywords
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-white/45">
                Keywords on page 2-3 with high impressions — push them to page 1
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {gscMetrics.quickWins.map((qw, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs">
                    <span className="text-white/70 font-medium">{qw.query}</span>
                    <span className="text-white/30">·</span>
                    <span className="text-amber-400 font-bold">#{qw.position.toFixed(1)}</span>
                    <span className="text-white/30">·</span>
                    <span className="text-white/40">{formatNumber(qw.impressions)} impr</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Keywords + Top Pages side by side */}
      {(gscMetrics.topQueries?.length > 0 || gscMetrics.topPages?.length > 0) && (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Top Keywords */}
          {gscMetrics.topQueries?.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold flex items-center gap-2">
                  <Search className="h-4 w-4 text-violet-400" />
                  Top Keywords
                </h3>
                <Link to="/gsc" className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition">
                  View all <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Query</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Clicks</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Impr.</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {gscMetrics.topQueries.map((q, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-2 text-[12px] font-medium text-white/75 truncate max-w-[200px]">{q.query}</td>
                      <td className="py-2 text-right text-[12px] text-violet-300 font-semibold">{formatNumber(q.clicks)}</td>
                      <td className="py-2 text-right text-[12px] text-white/50">{formatNumber(q.impressions)}</td>
                      <td className="py-2 text-right text-[12px] text-brand-400 font-bold">{q.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Pages */}
          {gscMetrics.topPages?.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  Top Pages
                </h3>
                <Link to="/gsc" className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition">
                  View all <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Page</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Clicks</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Impr.</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-2">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {gscMetrics.topPages.map((p, i) => {
                    let pagePath;
                    try { pagePath = new URL(p.page).pathname; } catch { pagePath = p.page; }
                    return (
                      <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                        <td className="py-2 text-[12px] font-medium text-white/75 truncate max-w-[200px]" title={p.page}>{pagePath}</td>
                        <td className="py-2 text-right text-[12px] text-emerald-300 font-semibold">{formatNumber(p.clicks)}</td>
                        <td className="py-2 text-right text-[12px] text-white/50">{formatNumber(p.impressions)}</td>
                        <td className="py-2 text-right text-[12px] text-brand-400 font-bold">{p.position.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Crawl Health Summary */}
      {stats.crawledCount > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Crawl Health
            </h3>
            <Link to="/auditor" className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition">
              Full audit <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Crawled</div>
              <div className="font-display text-xl font-bold text-white">{formatNumber(stats.crawledCount)}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60 mb-1">2xx OK</div>
              <div className="font-display text-xl font-bold text-emerald-300">{formatNumber(stats.byStatus["2xx"] || 0)}</div>
            </div>
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/60 mb-1">3xx Redirect</div>
              <div className="font-display text-xl font-bold text-amber-300">{formatNumber(stats.byStatus["3xx"] || 0)}</div>
            </div>
            <div className="rounded-xl border border-red-500/10 bg-red-500/[0.04] p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-400/60 mb-1">Errors</div>
              <div className="font-display text-xl font-bold text-red-300">{formatNumber((stats.byStatus["4xx"] || 0) + (stats.byStatus["5xx"] || 0))}</div>
            </div>
          </div>
          {Object.keys(stats.auditIssues || {}).length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.05] px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-200/80">
                {Object.keys(stats.auditIssues).length} issue type{Object.keys(stats.auditIssues).length !== 1 ? "s" : ""} found —{" "}
                <Link to="/auditor/issues" className="font-semibold text-amber-300 hover:underline">
                  View all issues
                </Link>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Keyword Bucket */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <Hash className="h-5 w-5 text-brand-400" />
          <h3 className="font-display text-sm font-bold">Keyword Bucket</h3>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/50">
            0
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <FolderOpen className="h-7 w-7 text-white/20" />
          </div>
          <p className="mt-4 text-sm font-medium text-white/50">No keywords saved yet</p>
          <p className="mt-1 max-w-xs text-xs text-white/35">
            Use the <Plus className="inline h-3 w-3 text-white/40" /> icon in Suggest Keywords or Ubersuggest to add keywords
          </p>
          <Link
            to="/keywords/suggest"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-xs font-semibold text-brand-300 transition-all hover:bg-brand-500/20 hover:scale-[1.02]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Keywords
          </Link>
        </div>
      </div>
    </section>
  );
}
