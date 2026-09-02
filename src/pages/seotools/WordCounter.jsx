import { useState, useMemo } from "react";
import { Hash } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

export default function WordCounter() {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const t = text.trim();
    const words = t ? t.split(/\s+/).length : 0;
    const chars = text.length;
    const sentences = t ? (t.match(/[.!?]+/g) || []).length : 0;
    const paragraphs = t ? t.split(/\n\s*\n/).filter(Boolean).length : 0;
    const reading = Math.max(0, Math.ceil(words / 200));
    return { words, chars, sentences, paragraphs, reading };
  }, [text]);

  const cards = [
    { label: "Words", value: stats.words, color: "text-emerald-300" },
    { label: "Characters", value: stats.chars, color: "text-cyan-300" },
    { label: "Sentences", value: stats.sentences, color: "text-sky-300" },
    { label: "Paragraphs", value: stats.paragraphs, color: "text-violet-300" },
    { label: "Reading", value: `${stats.reading} min`, color: "text-teal-300" },
  ];

  return (
    <div className="space-y-4">
      <ToolHeader title="Word Counter" Icon={Hash} gradient="from-slate-800 via-emerald-800 to-teal-700" subtitle="Count words, characters, sentences, and reading time" />

      <div className="stool-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="ctool-textarea"
          placeholder="Paste or type your text here..."
        />

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="stool-well text-center">
              <div className={`font-display text-2xl font-black ${c.color}`}>{c.value}</div>
              <div className="ctool-help-text mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
