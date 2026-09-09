// The white variant is a stroke-only outline, so it is only legible on the
// dark navy navigation surfaces. Everywhere else (navbar, footer, auth shell)
// sits on a light background and needs the default mark.
const SOURCES = {
  default: "https://pgc.edu/wp-content/themes/pgc-new/img/PGCLogo.svg",
  white: "/white-logo.svg",
};

export default function Logo({ className = "h-8 w-8", variant = "default" }) {
  return (
    <img
      src={SOURCES[variant] || SOURCES.default}
      alt="PGC"
      className={className}
    />
  );
}
