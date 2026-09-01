import { Link } from "react-router-dom";
import { Wrench, Link2, Type, Globe, Hash, Eye, ArrowUpDown, Map, FileCode2, FileCode, Database, FileSpreadsheet, ChevronRight } from "lucide-react";

const tools = [
  { to: "/seo-tools/url-editor", label: "Ultimate URL Editor", Icon: Link2, gradient: "from-slate-700 to-cyan-700", btn: "from-cyan-600 to-sky-600" },
  { to: "/seo-tools/text-editor", label: "Universal Text Editor", Icon: Type, gradient: "from-slate-700 to-violet-700", btn: "from-violet-600 to-purple-600" },
  { to: "/seo-tools/domain-separator", label: "Domain Separator", Icon: Globe, gradient: "from-slate-700 to-sky-700", btn: "from-sky-600 to-blue-600" },
  { to: "/seo-tools/word-counter", label: "Word Counter", Icon: Hash, gradient: "from-slate-700 to-emerald-700", btn: "from-emerald-600 to-teal-600" },
  { to: "/seo-tools/bot-viewer", label: "Bot Viewer", Icon: Eye, gradient: "from-slate-700 to-indigo-700", btn: "from-indigo-600 to-blue-600" },
  { to: "/seo-tools/da-pa-checker", label: "Bulk DA/PA Checker", Icon: ArrowUpDown, gradient: "from-slate-700 to-blue-700", btn: "from-blue-600 to-indigo-600" },
  { to: "/seo-tools/sitemap-generator", label: "Sitemap Generator", Icon: Map, gradient: "from-slate-700 to-fuchsia-700", btn: "from-fuchsia-600 to-violet-600" },
  { to: "/seo-tools/robots-generator", label: "Robots.txt Generator", Icon: FileCode2, gradient: "from-slate-700 to-indigo-700", btn: "from-indigo-600 to-violet-600" },
  { to: "/seo-tools/sitemap-extractor", label: "XML Sitemap Extractor", Icon: FileCode, gradient: "from-slate-700 to-teal-700", btn: "from-teal-600 to-cyan-600" },
  { to: "/seo-tools/meta-extractor", label: "Bulk Meta Extractor", Icon: Database, gradient: "from-slate-700 to-violet-700", btn: "from-violet-600 to-indigo-600" },
  { to: "/seo-tools/csv-reporter", label: "Bulk CSV Reporter", Icon: FileSpreadsheet, gradient: "from-slate-700 to-emerald-700", btn: "from-teal-600 to-emerald-600" },
];

export default function SeoToolsHub() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-800 to-blue-800 p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_-20%,rgba(255,255,255,0.15),transparent)]" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <Wrench className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-white">SEO Tools</h1>
            <p className="text-sm text-white/65">A collection of essential SEO utilities for professionals</p>
          </div>
        </div>
      </div>

      {/* Tool Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.Icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 transition-all hover:border-white/15 hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Ambient glow */}
              <div className={`pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${tool.gradient} opacity-10 blur-3xl transition-opacity group-hover:opacity-20`} />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-white/85">{tool.label}</h3>
                <div className={`mt-4 flex items-center gap-1 rounded-full bg-gradient-to-r ${tool.btn} px-4 py-1.5 text-[11px] font-bold text-white shadow-md transition group-hover:gap-2`}>
                  Go to Tool <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
