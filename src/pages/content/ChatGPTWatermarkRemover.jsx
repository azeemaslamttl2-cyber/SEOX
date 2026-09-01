import { useState } from "react";
import { ShieldCheck, Search, Sparkles, Eye, Minus, Eraser, Copy, Palette, ScanLine } from "lucide-react";
import { watermarkData } from "../../data/contentData.js";
import { removeAiWatermarks } from "../../lib/contentTools.js";

export default function ChatGPTWatermarkRemover() {
  const d = watermarkData;
  const [text, setText] = useState("");
  const [cleaned, setCleaned] = useState(null);
  const [stats, setStats] = useState(null);
  const [options, setOptions] = useState(d.options.map((o) => o.default));

  function handleClean() {
    if (!text.trim()) return;
    const result = removeAiWatermarks(text, {
      normalizeWhitespace: options[1] !== false,
      normalizeQuotes: options[2] === true,
    });
    setCleaned(result.cleaned);
    setStats(result.stats);
  }

  const featureIcons = { search: Search, sparkles: Sparkles, eye: Eye, minus: Minus };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-3">
          <h1 className="font-display text-xl font-black text-white">ChatGPT Watermark Remover</h1>
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </div>
        <p className="text-sm text-white/35 max-w-lg mx-auto">
          Paste text from AI systems like <span className="text-white/50">ChatGPT</span>, <span className="text-white/50">Claude</span>, <span className="text-white/50">Bard</span>, or other AI assistants to remove potential invisible watermarking characters. Our advanced AI watermark remover tool eliminates hidden <span className="text-blue-300">zero-width characters</span>, <span className="text-blue-300">invisible spaces</span>, and other <span className="text-blue-300">unicode markers</span> that might be used for AI text detection.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 gap-3">
        {d.features.map((feat, i) => {
          const Icon = featureIcons[feat.icon];
          return (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0d1117] p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-${feat.color}-500/15`}>
                  <Icon className={`h-4 w-4 text-${feat.color}-400`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white/80">{feat.title}</h3>
                  <p className="mt-0.5 text-[11px] text-white/35 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <h3 className="text-sm font-bold text-white/80 mb-2">How Does AI Watermarking Work?</h3>
        <p className="text-xs text-white/40 leading-relaxed">
          AI systems like ChatGPT may insert invisible characters or subtly modify text to create a digital "fingerprint" that can be detected later. Our tool identifies and removes these watermarks, giving you clean, undetectable text.
        </p>

        {/* Options */}
        <div className="mt-4 flex items-center gap-4">
          {d.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options[i]}
                onChange={() => { const c = [...options]; c[i] = !c[i]; setOptions(c); }}
                className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-blue-500"
              />
              <span className="text-[11px] text-white/50">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Text Input */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/60 placeholder:text-white/15 focus:outline-none focus:border-blue-500/25 resize-none"
          placeholder="Paste text from ChatGPT, Claude, or other AI systems here..."
        />

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleClean}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-blue-500/30"
          >
            <Eraser className="h-3.5 w-3.5" /> Clean Text
          </button>
          <button
            onClick={() => cleaned && navigator.clipboard.writeText(cleaned)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white/70 transition"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Cleaned Text
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white/70 transition">
            <Palette className="h-3.5 w-3.5" /> Visualize Characters
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white/70 transition">
            <ScanLine className="h-3.5 w-3.5" /> Analyze All Characters
          </button>
        </div>
      </div>

      {/* Cleaned Result */}
      {cleaned && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
          <h3 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Cleaned Text
          </h3>
          {stats && <p className="mb-2 text-xs text-emerald-200/60">Removed {stats.invisibleCount} invisible character(s). {stats.originalChars} to {stats.cleanedChars} characters.</p>}
          <div className="rounded-xl border border-white/[0.06] bg-[#010409] px-4 py-3 font-mono text-sm text-white/60 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {cleaned}
          </div>
        </div>
      )}
    </div>
  );
}
