import { motion } from "framer-motion";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { track } from "../lib/firebase.js";

const plans = (yearly) => [
  {
    name: "Free",
    tagline: "Perfect for getting started",
    price: { monthly: 0, yearly: 0 },
    cta: "Get Started",
    highlight: false,
    features: [
      { label: "Access to all SEO tools", included: true },
      { label: "Basic backlink directory", included: true },
      { label: "Priority support", included: false },
    ],
  },
  {
    name: "Professional",
    tagline: "For growing businesses",
    price: { monthly: 2500, yearly: 25000 },
    badge: "MOST POPULAR",
    cta: "Start Free Trial",
    highlight: true,
    features: [
      { label: "Everything in Free", included: true },
      { label: "Full backlink database", included: true },
      { label: "AI content generation", included: true },
      { label: "Priority email support", included: true },
    ],
  },
  {
    name: "Enterprise",
    tagline: "For agencies & teams",
    price: { monthly: 5500, yearly: 55000 },
    cta: "Get Started",
    highlight: false,
    features: [
      { label: "Everything in Professional", included: true },
      { label: "Unlimited projects", included: true },
      { label: "API access", included: true },
      { label: "24/7 priority support", included: true },
    ],
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const list = plans(yearly);

  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="container-px">
        {/* Header */}
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl font-bold tracking-tight sm:text-5xl"
          >
            Scale Your{" "}
            <span className="gradient-text">Intelligence</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-white/50"
          >
            Choose the framework that fits your organizational goals.
          </motion.p>

          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1"
          >
            <button
              onClick={() => {
                setYearly(false);
                track("pricing_toggle", { billing: "monthly" });
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                !yearly
                  ? "bg-brand-500 text-white shadow-brand-glow"
                  : "text-white/60"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => {
                setYearly(true);
                track("pricing_toggle", { billing: "yearly" });
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                yearly
                  ? "bg-brand-500 text-white shadow-brand-glow"
                  : "text-white/60"
              }`}
            >
              Yearly
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                -20%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Pricing cards */}
        <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {list.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative"
            >
              {/* Glow border for highlighted card */}
              {p.highlight && (
                <div
                  className="pointer-events-none absolute -inset-[1px] rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(122,189,188,0.7), rgba(171,216,183,0.4), rgba(122,189,188,0.7))",
                    padding: "1.5px",
                    WebkitMask:
                      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    borderRadius: "1rem",
                  }}
                />
              )}

              {/* Badge */}
              {p.badge && (
                <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2">
                  <span className="whitespace-nowrap rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-ink-900 shadow-brand-glow">
                    {p.badge}
                  </span>
                </div>
              )}

              <div
                className={`relative flex flex-col rounded-2xl border p-7 sm:p-8 ${
                  p.highlight
                    ? "border-brand-500/30 bg-gradient-to-b from-brand-500/[0.06] to-ink-800/80"
                    : "border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                {/* Plan name & tagline */}
                <div>
                  <h3
                    className={`font-display text-xl font-bold ${
                      p.highlight ? "text-brand-300" : "text-white"
                    }`}
                  >
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm text-white/45">{p.tagline}</p>
                </div>

                {/* Price */}
                <div className="mt-6 mb-6">
                  {p.price.monthly === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-5xl font-bold tracking-tight">
                        Free
                      </span>
                      <span className="text-sm text-white/40">/month</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-medium text-white/60">
                          Rs
                        </span>
                        <span className="font-display text-5xl font-bold tracking-tight">
                          {yearly
                            ? Math.round(
                                (p.price.yearly / 12) * 0.8
                              ).toLocaleString()
                            : p.price.monthly.toLocaleString()}
                        </span>
                        <span className="text-sm text-white/40">/month</span>
                      </div>
                      {yearly && (
                        <p className="mt-1.5 text-xs text-emerald-400">
                          Billed annually · Save Rs{" "}
                          {(p.price.monthly * 12 * 0.2).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="mb-6 h-px bg-white/[0.06]" />

                {/* Features */}
                <ul className="flex-1 space-y-3.5">
                  {p.features.map((f) => (
                    <li
                      key={f.label}
                      className="flex items-start gap-3 text-sm"
                    >
                      {f.included ? (
                        <span
                          className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                            p.highlight
                              ? "bg-brand-500/20 text-brand-300"
                              : "bg-white/10 text-brand-400"
                          }`}
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-white/25">
                          <X className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className={
                          f.included ? "text-white/75" : "text-white/35"
                        }
                      >
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <button
                  onClick={() =>
                    track("pricing_plan_click", {
                      plan: p.name,
                      billing: yearly ? "yearly" : "monthly",
                      price_monthly: p.price.monthly,
                    })
                  }
                  className={`mt-8 w-full rounded-full py-3 text-sm font-semibold transition-all duration-300 ${
                    p.highlight
                      ? "bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-brand-glow hover:scale-[1.02] hover:shadow-[0_14px_50px_-8px_rgba(122,189,188,0.7)]"
                      : "border border-white/[0.12] bg-white/[0.03] text-white/80 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 text-center text-xs text-white/35"
        >
          All plans include 14-day free trial · No credit card required ·
          Cancel anytime
        </motion.p>
      </div>
    </section>
  );
}
