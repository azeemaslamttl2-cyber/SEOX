import { motion } from "framer-motion";
import {
  Brain,
  Link2,
  FileSearch,
  Code2,
  Gauge,
  PenLine,
  Network,
  Bot,
  Globe2,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Content Writer",
    desc: "12-step semantic engine that writes EEAT-optimized articles indistinguishable from human experts.",
    tag: "12-Step",
  },
  {
    icon: Link2,
    title: "Link Building Intelligence",
    desc: "2,900+ verified websites scored on authority, relevance and outreach probability.",
    tag: "2900+ Sites",
  },
  {
    icon: FileSearch,
    title: "On-Page SEO Optimization",
    desc: "61 real-time checks across schema, meta, content depth and entity coverage.",
    tag: "61 Checks",
  },
  {
    icon: Code2,
    title: "Schema Generator",
    desc: "Auto-generate 50+ schema types — from FAQ to Product — validated with Google's spec.",
    tag: "50+ Types",
  },
  {
    icon: Gauge,
    title: "Speed & Crawl Optimization",
    desc: "Core Web Vitals, render-blocking, JS coverage and crawl-budget intelligence in one panel.",
    tag: "Active",
  },
  {
    icon: PenLine,
    title: "Keyword Research Pro",
    desc: "Cluster 10,000 keywords by search intent in seconds using NLP topical maps.",
    tag: "NLP-Powered",
  },
  {
    icon: Network,
    title: "Internal Linking Engine",
    desc: "Automatically suggests semantic anchors using vector similarity across your entire site.",
    tag: "Vector AI",
  },
  {
    icon: Bot,
    title: "AnswerEngine Optimizer",
    desc: "Rank in ChatGPT, Perplexity, Gemini and Google AI Overviews with structured signals.",
    tag: "AEO",
  },
  {
    icon: Globe2,
    title: "Multi-language SEO",
    desc: "Hreflang validator, translation quality scoring and regional intent gap analysis.",
    tag: "94 Locales",
  },
  {
    icon: TrendingUp,
    title: "Rank Tracker 360°",
    desc: "Daily SERP monitoring across desktop, mobile, AI and voice — with intent shift alerts.",
    tag: "Daily",
  },
  {
    icon: ShieldCheck,
    title: "E-E-A-T Compliance",
    desc: "Detect missing author bios, citations, original media — fix Google's quality gaps.",
    tag: "Compliant",
  },
  {
    icon: Sparkles,
    title: "Content Refresh AI",
    desc: "Identifies decaying pages and suggests semantic updates to recover lost rankings.",
    tag: "Auto-Heal",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="container-px">
        <div className="text-center">
          <span className="chip">
            <Sparkles className="h-3.5 w-3.5" /> SEO Optimization Suite
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Complete SEO Optimizations by{" "}
            <span className="gradient-text">PGC</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            50+ professional tools covering every aspect of SEO — from technical audits to AI-powered
            content creation and link building.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: (i % 6) * 0.05 }}
                className="feature-card group"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl transition-all group-hover:bg-brand-500/25" />
                <div className="relative flex items-start justify-between">
                  <div className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/20 to-brand-500/5 p-2.5">
                    <Icon className="h-5 w-5 text-brand-300" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                    {f.tag}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{f.desc}</p>
                <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-brand-300 opacity-0 transition-opacity group-hover:opacity-100">
                  Explore tool →
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
