import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { track } from "../lib/analytics.js";

export default function CTA() {
  return (
    <section id="cta" className="landing-section is-cta py-20 sm:py-28">
      <div className="container-px">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="landing-cta-panel relative overflow-hidden p-10 text-center sm:p-16"
        >
          {/* Animated grid */}
          <div className="landing-cta-grid absolute inset-0" />

          <div className="relative">
            <span className="landing-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Limited launch offer · 20% off yearly
            </span>

            <h2 className="landing-cta-title mx-auto mt-6 max-w-3xl">
              Ready to <span className="landing-accent">dominate</span> AI search?
            </h2>
            <p className="landing-cta-sub mx-auto mt-5 max-w-xl">
              Join 18,500+ teams using PGC to ship semantic SEO at unprecedented scale.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#pricing"
                onClick={() => track("cta_click", { location: "final_cta", action: "start_free_trial" })}
                className="ui-button ui-button-primary landing-cta group"
              >
                Start Your Free Trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#audit"
                onClick={() => track("cta_click", { location: "final_cta", action: "run_free_audit" })}
                className="ui-button ui-button-secondary landing-cta"
              >
                <Zap className="h-4 w-4" />
                Run a Free Audit
              </a>
            </div>

            <div className="landing-trust mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> 14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Cancel anytime
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
