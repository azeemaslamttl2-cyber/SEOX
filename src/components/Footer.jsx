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
    <footer className="landing-footer relative mt-12">

      <div className="container-px py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <a href="#" className="flex items-center gap-2.5">
              <Logo className="w-28 h-auto block" />
            </a>
            <p className="landing-footer-blurb mt-4 max-w-xs">
              The 2026 Intelligence Framework. 60+ semantic SEO tools engineered to make your team
              outpace the algorithm.
            </p>

            {/* Newsletter */}
            <form
              onSubmit={handleSubscribe}
              className="landing-newsletter mt-6"
            >
              <div className="flex flex-1 items-center gap-2 px-4">
                <Mail className="h-4 w-4 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={subscribed ? "Subscribed!" : "Get weekly SEO insights"}
                  className="landing-newsletter-input"
                />
              </div>
              <button
                type="submit"
                className="ui-button ui-button-primary landing-newsletter-submit"
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
                  className="landing-social"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="landing-footer-heading">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="landing-footer-link"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="landing-footer-bottom mt-12 flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row">
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} PGC. Engineered for AI-era search.
          </p>
          <div className="landing-status">
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
