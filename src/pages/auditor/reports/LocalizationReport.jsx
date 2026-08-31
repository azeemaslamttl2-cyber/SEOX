import ReportShell, { StatCard, ChartCard } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { issueGroupsForCategory, issueRowsForGroups, TrackedIssuesPanel } from "../../../lib/auditor/reports/ReportInsights.jsx";
import { htmlRows } from "../../../lib/auditor/reports/liveReportData.js";

export default function LocalizationReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const pages = htmlRows(stats?.latestUrls || []);
  const hasHreflangSignal = pages.some((row) => Array.isArray(row.hreflangs) || Array.isArray(row.audit?.hreflangs));
  const hasHtmlLangSignal = pages.some((row) => "htmlLang" in row || "htmlLang" in (row.audit || {}));
  const hreflangsByPage = pages.map((row) => row.hreflangs || row.audit?.hreflangs || []);
  const pagesWithHreflang = hasHreflangSignal ? hreflangsByPage.filter((items) => items.length > 0).length : 0;
  const pagesMissingHreflang = hasHreflangSignal ? Math.max(0, pages.length - pagesWithHreflang) : 0;
  const uniqueHreflangs = new Set(hreflangsByPage.flat().map((item) => item.lang || item.hreflang || item).filter(Boolean)).size;
  const htmlLangFound = hasHtmlLangSignal ? pages.filter((row) => row.htmlLang || row.audit?.htmlLang).length : 0;
  const htmlLangMissing = hasHtmlLangSignal ? Math.max(0, pages.length - htmlLangFound) : 0;
  const issueGroups = issueGroupsForCategory(issueCategories.find((category) => category.title === "Localization"));
  const issueRows = issueRowsForGroups(issueGroups);

  return (
    <ReportShell title="Localization">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={issueRows} groups={issueGroups} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Pages with hreflang" value={pagesWithHreflang} accent="brand" />
              <StatCard label="Pages missing hreflang" value={pagesMissingHreflang} accent="brand" />
              <StatCard label="Unique hreflangs" value={uniqueHreflangs} accent="brand" />
              <StatCard label="Hreflang clusters" value={pagesWithHreflang} accent="brand" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Hreflang tags" hint>
                {hasHreflangSignal ? (
                  <DonutChart
                    segments={[
                      { label: "Has hreflang", value: pagesWithHreflang, color: "#34d399" },
                      { label: "Missing hreflang", value: pagesMissingHreflang, color: "#fbbf24" },
                    ]}
                    size={170}
                  />
                ) : (
                  <NoData />
                )}
              </ChartCard>
              <ChartCard title="Non-indexable pages declared as hreflang" hint>
                <NoData />
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Hreflang issues distribution" hint>
                <NoData />
              </ChartCard>
              <ChartCard title="HTML lang tags status" hint>
                {hasHtmlLangSignal ? (
                  <DonutChart
                    segments={[
                      { label: "Found", value: htmlLangFound, color: "#34d399" },
                      { label: "Missing", value: htmlLangMissing, color: "#fbbf24" },
                    ]}
                    size={170}
                  />
                ) : (
                  <NoData />
                )}
              </ChartCard>
            </div>
          </div>
        )
      }
    </ReportShell>
  );
}

function NoData() {
  return (
    <div className="flex h-44 items-center justify-center">
      <span className="rounded-md bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
        No data
      </span>
    </div>
  );
}
