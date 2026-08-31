import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Code2, Download, HelpCircle, Sparkles, Eye, BarChart3 } from "lucide-react";
import Card from "../../components/auditor/Card.jsx";
import DonutChart from "../../components/auditor/DonutChart.jsx";
import HealthGauge from "../../components/auditor/HealthGauge.jsx";
import HorizontalBars from "../../components/auditor/HorizontalBars.jsx";
import MiniBars from "../../components/auditor/MiniBars.jsx";
import IssueTable from "../../components/auditor/IssueTable.jsx";
import { useAuditData } from "../../hooks/useAuditData.js";
import { useCrawl } from "../../context/CrawlContext.jsx";
import { downloadTextFile, rowsToCsv, slugForFilename } from "../../lib/auditorExport.js";

/* Stacked bar chart for HTTP status by depth */
function DepthChart({ data }) {
  const maxVal = Math.max(...data.map((d) => d.success + d.redirect), 1);
  const barCount = data.length;
  return (
    <div className="mt-2">
      <div className="flex items-end gap-2" style={{ height: 160 }}>
        {data.map((d, i) => {
          const total = d.success + d.redirect;
          const successH = total ? (d.success / maxVal) * 140 : 0;
          const redirectH = total ? (d.redirect / maxVal) * 140 : 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="flex w-full flex-col items-center justify-end" style={{ height: 140 }}>
                <div
                  className="w-full rounded-t-sm bg-[#facc15] transition-all duration-500"
                  style={{ height: redirectH, minHeight: redirectH ? 2 : 0 }}
                />
                <div
                  className="w-full bg-[#34d399] transition-all duration-500"
                  style={{ height: successH, minHeight: successH ? 2 : 0 }}
                />
              </div>
              <span className="mt-1 text-[10px] text-white/40">{d.depth}</span>
            </div>
          );
        })}
      </div>
      {/* Y-axis labels */}
      <div className="mt-2 flex items-center gap-4 text-[10px] text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#34d399]" /> Success (2xx)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#facc15]" /> Redirect (3xx)
        </span>
      </div>
    </div>
  );
}

export default function AuditorOverview() {
  const [tab, setTab] = useState("whatsnew");
  const navigate = useNavigate();
  const { stats } = useCrawl();
  const {
    crawledUrls,
    crawlStatus,
    errorDistribution,
    issuesDistribution,
    healthScore,
    whatsNew,
    topIssues,
    project,
    httpStatusCodes,
    aiContentLevel,
    httpStatusByDepth,
    bulkExportSummary,
  } = useAuditData();
  const rows = tab === "whatsnew" ? whatsNew : topIssues;
  const exportSummaryRow = (row) => {
    const latestUrls = stats?.latestUrls || [];
    const csv = rowsToCsv(
      ["url", "status", "contentType", "title"],
      latestUrls.map((item) => ({
        url: item.url,
        status: item.status,
        contentType: item.contentType,
        title: item.title,
      }))
    );
    downloadTextFile(`${slugForFilename(row.name)}.csv`, csv);
  };
  const viewSummaryRow = (row) => {
    if (row.name.toLowerCase().includes("alt")) {
      navigate("/auditor/issues/missing-alt-text");
      return;
    }
    navigate("/auditor/export");
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">Overview</h1>
          <button
            type="button"
            title="Use Overview to spot crawl health, current issue counts, error patterns, and export the active project data."
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            How to use
          </button>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.06]"
        >
          <Download className="h-3.5 w-3.5" /> Print to PDF
        </button>
      </div>

      {/* Top row: 3 columns (Crawled URLs · Health Score · Issues distribution) */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr_1fr]">
        <Card title="Crawled URLs distribution" hint total={crawledUrls.total}>
          <DonutChart segments={crawledUrls.segments} center={crawledUrls.total} />
        </Card>

        <Card title="Health Score" hint>
          <div className="flex flex-col items-center">
            <HealthGauge score={healthScore.score} grade={healthScore.grade} />
            <p className="mt-3 text-center text-xs leading-relaxed text-white/55">
              Health Score reflects the proportion of internal URLs on your site that
              don't have errors.
            </p>
            <div className="mt-4 w-full">
              <MiniBars values={healthScore.trend} labels={healthScore.dates} />
            </div>
          </div>
        </Card>

        <Card title="Issues distribution" hint total={issuesDistribution.total}>
          <HorizontalBars rows={issuesDistribution.rows} />
        </Card>
      </div>

      {/* Second row: 2 donuts */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr_1fr]">
        <Card title="Crawl status of links found" hint total={crawlStatus.total}>
          <DonutChart segments={crawlStatus.segments} />
        </Card>

        {/* Reserved center column to align with health score above on wide screens */}
        <div className="hidden xl:block" />

        <Card title="Error distribution" hint total={errorDistribution.total}>
          <DonutChart segments={errorDistribution.segments} />
        </Card>
      </div>

      {/* What's new table */}
      <div className="rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-1">
            <TabButton active={tab === "whatsnew"} onClick={() => setTab("whatsnew")}>
              What's new
            </TabButton>
            <TabButton active={tab === "top"} onClick={() => setTab("top")}>
              Top issues
            </TabButton>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]">
              <Code2 className="h-3.5 w-3.5" /> AI · API
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]">
              <Download className="h-3.5 w-3.5" /> Export all issues
            </button>
          </div>
        </div>
        <IssueTable rows={rows} />
      </div>

      {/* ── Image 1: HTTP status codes distribution + AI content + Depth chart ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card title="HTTP status codes distribution" hint>
          <DonutChart segments={httpStatusCodes.segments} center={httpStatusCodes.total} />
        </Card>

        <Card title="AI content level distribution" hint>
          <div className="flex h-[120px] flex-col items-center justify-center">
            {aiContentLevel.enabled ? (
              <DonutChart segments={[]} />
            ) : (
              <>
                <span className="mb-2 rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Disabled
                </span>
                <span className="text-sm font-semibold text-white/30">NO DATA</span>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card title="HTTP status codes by depth level" hint action={
        <button className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white">
          <BarChart3 className="h-4 w-4" />
        </button>
      }>
        <DepthChart data={httpStatusByDepth} />
      </Card>

      {/* ── Image 2: Bulk export summary ── */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <header className="border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-bold text-white">Bulk export</h2>
        </header>
        <ul>
          {bulkExportSummary.map((row) => (
            <li
              key={row.name}
              className="group flex flex-col gap-2 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.02] sm:flex-row sm:items-center"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-300">{row.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/55">{row.desc}</p>
              </div>
              <div className="flex items-center gap-4 sm:flex-shrink-0">
                <span
                  className={`min-w-[60px] text-right text-sm tabular-nums ${
                    row.count > 0 ? "text-white font-semibold" : "text-white/30"
                  }`}
                >
                  {row.count.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => exportSummaryRow(row)}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-200"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => viewSummaryRow(row)}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08]"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
              </div>
            </li>
          ))}
          <li className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => navigate("/auditor/export")}
              className="text-xs font-medium text-brand-400 hover:text-brand-300 hover:underline"
            >
              View all export options
            </button>
          </li>
        </ul>
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-2 px-1 text-xs text-white/40">
        <Sparkles className="h-3.5 w-3.5 text-brand-400" />
        <span>
          Powered by PGC semantic crawler · last scan completed in 3 m 14 s ·{" "}
          {project.totalUrls.toLocaleString()} URLs
        </span>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "text-white"
          : "text-white/50 hover:text-white"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-3 h-0.5 rounded-full bg-gradient-to-r from-brand-400 to-amber-400" />
      )}
    </button>
  );
}
