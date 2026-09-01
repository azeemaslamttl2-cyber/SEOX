import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronDown, Code2, Download, Filter } from "lucide-react";
import IssueTable from "../../components/auditor/IssueTable.jsx";
import { useAuditData } from "../../hooks/useAuditData.js";

export default function AuditorIssues() {
  const [tab, setTab] = useState("actual");
  const [searchParams, setSearchParams] = useSearchParams();
  const { issueCategories } = useAuditData();
  const searchQuery = searchParams.get("q")?.trim() || "";

  const tabs = useMemo(() => {
    const rows = issueCategories.flatMap((cat) =>
      cat.subgroups ? cat.subgroups.flatMap((group) => group.items) : cat.items
    );
    return [
      {
        key: "actual",
        label: "Actual",
        count: rows.filter((item) => (item.crawled || 0) > 0).length,
      },
      { key: "new", label: "New", count: rows.filter((item) => item.isNew).length },
      { key: "all", label: "All tracked", count: rows.length },
      { key: "off", label: "Turned off", count: 0 },
    ];
  }, [issueCategories]);

  // Filter rows per tab
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return issueCategories.map((cat) => {
      const filterItems = (items) =>
        items.filter((it) => {
          if (
            query &&
            !`${it.title || ""} ${it.slug || ""} ${(it.urls || []).map((url) => url.url).join(" ")}`
              .toLowerCase()
              .includes(query)
          ) {
            return false;
          }
          if (tab === "actual") return (it.crawled || 0) > 0;
          if (tab === "new") return it.isNew;
          if (tab === "off") return false;
          return true;
        });
      if (cat.subgroups) {
        return {
          ...cat,
          subgroups: cat.subgroups
            .map((g) => ({ ...g, items: filterItems(g.items) }))
            .filter((g) => g.items.length > 0),
        };
      }
      return { ...cat, items: filterItems(cat.items) };
    });
  }, [issueCategories, searchQuery, tab]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="auditor-hero flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight">
            <AlertTriangle className="h-5 w-5" />All issues</h1>
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300">
            {tabs.find((item) => item.key === "actual")?.count || 0}
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60 hover:bg-white/[0.08] hover:text-white"
            >
              Search: {searchQuery} x
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-800/60 px-3 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-white/[0.08] text-white"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {t.label}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  tab === t.key
                    ? "bg-brand-500/20 text-brand-200"
                    : "bg-white/5 text-white/50"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
          <button className="ml-2 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.04]">
            <Filter className="h-3.5 w-3.5" /> Importance <ChevronDown className="h-3 w-3" />
          </button>
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

      {/* Categories */}
      <div className="space-y-6">
        {filtered.map((cat) => {
          const hasContent = cat.subgroups
            ? cat.subgroups.length > 0
            : cat.items.length > 0;
          if (!hasContent) return null;
          return (
            <section
              key={cat.title}
              className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur"
            >
              <header className="border-b border-white/10 px-4 py-3">
                <h2 className="font-display text-sm font-bold tracking-wide text-white">
                  {cat.title}
                </h2>
              </header>
              {cat.subgroups ? (
                cat.subgroups.map((group) => (
                  <div key={group.label}>
                    <div className="border-b border-white/[0.05] bg-white/[0.015] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {group.label}
                    </div>
                    <IssueTable rows={group.items} />
                  </div>
                ))
              ) : (
                <IssueTable rows={cat.items} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
