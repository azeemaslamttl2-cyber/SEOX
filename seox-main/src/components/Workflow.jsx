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
    <section className="py-20 sm:py-28">
      <div className="container-px">
        <div className="text-center">
          <span className="chip">How It Works</span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            From Insight to <span className="gradient-text">Impact</span> in 3 steps
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            No agencies. No spreadsheets. Just one elegant framework that thinks like a senior SEO
            strategist.
          </p>
        </div>

        <div className="relative mt-14 grid gap-6 lg:grid-cols-3">
          {/* Connector line */}
          <div className="absolute left-1/2 top-10 hidden h-0.5 w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-500/40 to-transparent lg:block" />
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
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-700/0 blur-xl" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-brand-500/30 bg-gradient-to-br from-brand-500/20 to-ink-800">
                    <Icon className="h-8 w-8 text-brand-300" />
                  </div>
                </div>
                <div className="feature-card text-center">
                  <h3 className="font-display text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{s.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
