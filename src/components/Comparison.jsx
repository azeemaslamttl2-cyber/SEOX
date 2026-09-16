import { motion } from "framer-motion";
import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";

const issues = [
  { label: "E-E-A-T compliance gaps", value: "Detected", tone: "landing-issue-value" },
  { label: "Core Web Vitals issues", value: "Found", tone: "landing-issue-value" },
  { label: "Crawl optimization needed", value: "12 Issues", tone: "landing-issue-value" },
  { label: "Content quality scoring", value: "Low", tone: "landing-issue-value" },
  { label: "Schema markup missing", value: "None", tone: "landing-issue-value" },
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
    <section className="landing-section is-compare py-20 sm:py-28">
      <div className="container-px">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          {/* Issues */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="landing-card landing-panel is-problem relative overflow-hidden p-6 sm:p-7"
          >
            <div className="flex items-center gap-3">
              <div className="landing-panel-icon is-problem">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="landing-panel-title">Issues We Detect</h3>
                <p className="landing-panel-sub">60+ diagnostic audit checks</p>
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
                  className="landing-row"
                >
                  <span className="landing-row-label">
                    <span className="landing-row-dot is-problem" />
                    {it.label}
                  </span>
                  <span className={it.tone}>{it.value}</span>
                </motion.li>
              ))}
            </ul>

            <div className="landing-panel-total is-problem mt-5">
              <p className="landing-panel-total-label">Audit Checks</p>
              <p className="landing-panel-total-value">60+</p>
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
              <div className="landing-arrow">
                <ArrowRight className="h-6 w-6" />
              </div>
            </div>
            <span className="landing-eyebrow is-compact">Auto-Fix</span>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="landing-card landing-panel is-solution relative overflow-hidden p-6 sm:p-7"
          >
            <div className="flex items-center gap-3">
              <div className="landing-panel-icon is-solution">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="landing-panel-title">PGC Solution</h3>
                <p className="landing-panel-sub">50+ optimization tools</p>
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
                  className="landing-row"
                >
                  <span className="landing-row-label">
                    <span className="landing-row-dot is-solution" />
                    {it.label}
                  </span>
                  <span className="landing-solution-value">{it.value}</span>
                </motion.li>
              ))}
            </ul>

            <div className="landing-panel-total is-solution mt-5">
              <p className="landing-panel-total-label">SEO Tools</p>
              <p className="landing-panel-total-value">50+</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
