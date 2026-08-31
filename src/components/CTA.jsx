import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { track } from "../lib/analytics.js";

export default function CTA() {
  return (
    <section id="cta" className="py-20 sm:py-28">
      <div className="container-px">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-600/30 via-brand-500/10 to-orange-500/20 p-10 text-center sm:p-16"
        >
          {/* Animated grid */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />
          {/* Glow orbs */}
          <div className="absolute -left-20 -top-20 h-72 w-72 animate-float rounded-full bg-brand-500/40 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-72 w-72 animate-float-slow rounded-full bg-amber-400/30 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              Limited launch offer · 20% off yearly
            </span>

            <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Ready to <span className="gradient-text">dominate</span> AI search?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/70">
              Join 18,500+ teams using PGC to ship semantic SEO at unprecedented scale.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#pricing"
                onClick={() => track("cta_click", { location: "final_cta", action: "start_free_trial" })}
                className="btn-primary group"
              >
                Start Your Free Trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#audit"
                onClick={() => track("cta_click", { location: "final_cta", action: "run_free_audit" })}
                className="btn-ghost"
              >
                <Zap className="h-4 w-4" />
                Run a Free Audit
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-300" /> 14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-300" /> No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-300" /> Cancel anytime
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
