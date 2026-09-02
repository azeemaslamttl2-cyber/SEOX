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
    <div className="ctool-page space-y-5">
      {/* Header */}
      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <span className="ctool-hero-icon">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">ChatGPT Watermark Remover</h1>
        <p className="ctool-subtitle">
          Paste text from AI systems like <span className="ctool-em">ChatGPT</span>, <span className="ctool-em">Claude</span>, <span className="ctool-em">Bard</span>, or other AI assistants to remove potential invisible watermarking characters. Our advanced AI watermark remover tool eliminates hidden <span className="ctool-em">zero-width characters</span>, <span className="ctool-em">invisible spaces</span>, and other <span className="ctool-em">unicode markers</span> that might be used for AI text detection.
        </p>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 gap-3">
        {d.features.map((feat, i) => {
          const Icon = featureIcons[feat.icon];
          return (
            <div key={i} className="ctool-card">
              <div className="flex items-start gap-3">
                <div className="ctool-empty-icon h-9 w-9">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="ctool-card-title">{feat.title}</h3>
                  <p className="ctool-help-text mt-0.5">{feat.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="ctool-card">
        <h3 className="ctool-card-title mb-2">How Does AI Watermarking Work?</h3>
        <p className="ctool-help-text">
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
                className="ctool-checkbox"
              />
              <span className="ctool-help-text">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Text Input */}
      <div className="ctool-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="ctool-textarea"
          placeholder="Paste text from ChatGPT, Claude, or other AI systems here..."
        />

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleClean}
            className="ui-button ui-button-primary"
          >
            <Eraser className="h-3.5 w-3.5" /> Clean Text
          </button>
          <button
            onClick={() => cleaned && navigator.clipboard.writeText(cleaned)}
            className="ui-button ctool-tool-btn"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Cleaned Text
          </button>
          <button className="ui-button ctool-tool-btn">
            <Palette className="h-3.5 w-3.5" /> Visualize Characters
          </button>
          <button className="ui-button ctool-tool-btn">
            <ScanLine className="h-3.5 w-3.5" /> Analyze All Characters
          </button>
        </div>
      </div>

      {/* Cleaned Result */}
      {cleaned && (
        <div className="ctool-card ctool-card-success">
          <h3 className="ctool-success-title mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Cleaned Text
          </h3>
          {stats && <p className="ctool-help-text mb-2">Removed {stats.invisibleCount} invisible character(s). {stats.originalChars} to {stats.cleanedChars} characters.</p>}
          <div className="ctool-output max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {cleaned}
          </div>
        </div>
      )}
    </div>
  );
}
