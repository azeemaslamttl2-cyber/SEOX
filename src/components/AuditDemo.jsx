"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  User,
  GraduationCap,
  Award,
  Shield,
  Loader2,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { track } from "../lib/analytics.js";

const audits = [
  {
    icon: User,
    name: "Experience",
    desc: "First-hand content signals",
    score: 88,
    color: "from-brand-500 to-amber-400",
    text: "text-brand-300",
    border: "border-brand-500/40",
  },
  {
    icon: GraduationCap,
    name: "Expertise",
    desc: "Knowledge depth & credentials",
    score: 92,
    color: "from-amber-500 to-orange-400",
    text: "text-amber-300",
    border: "border-amber-500/40",
  },
  {
    icon: Award,
    name: "Authority",
    desc: "Backlink quality & domain trust",
    score: 76,
    color: "from-orange-500 to-rose-400",
    text: "text-orange-300",
    border: "border-orange-500/40",
  },
  {
    icon: Shield,
    name: "Trust",
    desc: "HTTPS, citations & transparency",
    score: 95,
    color: "from-yellow-400 to-brand-500",
    text: "text-yellow-300",
    border: "border-yellow-500/40",
  },
];

export default function AuditDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!inView) return;
    setRunning(true);
    setProgress(0);
    track("audit_demo_started", { location: "audit_section" });
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          setRunning(false);
          track("audit_demo_completed", { location: "audit_section" });
          return 100;
        }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <section id="audit" className="py-20 sm:py-28">
      <div className="container-px text-center">
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Live Demo
        </span>
        <h2 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          See Our <span className="gradient-text">E-E-A-T Audit</span> in Action
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-white/60">
          Watch our scanner analyze any website for Experience, Expertise, Authority and Trust
          signals — in real-time.
        </p>
      </div>

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="container-px mt-12"
      >
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute -inset-3 rounded-[24px] bg-gradient-to-r from-brand-500/30 via-amber-400/20 to-orange-500/30 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800/80 shadow-2xl backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-ink-700/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-sm font-medium text-white/70">
                  E-E-A-T Audit Scanner
                </span>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  running
                    ? "bg-brand-500/15 text-brand-300"
                    : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {running ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Running Audit
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Complete
                  </>
                )}
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              {/* URL bar */}
              <div>
                <label className="mb-1.5 block text-center text-xs uppercase tracking-wider text-white/40">
                  Target URL
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <div className="flex h-12 items-center rounded-xl border border-white/10 bg-ink-900/60 pl-11 pr-4 font-mono text-sm text-white/80">
                    https://bigtechies.com
                    <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-brand-400" />
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-brand-400" />
                    Crawling 184 pages, 2,341 entities
                  </span>
                  <span className="font-mono text-brand-300">{progress}%</span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500 bg-[length:200%_100%]"
                    style={{
                      width: `${progress}%`,
                      animation: "gradient-x 2s linear infinite",
                    }}
                  />
                </div>
              </div>

              {/* Results */}
              <div>
                <div className="mb-3 text-center text-xs uppercase tracking-wider text-white/40">
                  Audit Results
                </div>
                <div className="space-y-3">
                  {audits.map((a, i) => (
                    <ResultRow key={a.name} a={a} index={i} inView={inView} />
                  ))}
                </div>
              </div>

              {/* Footer summary */}
              <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
                <Stat label="Issues Found" value="12" tone="text-rose-400" />
                <Stat label="Optimizations" value="34" tone="text-amber-300" />
                <Stat label="Overall Score" value="87/100" tone="text-brand-300" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function ResultRow({ a, index, inView }) {
  const Icon = a.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.4 + index * 0.15 }}
      className={`group rounded-xl border ${a.border} bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]`}
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-gradient-to-br ${a.color} bg-opacity-20 p-2`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{a.name}</span>
            <span className={`font-mono text-lg font-bold ${a.text}`}>
              {a.score}
              <span className="text-xs font-medium text-white/40">/100</span>
            </span>
          </div>
          <p className="text-xs text-white/50">{a.desc}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${a.score}%` } : {}}
          transition={{ duration: 1.4, delay: 0.6 + index * 0.15, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${a.color}`}
        />
      </div>
    </motion.div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
