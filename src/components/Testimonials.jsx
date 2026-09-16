import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Head of Growth, NovaCart",
    rating: 5,
    text: "We replaced Ahrefs, SurferSEO and Clearscope with PGC in one week. Organic traffic jumped 218% in 90 days.",
    avatar: "SC",
    color: "is-brand",
  },
  {
    name: "Marcus Reid",
    role: "SEO Director, FluxLabs",
    rating: 5,
    text: "The E-E-A-T scanner caught 4 content quality gaps Google was punishing us for. Rankings recovered the next crawl cycle.",
    avatar: "MR",
    color: "is-navy",
  },
  {
    name: "Aisha Patel",
    role: "Founder, ContentForge",
    rating: 5,
    text: "AI Content Writer is the only tool that doesn't read like AI. We publish 40 articles a month — and they all rank.",
    avatar: "AP",
    color: "is-brand",
  },
  {
    name: "David Kim",
    role: "Marketing VP, Vertex",
    rating: 5,
    text: "The semantic clustering reduced our keyword research from days to minutes. Our team is now 10x faster.",
    avatar: "DK",
    color: "is-navy",
  },
  {
    name: "Lina Brooks",
    role: "Agency Owner, BrightSeed",
    rating: 5,
    text: "I run 27 client sites through PGC. The white-label reports alone justified the Enterprise plan.",
    avatar: "LB",
    color: "is-brand",
  },
  {
    name: "Tomás García",
    role: "CMO, Helio AI",
    rating: 5,
    text: "We rank for 14 AI Overviews in our niche. PGC is the only tool that optimizes for ChatGPT and Google together.",
    avatar: "TG",
    color: "is-navy",
  },
];

export default function Testimonials() {
  return (
    <section className="landing-section is-voices py-20 sm:py-28">
      <div className="container-px">
        <div className="text-center">
          <span className="chip">Loved by 18,500+ teams</span>
          <h2 className="landing-section-title mt-5">
            Real teams. <span className="landing-accent">Real growth.</span>
          </h2>
          <p className="landing-section-sub mx-auto mt-4 max-w-2xl">
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
              className="landing-card landing-quote relative"
            >
              <Quote className="landing-quote-mark absolute right-5 top-5 h-8 w-8" />
              <div className="landing-stars flex items-center gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4" />
                ))}
              </div>
              <p className="landing-quote-text mt-4">"{t.text}"</p>
              <div className="landing-quote-foot mt-5 flex items-center gap-3 pt-4">
                <div className={`landing-avatar ${t.color}`}>{t.avatar}</div>
                <div>
                  <div className="landing-quote-name">{t.name}</div>
                  <div className="landing-quote-role">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
