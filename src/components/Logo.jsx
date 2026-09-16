// The white variant is a stroke-only outline, so it is only legible on the
// dark navy navigation surfaces. Everywhere else (navbar, footer, auth shell)
// sits on a light background and needs the default mark.
const SOURCES = {
  default: "/images/logo1.svg",
  white: "/white-logo.svg",
};

// The mark is 132x80, so callers size it by height and let the width follow.
// object-contain keeps it from stretching if a caller passes a square box.
export default function Logo({ className = "h-8 w-auto", variant = "default" }) {
  return (
    <img
      src={SOURCES[variant] || SOURCES.default}
      alt="PGC"
      className={`object-contain ${className}`}
    />
  );
}
