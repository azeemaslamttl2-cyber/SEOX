import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "How is PGC different from Ahrefs or SEMrush?",
    a: "We don't just track rankings — we engineer them. PGC combines deep NLP entity extraction, AI content generation and an autonomous agent layer that fixes issues automatically. Other tools give you data; we give you results.",
  },
  {
    q: "What is the E-E-A-T audit and why does it matter?",
    a: "E-E-A-T (Experience, Expertise, Authority, Trust) is Google's quality framework. Our scanner checks 60+ on-page and off-page signals across all four pillars and gives you a prioritized fix list — exactly what Google's quality raters look for.",
  },
  {
    q: "Can PGC optimize content for ChatGPT and Google AI Overviews?",
    a: "Yes. Our AnswerEngine Optimizer (AEO) module structures content for retrieval by ChatGPT, Perplexity, Gemini and Google AI Overviews. It's built into every plan — no extra add-ons.",
  },
  {
    q: "Is there a free trial?",
    a: "Every paid plan includes a 14-day free trial — no credit card required. The Free plan is forever-free and includes access to all core SEO tools with limited usage.",
  },
  {
    q: "Do you offer white-label reports for agencies?",
    a: "Yes — included in the Enterprise plan. Brand reports with your logo, custom domains and unlimited client workspaces. Perfect for agencies managing 10+ clients.",
  },
  {
    q: "How fast is onboarding?",
    a: "Most teams are running their first audit in under 5 minutes. Connect your domain, install the plugin (optional) and our AI does the rest — including pre-built dashboards and a custom 90-day strategy.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="container-px">
        <div className="text-center">
          <span className="chip">FAQ</span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Everything you need to know — and a few things you didn't ask.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {faqs.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`overflow-hidden rounded-2xl border transition-all ${
                open === i
                  ? "border-brand-500/40 bg-gradient-to-b from-brand-500/[0.06] to-transparent"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-semibold text-white">{f.q}</span>
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                    open === i ? "bg-brand-500 text-white" : "bg-white/5 text-white/60"
                  }`}
                >
                  {open === i ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-white/65">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
