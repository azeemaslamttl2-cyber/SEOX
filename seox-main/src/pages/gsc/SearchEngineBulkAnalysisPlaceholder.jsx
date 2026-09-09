import { ExternalLink, Search } from "lucide-react";
import BulkAnalysisToggle from "../../semanticsx/components/BulkAnalysisToggle.jsx";

const engineMeta = {
  bing: {
    label: "Bing Bulk Analysis",
    service: "Bing Webmaster Tools",
    url: "https://www.bing.com/webmasters",
  },
  yandex: {
    label: "Yandex Bulk Analysis",
    service: "Yandex Webmaster",
    url: "https://webmaster.yandex.com",
  },
};

export default function SearchEngineBulkAnalysisPlaceholder({ engine }) {
  const meta = engineMeta[engine] || engineMeta.bing;

  return (
    <section className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-white">{meta.label}</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Bulk search performance analysis for {meta.service}.
          </p>
        </div>
        <BulkAnalysisToggle />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
        <Search className="mx-auto h-10 w-10 text-white/25" />
        <h2 className="mt-4 font-display text-xl font-bold text-white">{meta.service} connection required</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/45">
          Connect and import verified properties from {meta.service} to run bulk analysis for this search engine.
        </p>
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:shadow-[0_12px_36px_-8px_rgba(249,115,22,0.6)]"
        >
          Open {meta.service}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
