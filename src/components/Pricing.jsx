import { motion } from "framer-motion";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { track } from "../lib/analytics.js";

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
      { label: "Encyclopedia access", included: true },
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
    <section id="pricing" className="landing-section is-pricing py-20 sm:py-28">
      <div className="container-px">
        {/* Header */}
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="landing-section-title"
          >
            Scale Your{" "}
            <span className="landing-accent">Intelligence</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="landing-section-sub mx-auto mt-4 max-w-xl"
          >
            Choose the framework that fits your organizational goals.
          </motion.p>

          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="landing-toggle mt-7"
          >
            <button
              onClick={() => {
                setYearly(false);
                track("pricing_toggle", { billing: "monthly" });
              }}
              className={`landing-toggle-option ${!yearly ? "is-active" : ""}`}
            >
              Monthly
            </button>
            <button
              onClick={() => {
                setYearly(true);
                track("pricing_toggle", { billing: "yearly" });
              }}
              className={`landing-toggle-option ${yearly ? "is-active" : ""}`}
            >
              Yearly
              <span className="landing-save-badge">-20%</span>
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
              {p.highlight && <div className="landing-plan-ring pointer-events-none" />}

              {/* Badge */}
              {p.badge && (
                <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2">
                  <span className="landing-plan-badge">{p.badge}</span>
                </div>
              )}

              <div
                className={`landing-plan relative flex flex-col p-7 sm:p-8 ${p.highlight ? "is-featured" : ""}`}
              >
                {/* Plan name & tagline */}
                <div>
                  <h3 className="landing-plan-name">{p.name}</h3>
                  <p className="landing-plan-tagline mt-1">{p.tagline}</p>
                </div>

                {/* Price */}
                <div className="mt-6 mb-6">
                  {p.price.monthly === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="landing-plan-price">Free</span>
                      <span className="landing-plan-period">/month</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="landing-plan-currency">Rs</span>
                        <span className="landing-plan-price">
                          {yearly
                            ? Math.round(
                                (p.price.yearly / 12) * 0.8
                              ).toLocaleString()
                            : p.price.monthly.toLocaleString()}
                        </span>
                        <span className="landing-plan-period">/month</span>
                      </div>
                      {yearly && (
                        <p className="landing-plan-note mt-1.5">
                          Billed annually · Save Rs{" "}
                          {(p.price.monthly * 12 * 0.2).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="landing-plan-rule mb-6" />

                {/* Features */}
                <ul className="flex-1 space-y-3.5">
                  {p.features.map((f) => (
                    <li
                      key={f.label}
                      className="flex items-start gap-3 text-sm"
                    >
                      {f.included ? (
                        <span
                          className="landing-check mt-0.5"
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="landing-check is-off mt-0.5">
                          <X className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className={
                          f.included ? "landing-plan-feature" : "landing-plan-feature is-off"
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
                  className={`ui-button landing-plan-cta mt-8 w-full ${
                    p.highlight ? "ui-button-primary" : "ui-button-secondary"
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
          className="landing-plan-footnote mt-10 text-center"
        >
          All plans include 14-day free trial · No credit card required ·
          Cancel anytime
        </motion.p>
      </div>
    </section>
  );
}
