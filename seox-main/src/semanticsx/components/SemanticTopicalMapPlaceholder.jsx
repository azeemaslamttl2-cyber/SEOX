import { Layers, Sparkles } from "lucide-react";

export default function SemanticTopicalMapPlaceholder() {
  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-white/[0.08] bg-ink-800/80 p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black text-white">Semantic Topical Map</h1>
          <p className="text-sm text-white/45">Imported as a SemanticsX roadmap feature.</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <Sparkles className="h-4 w-4" />
          In development
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          The SemanticsX source included this feature as a coming-soon route. AI Smart Seo now keeps the route
          and navigation entry ready alongside the imported resources and AI agents.
        </p>
      </div>
    </div>
  );
}
