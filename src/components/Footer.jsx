import { useState } from "react";
import { Twitter, Github, Linkedin, Youtube, Mail, Check } from "lucide-react";
import Logo from "./Logo.jsx";
import { track } from "../lib/analytics.js";

const cols = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Desktop App", "Free SEO Audit", "Changelog", "Roadmap"],
  },
  {
    title: "Resources",
    links: ["Blog", "Help Center", "API Docs", "SEO Encyclopedia", "Case Studies", "Webinars"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Press Kit", "Partners", "Affiliates", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Cookies", "Security", "DPA", "Status"],
  },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    track("newsletter_subscribe", { source: "footer" });
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="relative mt-12 border-t border-white/10 bg-ink-800/40">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

      <div className="container-px py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <a href="#" className="flex items-center gap-2.5">
              <Logo className="h-9 w-9" />
              <span className="font-display text-xl font-bold tracking-tight">PGC</span>
            </a>
            <p className="mt-4 max-w-xs text-sm text-white/55">
              The 2026 Intelligence Framework. 60+ semantic SEO tools engineered to make your team
              outpace the algorithm.
            </p>

            {/* Newsletter */}
            <form
              onSubmit={handleSubscribe}
              className="mt-6 flex w-full max-w-sm overflow-hidden rounded-full border border-white/10 bg-white/5 p-1 focus-within:border-brand-500/50"
            >
              <div className="flex flex-1 items-center gap-2 px-4">
                <Mail className="h-4 w-4 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={subscribed ? "Subscribed!" : "Get weekly SEO insights"}
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-brand-glow transition hover:scale-[1.02]"
              >
                {subscribed ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Done
                  </>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              {[Twitter, Github, Linkedin, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="social"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold text-white">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-white/55 transition-colors hover:text-brand-300"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} PGC. Engineered for AI-era search.
          </p>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
