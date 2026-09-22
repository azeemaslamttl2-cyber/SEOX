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
  },
  {
    icon: GraduationCap,
    name: "Expertise",
    desc: "Knowledge depth & credentials",
    score: 92,
  },
  {
    icon: Award,
    name: "Authority",
    desc: "Backlink quality & domain trust",
    score: 76,
  },
  {
    icon: Shield,
    name: "Trust",
    desc: "HTTPS, citations & transparency",
    score: 95,
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
    <section id="audit" className="landing-section is-demo py-20 sm:py-28">
      <div className="container-px text-center">
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Live Demo
        </span>
        <h2 className="landing-section-title mt-5">
          See Our <span className="landing-accent">E-E-A-T Audit</span> in Action
        </h2>
        <p className="landing-section-sub mx-auto mt-4 max-w-2xl">
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
          <div className="landing-preview relative overflow-hidden">
            {/* Header */}
            <div className="landing-preview-bar flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="landing-dot landing-dot-red" />
                <span className="landing-dot landing-dot-amber" />
                <span className="landing-dot landing-dot-green" />
                <span className="landing-preview-title ml-3">E-E-A-T Audit Scanner</span>
              </div>
              <span className={`landing-run-state ${running ? "is-running" : "is-done"}`}>
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
                <label className="landing-demo-label">Target URL</label>
                <div className="relative">
                  <Search className="landing-demo-icon absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <div className="landing-demo-url">
                    https://bigtechies.com
                    <span className="landing-caret" />
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="landing-tile-head mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    Crawling 184 pages, 2,341 entities
                  </span>
                  <span className="landing-progress-value">{progress}%</span>
                </div>
                <div className="landing-meter is-thin relative">
                  <div className="landing-meter-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Results */}
              <div>
                <div className="landing-demo-label mb-3">Audit Results</div>
                <div className="space-y-3">
                  {audits.map((a, i) => (
                    <ResultRow key={a.name} a={a} index={i} inView={inView} />
                  ))}
                </div>
              </div>

              {/* Footer summary */}
              <div className="landing-demo-foot grid grid-cols-3 gap-3 pt-5">
                <Stat label="Issues Found" value="12" tone="is-error" />
                <Stat label="Optimizations" value="34" tone="is-info" />
                <Stat label="Overall Score" value="87/100" tone="is-brand" />
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
      className="landing-result group"
    >
      <div className="flex items-center gap-3">
        <div className="landing-result-icon">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="landing-result-name">{a.name}</span>
            <span className="landing-result-score">
              {a.score}
              <span className="landing-result-unit">/100</span>
            </span>
          </div>
          <p className="landing-result-desc">{a.desc}</p>
        </div>
      </div>
      <div className="landing-meter is-thin mt-3">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${a.score}%` } : {}}
          transition={{ duration: 1.4, delay: 0.6 + index * 0.15, ease: "easeOut" }}
          className="landing-meter-fill"
        />
      </div>
    </motion.div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="landing-demo-stat p-3 text-center">
      <div className="landing-demo-stat-label">{label}</div>
      <div className={`landing-demo-stat-value ${tone} mt-1`}>{value}</div>
    </div>
  );
}
