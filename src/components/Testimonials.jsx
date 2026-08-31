import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Head of Growth, NovaCart",
    rating: 5,
    text: "We replaced Ahrefs, SurferSEO and Clearscope with PGC in one week. Organic traffic jumped 218% in 90 days.",
    avatar: "SC",
    color: "from-brand-500 to-amber-400",
  },
  {
    name: "Marcus Reid",
    role: "SEO Director, FluxLabs",
    rating: 5,
    text: "The E-E-A-T scanner caught 4 content quality gaps Google was punishing us for. Rankings recovered the next crawl cycle.",
    avatar: "MR",
    color: "from-amber-500 to-orange-500",
  },
  {
    name: "Aisha Patel",
    role: "Founder, ContentForge",
    rating: 5,
    text: "AI Content Writer is the only tool that doesn't read like AI. We publish 40 articles a month — and they all rank.",
    avatar: "AP",
    color: "from-orange-500 to-rose-400",
  },
  {
    name: "David Kim",
    role: "Marketing VP, Vertex",
    rating: 5,
    text: "The semantic clustering reduced our keyword research from days to minutes. Our team is now 10x faster.",
    avatar: "DK",
    color: "from-yellow-400 to-brand-500",
  },
  {
    name: "Lina Brooks",
    role: "Agency Owner, BrightSeed",
    rating: 5,
    text: "I run 27 client sites through PGC. The white-label reports alone justified the Enterprise plan.",
    avatar: "LB",
    color: "from-brand-400 to-orange-600",
  },
  {
    name: "Tomás García",
    role: "CMO, Helio AI",
    rating: 5,
    text: "We rank for 14 AI Overviews in our niche. PGC is the only tool that optimizes for ChatGPT and Google together.",
    avatar: "TG",
    color: "from-amber-400 to-orange-500",
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-px">
        <div className="text-center">
          <span className="chip">Loved by 18,500+ teams</span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Real teams. <span className="gradient-text">Real growth.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            From scrappy founders to global enterprise SEO teams — PGC scales with you.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="feature-card relative"
            >
              <Quote className="absolute right-5 top-5 h-8 w-8 text-brand-500/15" />
              <div className="flex items-center gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-brand-400 text-brand-400" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/75">"{t.text}"</p>
              <div className="mt-5 flex items-center gap-3 border-t border-white/5 pt-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.color} font-bold text-white`}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-white/50">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
