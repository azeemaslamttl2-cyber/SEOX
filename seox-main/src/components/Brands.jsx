const brands = [
  "Ahrefs",
  "SEMrush",
  "Moz",
  "Majestic",
  "Screaming Frog",
  "Surfer SEO",
  "Yoast",
  "Clearscope",
];

export default function Brands() {
  return (
    <section className="border-y border-white/5 bg-ink-800/30 py-12">
      <div className="container-px">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
          Inspired by global search experts
        </p>

        <div className="marquee mt-7 overflow-hidden">
          <div className="flex animate-scroll-x gap-14 whitespace-nowrap">
            {[...brands, ...brands].map((b, i) => (
              <span
                key={i}
                className="font-display text-2xl font-bold tracking-tight text-white/40 transition-colors hover:text-brand-300 sm:text-3xl"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
