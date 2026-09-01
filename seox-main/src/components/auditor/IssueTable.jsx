import { Link } from "react-router-dom";
import { HelpCircle, MoreVertical } from "lucide-react";
import SeverityIcon from "./SeverityIcon.jsx";
import Sparkline from "./Sparkline.jsx";

function ChangeCell({ value }) {
  if (value === undefined || value === null || value === 0)
    return <span className="text-white/30">0</span>;
  const pos = value > 0;
  return (
    <span
      className={`tabular-nums font-semibold ${pos ? "text-rose-400" : "text-emerald-400"}`}
    >
      {pos ? value : Math.abs(value)}{" "}
      <span className="text-[10px]">{pos ? "▲" : "▼"}</span>
    </span>
  );
}

function ColoredCell({ value, color = "white" }) {
  if (value === undefined || value === null || value === 0)
    return <span className="text-white/30">0</span>;
  const cls = {
    red: "text-rose-400",
    green: "text-emerald-400",
    white: "text-white",
  }[color];
  return <span className={`font-semibold tabular-nums ${cls}`}>{value}</span>;
}

export default function IssueTable({ rows, sparkColor }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
            <th className="px-4 py-3 font-medium">Issue</th>
            <th className="px-3 py-3 text-right font-medium">Crawled</th>
            <th className="px-3 py-3 text-right font-medium">Change</th>
            <th className="px-3 py-3 text-right font-medium">Added</th>
            <th className="px-3 py-3 text-right font-medium">New</th>
            <th className="px-3 py-3 text-right font-medium">Removed</th>
            <th className="px-3 py-3 text-right font-medium">Missing</th>
            <th className="px-3 py-3 text-right font-medium">Trend</th>
            <th className="w-8 py-3" />
            <th className="w-8 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const inner = (
              <span className="flex items-center gap-2">
                <SeverityIcon severity={r.severity} fixable={r.fixable} />
                <span
                  className={`truncate ${
                    r.severity === "error"
                      ? "text-white"
                      : r.severity === "warning"
                      ? "text-white"
                      : "text-white/85"
                  } ${r.crawled > 0 ? "" : "text-white/40"}`}
                >
                  {r.title}
                </span>
                {r.isNew && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    New
                  </span>
                )}
              </span>
            );
            return (
              <tr
                key={i}
                className="group border-b border-white/[0.05] transition-colors hover:bg-white/[0.025]"
              >
                <td className="max-w-[340px] px-4 py-2.5">
                  {r.slug ? (
                    <Link
                      to={`/auditor/issues/${r.slug}`}
                      className="hover:underline"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ColoredCell value={r.crawled} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ChangeCell value={r.change} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ColoredCell value={r.added} color="red" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ColoredCell value={r.new} color="red" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ColoredCell value={r.removed} color="green" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <ColoredCell value={r.missing} color="green" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end">
                    <Sparkline values={r.spark} color={sparkColor || "#f97316"} />
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <HelpCircle className="h-4 w-4 text-white/25 transition-colors hover:text-white/60" />
                </td>
                <td className="py-2.5 text-right">
                  <button className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
