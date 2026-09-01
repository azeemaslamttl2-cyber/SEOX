import { useMemo } from "react";
import ReportShell, { ChartCard } from "../../../components/auditor/ReportShell.jsx";
import DonutChart from "../../../components/auditor/DonutChart.jsx";
import { useAuditData } from "../../../hooks/useAuditData.js";
import { useCrawl } from "../../../context/CrawlContext.jsx";
import { TrackedIssuesPanel } from "./ReportInsights.jsx";

function isHtmlContentType(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  if (/text\/html|application\/xhtml/i.test(ct)) return true;
  if (!ct) {
    try {
      return !/\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|avif|bmp|xml|json|woff2?|ttf|eot|pdf|zip)$/i.test(new URL(url).pathname);
    } catch {
      return true;
    }
  }
  return false;
}

function countWords(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function bucketCount(items, ranges) {
  return ranges.map((range) => ({
    ...range,
    value: items.filter((value) => value >= range.min && value <= range.max).length,
  }));
}

export default function ContentReport() {
  const { issueCategories } = useAuditData();
  const { stats } = useCrawl();
  const latestUrls = stats?.latestUrls || [];
  const contentGroups =
    issueCategories
      .find((category) => category.title === "Content")
      ?.subgroups?.map((group) => ({
        label: group.label,
        rows: group.items || [],
      })) || [];
  const allContentRows = contentGroups.flatMap((group) => group.rows);
  const liveContent = useMemo(() => {
    const pages = latestUrls.filter((row) => row.url && isHtmlContentType(row.contentType, row.url));
    const wordCounts = pages.map((row) => Number(row.audit?.wordCount) || countWords(row.contentText));
    const titleRows = pages.map((row) => {
      const title = String(row.title || row.audit?.titleText || "");
      return {
        count: Number.isFinite(Number(row.audit?.titleCount)) ? Number(row.audit?.titleCount) : title.trim() ? 1 : 0,
        length: Number(row.audit?.titleLength) || title.length,
      };
    });
    const metaRows = pages.map((row) => {
      const meta = String(row.metaDescription || row.audit?.metaDescriptionText || "");
      return {
        count: Number.isFinite(Number(row.audit?.metaDescriptionCount)) ? Number(row.audit?.metaDescriptionCount) : meta.trim() ? 1 : 0,
        length: Number(row.audit?.metaDescriptionLength) || meta.length,
      };
    });
    const h1Rows = pages.map((row) => {
      const h1 = String(row.h1 || row.audit?.h1Text || "");
      return {
        count: Number.isFinite(Number(row.audit?.h1Count)) ? Number(row.audit?.h1Count) : h1.trim() ? 1 : 0,
        length: h1.length,
      };
    });

    return {
      wordBuckets: bucketCount(wordCounts, [
        { range: "0", min: 0, max: 0 },
        { range: "1-25", min: 1, max: 25 },
        { range: "26-50", min: 26, max: 50 },
        { range: "51-100", min: 51, max: 100 },
        { range: "101-250", min: 101, max: 250 },
        { range: "251-500", min: 251, max: 500 },
        { range: "501-1000", min: 501, max: 1000 },
        { range: "1001+", min: 1001, max: Number.MAX_SAFE_INTEGER },
      ]),
      titleSetup: [
        { label: "Only one", value: titleRows.filter((row) => row.count === 1).length, color: "#34d399" },
        { label: "More than one", value: titleRows.filter((row) => row.count > 1).length, color: "#fbbf24" },
        { label: "Missing or empty", value: titleRows.filter((row) => row.count === 0).length, color: "#f43f5e" },
      ],
      titleLength: [
        { label: "Optimal: 15-70 ch.", value: titleRows.filter((row) => row.count > 0 && row.length >= 15 && row.length <= 70).length, color: "#34d399" },
        { label: "Too short: <15 ch.", value: titleRows.filter((row) => row.count > 0 && row.length < 15).length, color: "#fbbf24" },
        { label: "Too long: >70 ch.", value: titleRows.filter((row) => row.count > 0 && row.length > 70).length, color: "#f97316" },
      ],
      metaSetup: [
        { label: "Only one", value: metaRows.filter((row) => row.count === 1).length, color: "#34d399" },
        { label: "More than one", value: metaRows.filter((row) => row.count > 1).length, color: "#fbbf24" },
        { label: "Missing or empty", value: metaRows.filter((row) => row.count === 0).length, color: "#f43f5e" },
      ],
      metaLength: [
        { label: "Optimal: 100-300 ch.", value: metaRows.filter((row) => row.count > 0 && row.length >= 100 && row.length <= 300).length, color: "#34d399" },
        { label: "Too short: <100 ch.", value: metaRows.filter((row) => row.count > 0 && row.length < 100).length, color: "#fbbf24" },
        { label: "Too long: >300 ch.", value: metaRows.filter((row) => row.count > 0 && row.length > 300).length, color: "#f97316" },
      ],
      h1Setup: [
        { label: "Only one", value: h1Rows.filter((row) => row.count === 1).length, color: "#34d399" },
        { label: "More than one", value: h1Rows.filter((row) => row.count > 1).length, color: "#fbbf24" },
        { label: "Missing or empty", value: h1Rows.filter((row) => row.count === 0).length, color: "#f43f5e" },
      ],
      h1Length: [
        { label: "Too short: <20 ch.", value: h1Rows.filter((row) => row.count > 0 && row.length < 20).length, color: "#fbbf24" },
        { label: "Optimal: 20-70 ch.", value: h1Rows.filter((row) => row.count > 0 && row.length >= 20 && row.length <= 70).length, color: "#34d399" },
        { label: "Too long: >70 ch.", value: h1Rows.filter((row) => row.count > 0 && row.length > 70).length, color: "#f97316" },
      ],
    };
  }, [latestUrls]);

  return (
    <ReportShell title="Content">
      {(tab) =>
        tab === "Issues" ? (
          <TrackedIssuesPanel rows={allContentRows} groups={contentGroups} />
        ) : (
          <div className="space-y-4">
            <ChartCard title="URLs by word count" hint>
              <WordCountHistogram buckets={liveContent.wordBuckets} />
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Title tag setup" hint>
                <DonutChart
                  segments={liveContent.titleSetup}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="Title length distribution" hint>
                <DonutChart
                  segments={liveContent.titleLength}
                  size={170}
                />
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Meta description tag setup" hint>
                <DonutChart
                  segments={liveContent.metaSetup}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="Meta description length distribution" hint>
                <DonutChart
                  segments={liveContent.metaLength}
                  size={170}
                />
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="H1 setup" hint>
                <DonutChart
                  segments={liveContent.h1Setup}
                  size={170}
                />
              </ChartCard>
              <ChartCard title="H1 length distribution" hint>
                <DonutChart
                  segments={liveContent.h1Length}
                  size={170}
                />
              </ChartCard>
            </div>
          </div>
        )
      }
    </ReportShell>
  );
}

function WordCountHistogram({ buckets }) {
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-2">
        {buckets.map((bucket) => (
          <div key={bucket.range} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-500/40 to-amber-400 transition-all"
              style={{ height: `${(bucket.value / max) * 100}%`, minHeight: 4 }}
              title={`${bucket.value} URLs`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {buckets.map((bucket) => (
          <span key={bucket.range} className="flex-1 text-center text-[10px] text-white/45">
            {bucket.range}
          </span>
        ))}
      </div>
    </div>
  );
}
