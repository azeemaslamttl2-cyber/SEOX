import { motion } from "framer-motion";
import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";

const issues = [
  { label: "E-E-A-T compliance gaps", value: "Detected", tone: "text-rose-400" },
  { label: "Core Web Vitals issues", value: "Found", tone: "text-rose-400" },
  { label: "Crawl optimization needed", value: "12 Issues", tone: "text-amber-300" },
  { label: "Content quality scoring", value: "Low", tone: "text-rose-400" },
  { label: "Schema markup missing", value: "None", tone: "text-rose-400" },
];

const solutions = [
  { label: "AI Content Writer", value: "12-Step" },
  { label: "Link Building Intelligence", value: "2900+ Sites" },
  { label: "On-Page SEO Optimization", value: "61 Checks" },
  { label: "Schema Generator", value: "50+ Types" },
  { label: "Speed & Crawl Optimization", value: "Active" },
];

export default function Comparison() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-px">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          {/* Issues */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-b from-rose-500/[0.07] to-transparent p-6 sm:p-7"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl" />
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-500/15 p-2.5">
                <XCircle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold">Issues We Detect</h3>
                <p className="text-xs text-white/50">60+ diagnostic audit checks</p>
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              {issues.map((it, i) => (
                <motion.li
                  key={it.label}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {it.label}
                  </span>
                  <span className={`text-xs font-bold ${it.tone}`}>{it.value}</span>
                </motion.li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-white/50">Audit Checks</p>
              <p className="mt-1 font-display text-3xl font-bold text-rose-400">60+</p>
            </div>
          </motion.div>

          {/* Center arrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 shadow-brand-glow">
                <ArrowRight className="h-6 w-6 text-white" />
              </div>
            </div>
            <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-300">
              Auto-Fix
            </span>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-b from-brand-500/[0.10] to-transparent p-6 shadow-brand-glow sm:p-7"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-500/20 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-brand-300" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-brand-300">
                  PGC Solution
                </h3>
                <p className="text-xs text-white/50">50+ optimization tools</p>
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              {solutions.map((it, i) => (
                <motion.li
                  key={it.label}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                    {it.label}
                  </span>
                  <span className="text-xs font-bold text-brand-300">{it.value}</span>
                </motion.li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-brand-500/40 bg-brand-500/10 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-white/50">SEO Tools</p>
              <p className="mt-1 font-display text-3xl font-bold text-brand-300">50+</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
