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
import { track } from "../lib/analytics.js";

export default function Hero() {
  return (
    <section className="landing-section is-hero relative overflow-hidden pt-14 pb-20 sm:pt-20">
      {/* Animated orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-bg absolute inset-0 opacity-60" />
      </div>

      <div className="container-px text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="landing-eyebrow mx-auto mb-8"
        >
          <span className="landing-eyebrow-dot" />
          The 2026 Intelligence Framework Is Live
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="landing-hero-title"
        >
          Master the AI Search
          <br />
          with <span className="landing-accent">Semantic Intelligence</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="landing-hero-sub mx-auto mt-7 max-w-2xl"
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
            className="ui-button ui-button-primary landing-cta group"
          >
            <Sparkles className="h-4 w-4" />
            Start Your Free Audit
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#features"
            onClick={() => track("cta_click", { location: "hero", action: "watch_demo" })}
            className="ui-button ui-button-secondary landing-cta"
          >
            <PlayCircle className="h-4 w-4" />
            Watch Demo
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="landing-trust mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> 14-day free trial
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Cancel anytime
          </span>
        </motion.div>

        {/* Floating preview dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="landing-preview relative overflow-hidden">
            {/* Window chrome */}
            <div className="landing-preview-bar flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="landing-dot landing-dot-red" />
                <span className="landing-dot landing-dot-amber" />
                <span className="landing-dot landing-dot-green" />
              </div>
              <div className="landing-preview-url hidden items-center gap-2 sm:flex">
                <Search className="h-3.5 w-3.5" /> app.pgc.edu/dashboard
              </div>
              <span className="landing-live">
                <span className="landing-live-dot" /> LIVE
              </span>
            </div>
            {/* Body */}
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <div className="landing-tile p-4">
                <div className="landing-tile-head flex items-center justify-between">
                  <span>Organic Traffic</span>
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <div className="landing-tile-value mt-2">
                  248K <span className="landing-delta-up">+34%</span>
                </div>
                <div className="mt-3 h-12 w-full overflow-hidden">
                  <Sparkline />
                </div>
              </div>
              <div className="landing-tile is-accent p-4">
                <div className="landing-tile-head flex items-center justify-between">
                  <span>SEO Health Score</span>
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="landing-tile-value is-brand mt-2 flex items-end gap-1">
                  92<span className="landing-tile-unit">/100</span>
                </div>
                <div className="landing-meter mt-3">
                  <div className="landing-meter-fill" style={{ width: "92%" }} />
                </div>
              </div>
              <div className="landing-tile p-4">
                <div className="landing-tile-head flex items-center justify-between">
                  <span>Tracked Keywords</span>
                  <Search className="h-3.5 w-3.5" />
                </div>
                <div className="landing-tile-value mt-2">12,840</div>
                <div className="mt-3 flex items-center gap-1">
                  <span className="landing-pill is-up">↑ 412</span>
                  <span className="landing-pill is-down">↓ 38</span>
                  <span className="landing-pill-note">vs last week</span>
                </div>
              </div>
            </div>
            {/* Bottom row */}
            <div className="landing-preview-foot p-5 sm:p-6">
              <div className="landing-tile-head mb-3 flex items-center justify-between">
                <span>Top Performing Entities</span>
                <span className="landing-foot-link">View all →</span>
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
          <stop offset="0" stopColor="#df3c27" stopOpacity="0.6" />
          <stop offset="1" stopColor="#df3c27" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 38 L20 32 L40 36 L60 26 L80 30 L100 18 L120 22 L140 12 L160 16 L180 8 L200 12 L200 50 L0 50 Z"
        fill="url(#sl)"
      />
      <path
        d="M0 38 L20 32 L40 36 L60 26 L80 30 L100 18 L120 22 L140 12 L160 16 L180 8 L200 12"
        fill="none"
        stroke="#df3c27"
        strokeWidth="2"
      />
    </svg>
  );
}

function EntityRow({ name, score, delta }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="landing-entity-name w-32 truncate sm:w-48">{name}</span>
      <div className="landing-meter relative flex-1">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="landing-meter-fill"
        />
      </div>
      <span className="landing-entity-score w-10 text-right">{score}</span>
      <span className="landing-pill is-up w-12 text-right">{delta}</span>
    </div>
  );
}
