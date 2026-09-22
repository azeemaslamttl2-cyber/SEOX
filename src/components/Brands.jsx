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
    <section className="landing-section is-brands landing-brands py-12">
      <div className="container-px">
        <p className="landing-brands-label">
          Inspired by global search experts
        </p>

        <div className="marquee mt-7 overflow-hidden">
          <div className="flex animate-scroll-x gap-14 whitespace-nowrap">
            {[...brands, ...brands].map((b, i) => (
              <span
                key={i}
                className="landing-brand-name"
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
