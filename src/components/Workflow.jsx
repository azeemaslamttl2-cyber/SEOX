import { motion } from "framer-motion";
import { Search, Cpu, Rocket } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "1. Audit Your Site",
    desc: "Connect your domain in 30 seconds. Our crawler maps every page, entity and content gap using LLM analysis.",
  },
  {
    icon: Cpu,
    title: "2. Generate Strategy",
    desc: "Our AI builds a custom 90-day roadmap with prioritized fixes, content briefs and link targets.",
  },
  {
    icon: Rocket,
    title: "3. Watch Rankings Climb",
    desc: "Auto-publish content, monitor SERPs in real-time and let agents fix issues before they hurt traffic.",
  },
];

export default function Workflow() {
  return (
    <section className="landing-section is-workflow py-20 sm:py-28">
      <div className="container-px">
        <div className="text-center">
          <span className="chip">How It Works</span>
          <h2 className="landing-section-title mt-5">
            From Insight to <span className="landing-accent">Impact</span> in 3 steps
          </h2>
          <p className="landing-section-sub mx-auto mt-4 max-w-2xl">
            No agencies. No spreadsheets. Just one elegant framework that thinks like a senior SEO
            strategist.
          </p>
        </div>

        <div className="relative mt-14 grid gap-6 lg:grid-cols-3">
          {/* Connector line */}
          <div className="landing-connector hidden lg:block" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative"
              >
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                  <div className="landing-step-badge">
                    <Icon className="h-8 w-8" />
                  </div>
                </div>
                <div className="landing-card text-center">
                  <h3 className="landing-step-title">{s.title}</h3>
                  <p className="landing-step-desc mt-2">{s.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
