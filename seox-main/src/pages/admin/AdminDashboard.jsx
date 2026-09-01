import {
  DollarSign,
  Users,
  Rocket,
  MousePointerClick,
  Crown,
  TrendingUp,
  Search,
  LayoutGrid,
  RefreshCw,
  ArrowUpRight,
  Percent,
  Filter,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatNumber, useAdminData } from "../../hooks/useAdminData.js";

/* ================================================================
   SVG Donut Chart — User Types
   ================================================================ */
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 140;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-7 flex-wrap">
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((d, i) => {
          const dashLength = total ? (d.value / total) * circumference : 0;
          const dashOffset = -offset;
          offset += dashLength;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-white/50 min-w-[90px]">{d.label}</span>
            <span className="font-bold text-white">{d.value.toLocaleString()}</span>
            <span className="text-white/30 text-[11px]">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   SVG Area/Line Chart
   ================================================================ */
function AreaChart({ points, color = "#fb923c", height = 140, labels = [] }) {
  const maxVal = Math.max(...points);
  const w = 500;
  const h = height;
  const pad = 20;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;

  const pathPoints = points.map(
    (v, i) => `${pad + i * stepX},${h - pad - ((v / (maxVal || 1)) * (h - pad * 2))}`
  );
  const linePath = `M${pathPoints.join(" L")}`;
  const areaPath = `${linePath} L${pad + (points.length - 1) * stepX},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full h-auto">
      <defs>
        <linearGradient id={`ag-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2={h}>
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y-axis grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = h - pad - frac * (h - pad * 2);
        const val = Math.round(frac * maxVal);
        return (
          <g key={frac}>
            <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={pad - 8} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="Inter">
              {val ? `Rs ${(val / 1000).toFixed(0)}k` : "Rs 0"}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill={`url(#ag-${color.replace("#", "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {pathPoints.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill="#08080b" stroke={color} strokeWidth="2" />;
      })}
      {labels.map((label, i) => (
        <text key={i} x={pad + i * stepX} y={h + 14} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="Inter">
          {label}
        </text>
      ))}
    </svg>
  );
}

/* ================================================================
   Dual Line Chart (Search Console Performance)
   ================================================================ */
function DualLineChart({ series1, series2, color1 = "#fb923c", color2 = "#7c5cf0", labels = [] }) {
  const allPoints = [...series1, ...series2];
  const maxVal = Math.max(...allPoints);
  const w = 500;
  const h = 140;
  const pad = 20;
  const stepX = series1.length > 1 ? (w - pad * 2) / (series1.length - 1) : 0;

  const toPath = (pts) =>
    pts.map((v, i) => `${pad + i * stepX},${h - pad - ((v / (maxVal || 1)) * (h - pad * 2))}`).join(" L");

  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full h-auto">
      <path d={`M${toPath(series1)}`} fill="none" stroke={color1} strokeWidth="2.5" strokeLinejoin="round" />
      <path d={`M${toPath(series2)}`} fill="none" stroke={color2} strokeWidth="2.5" strokeLinejoin="round" />
      {labels.map((l, i) => (
        <text key={i} x={pad + i * stepX} y={h + 14} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="Inter">{l}</text>
      ))}
      <circle cx={w / 2 - 60} cy={h + 26} r="4" fill={color1} />
      <text x={w / 2 - 52} y={h + 30} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="Inter">Clicks</text>
      <circle cx={w / 2 + 20} cy={h + 26} r="4" fill={color2} />
      <text x={w / 2 + 28} y={h + 30} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="Inter">Impressions</text>
    </svg>
  );
}

/* ================================================================
   User Growth Mini Chart
   ================================================================ */
function UserGrowthChart({ data, labels }) {
  const maxVal = Math.max(...data);
  const w = 300;
  const h = 120;
  const pad = 16;
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pathPoints = data.map((v, i) => `${pad + i * stepX},${h - pad - ((v / maxVal) * (h - pad * 2))}`);
  const linePath = `M${pathPoints.join(" L")}`;
  const areaPath = `${linePath} L${pad + (data.length - 1) * stepX},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-auto">
      <defs>
        <linearGradient id="ug-grad" x1="0" y1="0" x2="0" y2={h}>
          <stop offset="0" stopColor="#22c55e" stopOpacity="0.2" />
          <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => {
        const y = h - pad - f * (h - pad * 2);
        return <line key={f} x1={pad} y1={y} x2={w - pad} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      <path d={areaPath} fill="url(#ug-grad)" />
      <path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
      {labels.map((l, i) => (
        <text key={i} x={pad + i * stepX} y={h + 10} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="Inter">{l}</text>
      ))}
    </svg>
  );
}

/* ================================================================
   Stat Card (Dark Theme)
   ================================================================ */
function StatCard({ icon: Icon, value, label, color, iconBg }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-all duration-300 hover:border-brand-500/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_-12px_rgba(249,115,22,0.2)]">
      <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: iconBg }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

/* ================================================================
   Recent Signup Card
   ================================================================ */
function SignupCard({ name, email, plan, color }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const planColors = {
    free: "bg-white/[0.06] text-white/50",
    admin: "bg-pink-500/15 text-pink-300",
    enterprise: "bg-brand-500/15 text-brand-300",
    professional: "bg-emerald-500/15 text-emerald-300",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: color }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-white truncate">{name}</div>
        <div className="text-[11px] text-white/40 truncate">{email}</div>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${planColors[plan] || planColors.free}`}>
        {plan}
      </span>
    </div>
  );
}

/* ================================================================
   Main Admin Dashboard
   ================================================================ */
export default function AdminDashboard() {
  const { users, stats, loading, error, refresh } = useAdminData();

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      label: date.toLocaleString("en", { month: "short" }),
      key: `${date.getFullYear()}-${date.getMonth()}`,
    };
  });

  const userGrowthData = months.map(({ key }) => {
    const [year, month] = key.split("-").map(Number);
    return users.filter((user) => {
      const created = new Date(user.createdAt);
      return created.getFullYear() === year && created.getMonth() === month;
    }).length;
  });
  const userGrowthLabels = months.map((month) => month.label);
  const lifetimeIncomeData = userGrowthData.map((_, index) => {
    const monthKeys = months.slice(0, index + 1).map((month) => month.key);
    const lifetimeCount = users.filter((user) => {
      const created = new Date(user.createdAt);
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      return user.level === "enterprise" && user.tenure === "lifetime" && monthKeys.includes(key);
    }).length;
    return lifetimeCount * 5000;
  });
  const lifetimeLabels = userGrowthLabels;

  const userTypeData = [
    { label: "Free", value: stats.freeUsers, color: "#3b82f6" },
    { label: "Professional", value: stats.professionalUsers, color: "#22c55e" },
    { label: "Enterprise", value: stats.enterpriseUsers, color: "#fb923c" },
    { label: "Admin", value: stats.admins, color: "#ef4444" },
  ];

  const searchConsoleClicks = [0];
  const searchConsoleImpressions = [0];
  const scLabels = [""];
  const topQueries = [];
  const recentSignups = users.slice(0, 8).map((user, index) => ({
    name: user.name,
    email: user.email,
    plan: user.level,
    color: ["#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#ec4899", "#06b6d4", "#f97316"][index % 8],
  }));

  return (
    <section>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-brand-400" />
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-white/45">Real-time metrics from Firebase</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {/* Top stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        <StatCard icon={DollarSign} value={formatCurrency(stats.lifetimeIncome)} label="Lifetime Revenue" color="#22c55e" iconBg="rgba(34,197,94,0.15)" />
        <StatCard icon={Users} value={formatNumber(stats.totalUsers)} label="Total Users" color="#3b82f6" iconBg="rgba(59,130,246,0.15)" />
        <StatCard icon={Percent} value={`${stats.conversionRate.toFixed(1)}%`} label="Conversion Rate" color="#f59e0b" iconBg="rgba(245,158,11,0.15)" />
        <StatCard icon={Crown} value={formatNumber(stats.lifetimeEnterprise)} label="Lifetime Enterprise" color="#fb923c" iconBg="rgba(251,146,60,0.15)" />
      </div>

      {/* Lifetime Deals Income + User Types */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 mb-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-4">
            <Crown className="h-4 w-4 text-amber-400" />
            Lifetime Deals Income
          </h3>
          <AreaChart points={lifetimeIncomeData} color="#fb923c" height={140} labels={lifetimeLabels} />
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="text-center rounded-xl border border-white/10 p-4">
              <div className="text-[11px] text-white/40 mb-1">Lifetime Users</div>
              <div className="font-display text-xl font-bold">{formatNumber(stats.lifetimeEnterprise)}</div>
            </div>
            <div className="text-center rounded-xl border border-white/10 p-4">
              <div className="text-[11px] text-white/40 mb-1">Per User</div>
              <div className="font-display text-xl font-bold">Rs 5,000</div>
            </div>
            <div className="text-center rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 p-4">
              <div className="text-[11px] text-white/80 mb-1">Total Income</div>
              <div className="font-display text-xl font-bold">{formatCurrency(stats.lifetimeIncome)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-5">
            <Users className="h-4 w-4 text-brand-400" />
            User Types
          </h3>
          <DonutChart data={userTypeData} />
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 mb-4">
        <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-5">
          <Filter className="h-4 w-4 text-cyan-400" />
          Conversion Funnel
        </h3>
        {(() => {
          const funnelStages = [
            { label: "Total Signups", value: stats.totalUsers, color: "#3b82f6" },
            { label: "Free Active", value: stats.freeUsers, color: "#60a5fa" },
            { label: "Professional", value: stats.professionalUsers, color: "#22c55e" },
            { label: "Enterprise", value: stats.enterpriseUsers, color: "#fb923c" },
          ];
          const maxValue = Math.max(...funnelStages.map(s => s.value), 1);
          return (
            <div className="space-y-3">
              {funnelStages.map((stage, i) => {
                const pct = maxValue ? (stage.value / maxValue) * 100 : 0;
                const convRate = i > 0 && funnelStages[0].value
                  ? ((stage.value / funnelStages[0].value) * 100).toFixed(1)
                  : null;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-white/60">{stage.label}</span>
                      <div className="flex items-center gap-2">
                        {convRate !== null && (
                          <span className="text-[10px] font-bold text-white/30">
                            {convRate}% of total
                          </span>
                        )}
                        <span className="text-sm font-bold text-white">{stage.value.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-7 rounded-lg overflow-hidden bg-white/[0.03]">
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${stage.color}40, ${stage.color})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Search Console Performance + User Growth */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-brand-400" />
            Search Console Performance
          </h3>
          <DualLineChart series1={searchConsoleClicks} series2={searchConsoleImpressions} labels={scLabels} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            User Growth
          </h3>
          <UserGrowthChart data={userGrowthData} labels={userGrowthLabels} />
        </div>
      </div>

      {/* Recent Deployments + Top Search Queries */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <Rocket className="h-4 w-4 text-violet-400" />
              Recent Deployments
            </h3>
            <div className="flex gap-2">
              <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">0 Ready</span>
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-red-300">0 Error</span>
            </div>
          </div>
          <div className="flex items-center justify-center py-10 text-sm text-white/30">
            No deployments found
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-brand-400" />
            Top Search Queries
          </h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-3">Query</th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-3">Clicks</th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-3">Impr.</th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/40 pb-3">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {topQueries.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-white/30">
                    No Search Console query data connected
                  </td>
                </tr>
              )}
              {topQueries.map((q, i) => (
                <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                  <td className="py-2.5 text-[13px] font-medium text-white/80">{q.query}</td>
                  <td className="py-2.5 text-right text-[13px] text-white/60">{q.clicks}</td>
                  <td className="py-2.5 text-right text-[13px] text-white/60">{q.impressions}</td>
                  <td className="py-2.5 text-right text-[13px] font-semibold text-brand-400">{q.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Signups */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-400" />
            Recent Signups
          </h3>
          <a href="#" className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition">
            View All <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {recentSignups.map((u, i) => (
            <SignupCard key={i} {...u} />
          ))}
        </div>
      </div>

      {/* Revenue Breakdown + Signup Timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Revenue Breakdown */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-5">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Revenue Breakdown
          </h3>
          {(() => {
            const lifetimeRev = stats.lifetimeEnterprise * 5000;
            const monthlyRev = stats.monthlyEnterprise * 800;
            const total = lifetimeRev + monthlyRev;
            const segments = [
              { label: "Lifetime Deals", value: lifetimeRev, count: stats.lifetimeEnterprise, color: "#fb923c", unit: "Rs 5,000/user" },
              { label: "Monthly Subs", value: monthlyRev, count: stats.monthlyEnterprise, color: "#22c55e", unit: "Rs 800/mo" },
            ];
            return (
              <div className="space-y-4">
                {segments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                          {seg.label}
                        </span>
                        <span className="text-xs text-white/35">{seg.count} users × {seg.unit}</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden bg-white/[0.04]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${total ? (seg.value / total) * 100 : 0}%`, background: seg.color }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white w-24 text-right">{formatCurrency(seg.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/40">Total Revenue</span>
                  <span className="font-display text-lg font-bold bg-gradient-to-r from-brand-400 to-amber-400 bg-clip-text text-transparent">{formatCurrency(total)}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Signup Timeline (last 30 days) */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
          <h3 className="font-display text-sm font-bold flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-violet-400" />
            Signups (Last 30 Days)
          </h3>
          {(() => {
            const now = new Date();
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentUsers = users.filter((u) => {
              const created = new Date(u.createdAt);
              return created >= thirtyDaysAgo;
            });
            const dayBuckets = Array.from({ length: 30 }, (_, i) => {
              const d = new Date(now);
              d.setDate(d.getDate() - (29 - i));
              const key = d.toISOString().slice(0, 10);
              return {
                key,
                label: d.toLocaleDateString("en", { day: "numeric", month: "short" }),
                count: recentUsers.filter((u) => new Date(u.createdAt).toISOString().slice(0, 10) === key).length,
              };
            });
            const maxCount = Math.max(...dayBuckets.map((b) => b.count), 1);
            return (
              <div className="flex items-end gap-[3px] h-28">
                {dayBuckets.map((bucket, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all hover:opacity-80 group relative"
                    style={{
                      height: `${Math.max(((bucket.count / maxCount) * 100), 4)}%`,
                      background: bucket.count > 0 ? "linear-gradient(to top, #3b82f640, #3b82f6)" : "rgba(255,255,255,0.04)",
                    }}
                    title={`${bucket.label}: ${bucket.count} signup${bucket.count !== 1 ? "s" : ""}`}
                  />
                ))}
              </div>
            );
          })()}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-white/30">30 days ago</span>
            <span className="text-[10px] text-white/30">Today</span>
          </div>
        </div>
      </div>
    </section>
  );
}
