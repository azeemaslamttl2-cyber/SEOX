import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  PlayCircle,
  ShieldCheck,
  Zap,
  Sparkles,
  Bot,
  TrendingUp,
  Search,
} from "lucide-react";
import { track } from "../lib/firebase.js";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20">
      {/* Animated orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-bg absolute inset-0 opacity-50" />
        <div className="absolute left-[10%] top-20 h-72 w-72 animate-float rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute right-[10%] top-40 h-72 w-72 animate-float-slow rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      <div className="container-px text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-brand-300 shadow-brand-glow"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
          </span>
          The 2026 Intelligence Framework Is Live
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-[88px]"
        >
          Master the AI Search
          <br />
          with <span className="gradient-text">Semantic Intelligence</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-7 max-w-2xl text-base text-white/65 sm:text-lg"
        >
          60+ advanced SEO tools engineered into a single architectural framework.
          Leverage deep NLP models and entity extraction to outpace the competition.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            to="/tech-seo/eeat"
            onClick={() => track("cta_click", { location: "hero", action: "start_free_audit" })}
            className="btn-primary group"
          >
            <Sparkles className="h-4 w-4" />
            Start Your Free Audit
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#features"
            onClick={() => track("cta_click", { location: "hero", action: "watch_demo" })}
            className="btn-ghost"
          >
            <PlayCircle className="h-4 w-4" />
            Watch Demo
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-brand-400" /> No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-brand-400" /> 14-day free trial
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-brand-400" /> Cancel anytime
          </span>
        </motion.div>

        {/* Floating preview dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-r from-brand-500/40 via-emerald-500/20 to-brand-600/40 opacity-60 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800/80 backdrop-blur-2xl">
            {/* Window chrome */}
            <div className="flex items-center justify-between border-b border-white/10 bg-ink-700/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-ink-900/60 px-4 py-1.5 text-xs text-white/50 sm:flex">
                <Search className="h-3.5 w-3.5" /> app.aismartseo.com/dashboard
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE
              </span>
            </div>
            {/* Body */}
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Organic Traffic</span>
                  <TrendingUp className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <div className="mt-2 text-2xl font-bold">
                  248K <span className="text-xs font-medium text-emerald-400">+34%</span>
                </div>
                <div className="mt-3 h-12 w-full overflow-hidden">
                  <Sparkline />
                </div>
              </div>
              <div className="rounded-xl border border-brand-500/30 bg-gradient-to-b from-brand-500/10 to-transparent p-4">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>SEO Health Score</span>
                  <Bot className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <div className="mt-2 flex items-end gap-1 text-3xl font-bold text-brand-300">
                  92<span className="text-base text-white/40">/100</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400"
                    style={{ width: "92%" }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Tracked Keywords</span>
                  <Search className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <div className="mt-2 text-2xl font-bold">12,840</div>
                <div className="mt-3 flex items-center gap-1 text-xs">
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                    ↑ 412
                  </span>
                  <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-rose-400">↓ 38</span>
                  <span className="text-white/40">vs last week</span>
                </div>
              </div>
            </div>
            {/* Bottom row */}
            <div className="border-t border-white/10 bg-white/[0.01] p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between text-xs text-white/50">
                <span>Top Performing Entities</span>
                <span className="text-brand-400">View all →</span>
              </div>
              <EntityRow name="machine learning" score={94} delta="+12" />
              <EntityRow name="semantic search" score={88} delta="+9" />
              <EntityRow name="vector embeddings" score={82} delta="+15" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 200 50" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sl" x1="0" y1="0" x2="0" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7ABDBC" stopOpacity="0.6" />
          <stop offset="1" stopColor="#7ABDBC" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 38 L20 32 L40 36 L60 26 L80 30 L100 18 L120 22 L140 12 L160 16 L180 8 L200 12 L200 50 L0 50 Z"
        fill="url(#sl)"
      />
      <path
        d="M0 38 L20 32 L40 36 L60 26 L80 30 L100 18 L120 22 L140 12 L160 16 L180 8 L200 12"
        fill="none"
        stroke="#7ABDBC"
        strokeWidth="2"
      />
    </svg>
  );
}

function EntityRow({ name, score, delta }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-32 truncate text-sm font-medium text-white/80 sm:w-48">{name}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400"
        />
      </div>
      <span className="w-10 text-right text-sm font-bold text-white/90">{score}</span>
      <span className="w-12 rounded-md bg-emerald-500/10 px-2 py-0.5 text-right text-xs text-emerald-400">
        {delta}
      </span>
    </div>
  );
}
