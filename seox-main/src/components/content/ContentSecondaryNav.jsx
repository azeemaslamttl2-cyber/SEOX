import { NavLink } from "react-router-dom";
import {
  FileText,
  Scan,
  Sparkles,
  Hash,
  Brain,
  BookOpen,
  Fingerprint,
  Network,
  PenTool,
  ShieldCheck,
  Globe,
  Zap,
} from "lucide-react";

const nav = [
  { label: "Content Writer", to: "/content/semantic-writer", icon: PenTool },
  { label: "AI Content Helper", to: "/content/ai-helper", icon: Sparkles },
  { label: "Outline Creator", to: "/content/outline", icon: FileText },
  { label: "Entities Extractor", to: "/content/entities-extractor", icon: Scan },
  { label: "Entities Generator", to: "/content/entities-generator", icon: Sparkles },
  { label: "N-Grams Extractor", to: "/content/ngrams", icon: Hash },
  { label: "NLP Extractor", to: "/content/nlp", icon: Brain },
  { label: "Grammar Generator", to: "/content/grammar", icon: BookOpen },
  { label: "Unique N-Grams", to: "/content/unique-ngrams", icon: Fingerprint },
  { label: "Skip Gram Words", to: "/content/skip-gram", icon: Network },
  { label: "Content Optimization", to: "/content/optimization", icon: PenTool },
  { label: "Semantic Generator", to: "/content/semantic-generator", icon: Zap },
  { label: "Content Analyzer", to: "/content/content-analyzer", icon: Globe },
  { label: "ChatGPT Watermark Remover", to: "/content/watermark-remover", icon: ShieldCheck },
];

export default function ContentSecondaryNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <nav className="space-y-5">
        <div>
          <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
            <PenTool className="h-3.5 w-3.5" />
            Content Creation
          </h4>
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                        isActive
                          ? "bg-teal-500/15 text-teal-300 font-semibold"
                          : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
