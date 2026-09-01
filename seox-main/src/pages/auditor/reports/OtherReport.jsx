import { useMemo } from "react";
import ReportShell, { StatCard, ChartCard } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { safeSegments } from "./liveReportData.js";

export default function OtherReport() {
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const auditIssues = stats?.auditIssues || {};
  const data = useMemo(() => {
    const schemaRows = latestUrls.filter((row) =>
      Number(row.audit?.schemaErrorCount || row.audit?.structuredDataErrorCount || 0) > 0
    );
    const richResultRows = latestUrls.filter((row) =>
      Number(row.audit?.richResultErrorCount || 0) > 0
    );
    const issueSchemaCount = Number(auditIssues?.["schema-errors"]?.crawled || auditIssues?.["structured-data-errors"]?.crawled || 0);
    const issueRichCount = Number(auditIssues?.["rich-results-errors"]?.crawled || 0);
    const schemaErrors = issueSchemaCount || schemaRows.length;
    const richResultsErrors = issueRichCount || richResultRows.length;

    return {
      schemaErrors,
      richResultsErrors,
      trafficDropped: 0,
      pagesDropped: 0,
      segments: safeSegments([
        { label: "Schema.org errors", value: schemaErrors, color: "#f97316" },
        { label: "Rich results errors", value: richResultsErrors, color: "#f43f5e" },
      ].filter((item) => item.value > 0)),
    };
  }, [auditIssues, latestUrls]);

  return (
    <ReportShell title="Other">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Schema errors" value={data.schemaErrors} accent="amber" />
        <StatCard label="Traffic dropped" value={data.trafficDropped} accent="rose" />
        <StatCard label="Pages dropped" value={data.pagesDropped} accent="amber" />
        <StatCard label="Rich results errors" value={data.richResultsErrors} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Structured data issues" hint>
          <DonutChart
            segments={data.segments}
            size={170}
          />
        </ChartCard>
        <ChartCard title="Traffic & ranking changes" hint>
          <DonutChart
            segments={[
              { label: "No connected rank or traffic data", value: 0, color: "#64748b" },
            ]}
            size={170}
          />
        </ChartCard>
      </div>
    </ReportShell>
  );
}
