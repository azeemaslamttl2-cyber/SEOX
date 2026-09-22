import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUp,
  Ban,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Info,
  KeyRound,
  Mail,
  Printer,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Public Terms of Service.
 *
 * Rendered inside RootLayout, so it inherits the marketing Navbar and
 * Footer. The markup deliberately uses the same legacy utility
 * vocabulary as PrivacyPolicy.jsx and the other public sections
 * (text-white, border-white/10, bg-white/[0.02]) because the
 * compatibility layer in index.css remaps those names to the light
 * palette. Modern token classes would render correctly on their own but
 * would not match Hero/FAQ/Footer.
 *
 * framer-motion is intentionally not imported, for the same reason as
 * the privacy page: it is a 115 KB dependency that only HomePage pulls
 * in, and a static legal page does not justify a second entry point.
 *
 * Everything asserted here is taken from what the application actually
 * implements. The Google Business Profile clauses describe the real
 * integration in functions/_lib/gbp-client.js and functions/api/gbp/*,
 * not an aspirational one.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * >>> FILL THIS IN BEFORE THE PAGE GOES LIVE <<<
 *
 * These are the only facts on this page that cannot be derived from the
 * codebase. Any value still wrapped in [SQUARE BRACKETS] renders as a
 * dashed placeholder chip and triggers the unresolved-details banner at
 * the top of the page. Replace the string and both disappear on their
 * own - there is nothing else to remove.
 *
 * Google's OAuth reviewers check that the operator behind an app is
 * identifiable and reachable, so leaving these unset is very likely to
 * hold up verification.
 * ------------------------------------------------------------------ */
const ORG = {
  product: "TTL SEOX",
  site: "https://aismart.thetowertech.com",
  legalName: "[REGISTERED COMPANY NAME]",
  registrationNumber: "[COMPANY REGISTRATION NUMBER]",
  address: ["[STREET ADDRESS]", "[CITY, POSTAL CODE]", "[COUNTRY]"],
  // Governing law, and the courts that hear disputes.
  jurisdiction: "[COUNTRY / STATE]",
  courts: "[CITY, COUNTRY]",
  email: {
    support: "[support@thetowertech.com]",
    privacy: "[privacy@thetowertech.com]",
    legal: "[legal@thetowertech.com]",
  },
};

const LAST_UPDATED = { iso: "2026-09-18", label: "18 September 2026" };
const EFFECTIVE = { iso: "2026-09-18", label: "18 September 2026" };

const META_DESCRIPTION =
  "The terms that govern your use of TTL SEOX, including the Google Business Profile " +
  "integration, your responsibilities when TTL SEOX writes to a live listing, acceptable " +
  "use, service availability and liability.";

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of These Terms" },
  { id: "who-we-are", title: "Who Operates TTL SEOX" },
  { id: "description", title: "Description of the Service" },
  { id: "accounts", title: "Eligibility and User Accounts" },
  { id: "responsibilities", title: "Your Responsibilities" },
  { id: "google-integration", title: "Google Business Profile Integration" },
  { id: "authorisation", title: "Authorisation and Permissions" },
  { id: "third-party", title: "Third-Party Services" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "prohibited", title: "Prohibited Activities" },
  { id: "ai-content", title: "AI-Generated Content" },
  { id: "your-content", title: "Your Content and Data" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "fees", title: "Plans, Fees and Billing" },
  { id: "availability", title: "Service Availability and Changes" },
  { id: "termination", title: "Suspension and Termination" },
  { id: "privacy", title: "Privacy and Data Protection" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "indemnity", title: "Indemnity" },
  { id: "changes", title: "Changes to These Terms" },
  { id: "governing-law", title: "Governing Law and Disputes" },
  { id: "contact", title: "Contact Us" },
];

/* The Google surfaces TTL SEOX actually calls, and what each one is for.
   Mirrors ENDPOINTS in functions/_lib/gbp-client.js. */
const GOOGLE_API_ROWS = [
  [
    "My Business Account Management API",
    "Lists the Business Profile accounts your Google Account can administer, so you can pick one to connect.",
    "Read",
  ],
  [
    "My Business Business Information API",
    "Reads and updates location details: name, categories, address, hours, phone, website, attributes and services.",
    "Read and write",
  ],
  [
    "Business Profile Performance API",
    "Retrieves the performance metrics shown on the Overview and Insights screens.",
    "Read",
  ],
  [
    "Google My Business API (v4)",
    "Reads reviews and posts for a connected location, publishes posts, and publishes or removes your replies to reviews.",
    "Read and write",
  ],
  [
    "My Business Q&A API",
    "Reads questions asked on a connected location and publishes the answers you approve.",
    "Read and write",
  ],
];

/* Mirrors GBP_SCOPES in functions/_lib/gbp-client.js. */
const SCOPE_ROWS = [
  [
    "https://www.googleapis.com/auth/business.manage",
    "Manage the Business Profile locations your Google Account is already an owner or manager of.",
  ],
  [
    "https://www.googleapis.com/auth/userinfo.email",
    "Identify which Google Account authorised the connection, so the right connection is shown and revoked.",
  ],
  ["openid", "Standard OpenID Connect sign-in claim, issued alongside the scopes above."],
];

/* Actions that leave TTL SEOX and change a live, publicly visible Google
   listing. Called out explicitly because a mistake here is public and
   immediate. */
const WRITE_ACTIONS = [
  "Editing profile fields - business name, categories, address, opening hours, phone number, website URL, attributes and services.",
  "Creating, scheduling and publishing posts to a connected location.",
  "Publishing, updating and deleting your replies to reviews left on a connected location.",
  "Publishing and deleting answers to questions asked on a connected location.",
  "Running automation rules and recurring post schedules that you configure, which perform the above on the schedule you set.",
];

const PROHIBITED = [
  "Connecting a Google Account to manage a Business Profile you are not an owner or manager of, or acting for a business you have no authority to represent.",
  "Publishing false, misleading or deceptive information to a Business Profile, including inaccurate business details, hours or locations.",
  "Posting, soliciting or replying to reviews in any way that breaches Google's prohibited and restricted content policies, including incentivised, fake or self-authored reviews.",
  "Using the Service to impersonate another business, person or brand.",
  "Attempting to circumvent, disable or interfere with Google's authorisation system, with our authentication, or with any rate limit or quota.",
  "Sharing your account credentials, or an issued session or API token, with anyone outside your organisation.",
  "Scraping, spidering, reverse engineering, decompiling or otherwise attempting to extract the source code of the Service, except where that restriction is unenforceable by law.",
  "Reselling, sublicensing or white-labelling the Service without our prior written agreement.",
  "Uploading or transmitting malware, or using the Service to attack, probe or overload any system, including the sites you submit for crawling.",
  "Crawling or auditing a website you neither own nor have permission to test.",
  "Using the Service in breach of any applicable law, sanctions regime, or the terms of any third-party service it connects to.",
];

const THIRD_PARTY_ROWS = [
  [
    "Google LLC",
    "Google Business Profile APIs, Google sign-in, Search Console data and PageSpeed Insights.",
    "Google Terms of Service and the applicable Google API terms",
  ],
  [
    "DeepSeek",
    "Generates the draft post copy, review replies and Q&A answers you request. Drafts only - see section 11.",
    "DeepSeek terms",
  ],
  [
    "DataForSEO",
    "Supplies the third-party keyword, ranking and backlink datasets used by the research tools.",
    "DataForSEO terms",
  ],
  [
    "Stripe",
    "Processes subscription payments where a paid plan applies.",
    "Stripe Services Agreement",
  ],
  ["Cloudflare", "Hosts and serves the application and its API.", "Cloudflare terms"],
];

/* ------------------------------------------------------------------ *
 * Presentational helpers
 *
 * Shared vocabulary with PrivacyPolicy.jsx. Kept local rather than
 * extracted: those two pages are the only callers, and a shared module
 * would add a third chunk to a route that is already lazy.
 * ------------------------------------------------------------------ */

/** True for a value the site owner still has to supply. */
const isUnset = (value) => typeof value === "string" && value.startsWith("[");

/** Marks example text the site owner must swap for real legal details. */
function Placeholder({ children }) {
  return (
    <span className="mx-0.5 inline-block max-w-full break-all rounded-md border border-dashed border-white/20 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.82em] text-white/70 sm:whitespace-nowrap sm:break-normal">
      {children}
    </span>
  );
}

/** Renders a configured value, or a placeholder chip while it is unset. */
function Val({ children }) {
  return isUnset(children) ? <Placeholder>{children}</Placeholder> : <>{children}</>;
}

/** A mailto link, but only once the address is real. */
function MailLink({ address }) {
  if (isUnset(address)) return <Placeholder>{address}</Placeholder>;
  return (
    <a href={`mailto:${address}`} className="font-medium text-brand-600 hover:underline">
      {address}
    </a>
  );
}

function Section({ id, index, title, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-28 border-t border-white/10 py-10 first:border-t-0 first:pt-0"
    >
      <h2
        id={`${id}-heading`}
        className="flex items-baseline gap-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl"
      >
        <span className="shrink-0 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-mono text-xs font-bold text-brand-600">
          {String(index).padStart(2, "0")}
        </span>
        <span>{title}</span>
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-white/65">{children}</div>
    </section>
  );
}

function Callout({ tone = "info", children }) {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  const tones = {
    info: "border-info-200 bg-info-50 text-info-700",
    warning: "border-warning-200 bg-warning-50 text-warning-700",
  };
  return (
    <div role="note" className={`flex gap-3 rounded-2xl border p-4 sm:p-5 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function DataTable({ caption, headers, rows, mono = [] }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10">
      <figcaption className="border-b border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/50">
        {caption}
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-white/[0.02]">
              {headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-white/10 last:border-0">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`px-4 py-3 align-top text-white/65 ${
                      mono.includes(c) ? "break-all font-mono text-[12.5px] text-white/80" : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function TermsOfService() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [showTop, setShowTop] = useState(false);

  /* Anything in ORG still wrapped in brackets. The banner is driven by
     this rather than a hand-maintained flag, so filling ORG in is the
     only edit needed to publish the page. */
  const unresolved = [
    ORG.legalName,
    ORG.registrationNumber,
    ...ORG.address,
    ORG.jurisdiction,
    ORG.courts,
    ORG.email.support,
    ORG.email.privacy,
    ORG.email.legal,
  ].filter(isUnset).length;

  /* There is no Helmet or metadata framework in this SPA, so the document
     head is set here and restored on unmount to avoid leaking the legal
     title into whatever route the visitor opens next. */
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Terms of Service | ${ORG.product}`;

    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", META_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== null) meta.setAttribute("content", previousDescription);
    };
  }, []);

  /* Highlight the table-of-contents entry for the topmost visible section. */
  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodes.length || typeof IntersectionObserver === "undefined") return undefined;

    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: "-120px 0px -65% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const n = (id) => SECTIONS.findIndex((s) => s.id === id) + 1;

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="container-px">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-white/45">
              <li>
                <Link to="/" className="transition-colors hover:text-brand-600">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="text-white/60">Legal</li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="font-medium text-white">
                Terms of Service
              </li>
            </ol>
          </nav>

          <span className="chip">Legal &amp; Trust Center</span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Terms of <span className="gradient-text">Service</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/60">
            These terms govern your use of {ORG.product}, the search-optimisation platform at{" "}
            <a href={ORG.site} className="font-medium text-brand-600 hover:underline">
              aismart.thetowertech.com
            </a>
            , including its Google Business Profile integration. Please read them before you create
            an account or connect a Google Account.
          </p>

          <dl className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/55">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-white/40" aria-hidden="true" />
              <dt>Last updated:</dt>
              <dd className="font-semibold text-white">
                <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.label}</time>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/40" aria-hidden="true" />
              <dt>Effective:</dt>
              <dd className="font-semibold text-white">
                <time dateTime={EFFECTIVE.iso}>{EFFECTIVE.label}</time>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-white/40" aria-hidden="true" />
              <dt className="sr-only">Reading time</dt>
              <dd>About a 12 minute read</dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print or save as PDF
            </button>
            <Link
              to="/privacy"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Read the Privacy Policy
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact us
            </a>
          </div>
        </div>
      </section>

      {/* ---------------- Body ---------------- */}
      <div className="container-px py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
          {/* Table of contents */}
          <aside aria-labelledby="toc-heading" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h2
                id="toc-heading"
                className="px-2 text-[11px] font-bold uppercase tracking-wider text-white/45"
              >
                On this page
              </h2>
              <ol className="mt-3 space-y-0.5">
                {SECTIONS.map((section, i) => {
                  const isActive = activeId === section.id;
                  return (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        aria-current={isActive ? "true" : undefined}
                        className={`flex gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                          isActive
                            ? "bg-brand-500/10 font-semibold text-brand-600"
                            : "text-white/55 hover:text-white"
                        }`}
                      >
                        <span className="font-mono text-[11px] tabular-nums opacity-60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{section.title}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* Terms */}
          <article className="min-w-0 max-w-3xl">
            {unresolved > 0 && (
              <div className="mb-10">
                <Callout tone="warning">
                  <p>
                    <strong>
                      {unresolved} legal {unresolved === 1 ? "detail is" : "details are"} still
                      unset.
                    </strong>{" "}
                    Every value in a dashed box on this page comes from the <code>ORG</code>{" "}
                    constant at the top of <code>src/pages/TermsOfService.jsx</code>. Fill those in
                    and this notice disappears by itself.
                  </p>
                  <p>
                    Google&apos;s OAuth reviewers check that the operator behind an application can
                    be identified and contacted, so publishing with these unset is likely to hold up
                    verification. This page is drafting scaffolding, not legal advice - have
                    qualified counsel review the final wording for the jurisdictions you operate in.
                  </p>
                </Callout>
              </div>
            )}

            {/* 01 */}
            <Section id="acceptance" index={n("acceptance")} title="Acceptance of These Terms">
              <p>
                These Terms of Service (the &quot;Terms&quot;) are a binding agreement between you
                and <Val>{ORG.legalName}</Val> (&quot;we&quot;, &quot;us&quot; or &quot;our&quot;),
                the operator of {ORG.product} (the &quot;Service&quot;).
              </p>
              <p>
                By creating an account, signing in, connecting a Google Account, or otherwise using
                the Service, you confirm that you have read and accept these Terms and our{" "}
                <Link to="/privacy" className="font-medium text-brand-600 hover:underline">
                  Privacy Policy
                </Link>
                , which is incorporated into them by reference. If you do not accept them, do not
                use the Service.
              </p>
              <p>
                If you are using the Service on behalf of a company, agency or other organisation,
                you confirm that you have authority to bind that organisation, and &quot;you&quot;
                means that organisation.
              </p>
            </Section>

            {/* 02 */}
            <Section id="who-we-are" index={n("who-we-are")} title="Who Operates TTL SEOX">
              <p>
                {ORG.product} is developed and operated by <Val>{ORG.legalName}</Val>, an
                independent software provider. The Service is published at{" "}
                <a href={ORG.site} className="font-medium text-brand-600 hover:underline">
                  {ORG.site}
                </a>
                .
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  <Building2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Operator details
                </h3>
                <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Legal entity
                    </dt>
                    <dd className="mt-1 text-white/65">
                      <Val>{ORG.legalName}</Val>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Registration number
                    </dt>
                    <dd className="mt-1 text-white/65">
                      <Val>{ORG.registrationNumber}</Val>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Registered address
                    </dt>
                    <dd className="mt-1 space-y-1 text-white/65">
                      {ORG.address.map((line) => (
                        <div key={line}>
                          <Val>{line}</Val>
                        </div>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      General contact
                    </dt>
                    <dd className="mt-1 text-white/65">
                      <MailLink address={ORG.email.support} />
                    </dd>
                  </div>
                </dl>
              </div>

              <Callout tone="info">
                <p>
                  <strong>{ORG.product} is not affiliated with Google.</strong> We are an
                  independent developer of a third-party application that uses Google&apos;s public
                  APIs. {ORG.product} is not sponsored, endorsed, certified or otherwise approved by
                  Google LLC, and nothing in the Service should be read as a statement from Google.
                  Google, Google Business Profile, Google Maps, Google Search Console and related
                  marks are trademarks of Google LLC, used here only to describe interoperability.
                </p>
              </Callout>
            </Section>

            {/* 03 */}
            <Section id="description" index={n("description")} title="Description of the Service">
              <p>
                {ORG.product} is a search-engine-optimisation platform for marketers, agencies and
                business owners. It brings site analysis, content tooling and local-search
                management into one workspace, organised around projects that you create for the
                websites and businesses you work on.
              </p>
              <p>The Service currently includes:</p>
              <Bullets
                items={[
                  "Site auditing and crawling - crawl a site you own or are authorised to test, and review the technical, indexability, structure and internal-linking issues it surfaces.",
                  "Technical, on-page and off-page SEO tooling, including page-speed checks through Google PageSpeed Insights and backlink analysis.",
                  "Keyword research and rank tracking, using third-party datasets and, where you connect it, your own Google Search Console data.",
                  "Content tooling - outlines, entity and n-gram extraction, semantic analysis, E-E-A-T review and AI-assisted drafting.",
                  `Local SEO, including the Google Business Profile integration described in section ${n("google-integration")}.`,
                ]}
              />
              <p>
                Features vary by plan and change over time. Nothing in these Terms commits us to
                keeping any particular feature available - see section {n("availability")}.
              </p>
              <Callout tone="warning">
                <p>
                  <strong>No ranking or results guarantee.</strong> Search engines control their own
                  ranking systems and change them without notice. {ORG.product} provides analysis,
                  recommendations and publishing tools; it cannot and does not guarantee any
                  ranking, traffic, visibility, conversion or revenue outcome.
                </p>
              </Callout>
            </Section>

            {/* 04 */}
            <Section id="accounts" index={n("accounts")} title="Eligibility and User Accounts">
              <p>
                You must be at least 18 years old, and legally able to enter a contract, to use the
                Service. The Service is built for business use and is not directed at children.
              </p>
              <p>
                You can register with an email address and password, or sign in with your Google
                Account. Signing in with Google uses the standard OpenID Connect scopes{" "}
                <code>openid</code>, <code>email</code> and <code>profile</code>; we store only the
                email address and display name Google returns, and we do not retain a Google token
                from the sign-in flow. Signing in with Google is separate from connecting a Business
                Profile, which is covered in section {n("google-integration")}.
              </p>
              <p>You agree to:</p>
              <Bullets
                items={[
                  "Provide accurate registration details and keep them current.",
                  "Keep your password, session tokens and any API credentials confidential.",
                  "Take responsibility for everything done under your account, including by colleagues you give access to.",
                  "Tell us promptly, using the contact details in section " +
                    n("contact") +
                    ", if you believe your account has been accessed without your permission.",
                ]}
              />
            </Section>

            {/* 05 */}
            <Section
              id="responsibilities"
              index={n("responsibilities")}
              title="Your Responsibilities"
            >
              <p>
                {ORG.product} acts on your instructions. You remain responsible for the decisions
                you make with it and for what it publishes on your behalf.
              </p>
              <Bullets
                items={[
                  "You must have the right to analyse, audit and crawl any website you add as a project.",
                  `You must have the right to manage any Google Business Profile location you connect - see section ${n("authorisation")}.`,
                  "You are responsible for the accuracy of every change the Service publishes for you, including profile edits, posts, review replies and Q&A answers.",
                  `You are responsible for reviewing AI-generated drafts before they go out - see section ${n("ai-content")}.`,
                  "You must comply with the terms and policies of every third-party service the Service connects to on your behalf, including Google's.",
                  "You must comply with the laws that apply to you, including advertising, consumer-protection and data-protection law.",
                ]}
              />
            </Section>

            {/* 06 */}
            <Section
              id="google-integration"
              index={n("google-integration")}
              title="Google Business Profile Integration"
            >
              <p>
                {ORG.product} can connect to Google Business Profile so you can manage your business
                listings without leaving the platform. The connection is entirely optional: the rest
                of the Service works without it, and you choose when, and for which project, to set
                one up.
              </p>

              <h3 className="pt-2 font-semibold text-white">
                {n("google-integration")}.1 How the connection is made
              </h3>
              <p>
                You start the connection from the Local SEO area of a project. We redirect you to
                Google&apos;s own OAuth consent screen, where Google - not {ORG.product} - asks you
                to sign in and shows you exactly what you are being asked to grant. Access begins
                only if you approve it there. We never ask for, receive or store your Google
                password.
              </p>
              <p>We request the following scopes, and nothing beyond them:</p>
              <DataTable
                caption="OAuth scopes requested for the Business Profile connection"
                headers={["Scope", "Why it is requested"]}
                rows={SCOPE_ROWS}
                mono={[0]}
              />

              <h3 className="pt-2 font-semibold text-white">
                {n("google-integration")}.2 What the integration does
              </h3>
              <p>
                Once connected, the Service calls the following Google APIs with the access you
                granted, for the locations you choose to attach to a project:
              </p>
              <DataTable
                caption="Google APIs used by the Business Profile integration"
                headers={["Google API", "What it is used for", "Access"]}
                rows={GOOGLE_API_ROWS}
              />
              <p>
                On top of these, the Service stores a copy of the data it retrieves so screens load
                without re-querying Google, scores your profile&apos;s completeness and health,
                summarises review sentiment, and produces recommendations. How that stored copy is
                handled, how long it is kept and how to have it deleted is set out in the{" "}
                <Link to="/privacy" className="font-medium text-brand-600 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>

              <h3 className="pt-2 font-semibold text-white">
                {n("google-integration")}.3 Changes published to your live listing
              </h3>
              <Callout tone="warning">
                <p>
                  <strong>These actions are public and immediate.</strong> When you confirm them,
                  the Service writes to your live Google Business Profile through Google&apos;s
                  APIs, and the result is visible to anyone who finds your business on Google Search
                  or Maps:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  {WRITE_ACTIONS.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
                <p>
                  Review the content before you confirm it. Some changes are also subject to
                  Google&apos;s own review and may be rejected, delayed or reverted by Google.
                </p>
              </Callout>
              <p>
                Where you enable automation rules, recurring post schedules or automatic review
                replies, you are instructing the Service to perform these actions on your behalf
                without a further prompt each time. You remain responsible for their output, and you
                can disable them at any time.
              </p>

              <h3 className="pt-2 font-semibold text-white">
                {n("google-integration")}.4 Disconnecting
              </h3>
              <p>
                You can disconnect a Business Profile from the Local SEO area of the project at any
                time. Disconnecting asks Google to revoke the token we hold and removes the stored
                connection, its cached account list, its attached locations and their metrics from
                our database.
              </p>
              <p>
                Independently of the Service, you can revoke our access yourself at any time from
                your Google Account&apos;s third-party access settings at{" "}
                <a
                  href="https://myaccount.google.com/connections"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-brand-600 hover:underline"
                >
                  myaccount.google.com/connections
                </a>
                . Revoking access there stops all further Google API calls immediately; features
                that depend on the connection will stop working until you reconnect.
              </p>
            </Section>

            {/* 07 */}
            <Section
              id="authorisation"
              index={n("authorisation")}
              title="Authorisation and Permissions"
            >
              <p>
                Google&apos;s authorisation system, not {ORG.product}, decides what the connection
                can reach. The Service can only ever see and act on the Business Profile locations
                that the Google Account you signed in with is already an owner or manager of. We do
                not bypass, weaken or work around that system, and we cannot grant you access to a
                listing Google has not granted you.
              </p>
              <p>
                A successful connection that returns no accounts or locations is a normal outcome -
                it means the Google Account you used does not administer any Business Profile - not
                a fault in the Service.
              </p>
              <p>By connecting a Google Account you confirm that:</p>
              <Bullets
                items={[
                  "You are an owner or manager of the Business Profile locations you attach, or you act with the documented permission of the business that owns them.",
                  "You are authorised to publish changes, posts, review replies and answers on that business's behalf.",
                  "You will disconnect any location for which that authority ends.",
                ]}
              />
              <p>
                If you manage listings for clients, you are responsible for holding that authority
                from each client and for producing evidence of it on request.
              </p>
            </Section>

            {/* 08 */}
            <Section id="third-party" index={n("third-party")} title="Third-Party Services">
              <p>
                The Service depends on third-party providers. Their availability, behaviour, rate
                limits and pricing are outside our control, and a change on their side can change or
                interrupt what the Service can do.
              </p>
              <DataTable
                caption="Third-party services the platform relies on"
                headers={["Provider", "Role in the Service", "Governed by"]}
                rows={THIRD_PARTY_ROWS}
              />
              <p>
                Your use of Google services through {ORG.product} is additionally governed by
                Google&apos;s own terms, including the{" "}
                <a
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Google Terms of Service
                </a>
                , the Google Business Profile Additional Terms of Service, and Google&apos;s content
                policies for Business Profiles, reviews and posts. Where those terms conflict with
                these Terms in relation to Google services, Google&apos;s terms govern your use of
                Google&apos;s services. You are responsible for complying with them, and a breach of
                them may also be a breach of these Terms.
              </p>
            </Section>

            {/* 09 */}
            <Section id="acceptable-use" index={n("acceptable-use")} title="Acceptable Use">
              <p>
                You may use the Service for its intended purpose: analysing, improving and managing
                the search presence of websites and businesses you own or are authorised to act for.
                You must use it lawfully, honestly, and in a way that does not damage the Service,
                other users, or the third-party platforms it connects to.
              </p>
              <p>
                We apply rate limits and quotas to protect the platform and to stay within the
                quotas Google and other providers allocate to us. You must not attempt to evade
                them, and we may throttle or pause activity on an account that threatens the
                stability of the Service or our standing with a provider.
              </p>
            </Section>

            {/* 10 */}
            <Section id="prohibited" index={n("prohibited")} title="Prohibited Activities">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <Ban className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                <div className="space-y-3">
                  <p className="text-sm text-white/70">
                    You must not, and must not allow anyone else to:
                  </p>
                  <Bullets items={PROHIBITED} />
                </div>
              </div>
              <p>
                We may investigate suspected breaches and take the steps described in section{" "}
                {n("termination")}, including reporting unlawful activity to the relevant
                authorities or to the affected platform.
              </p>
            </Section>

            {/* 11 */}
            <Section id="ai-content" index={n("ai-content")} title="AI-Generated Content">
              <p>
                Several features generate draft text for you - post copy, review replies, Q&amp;A
                answers, outlines and article drafts. These are produced by a third-party AI model
                and are drafts, not finished work.
              </p>
              <Bullets
                items={[
                  "AI output can be inaccurate, incomplete, generic or inappropriate for your business. Check it before you use it.",
                  "A draft is only published to a Google Business Profile when you confirm it, or when you have deliberately enabled an automation or auto-reply rule that publishes on your behalf.",
                  "If you enable automatic publishing, you accept responsibility for the content published under that rule, and you should monitor its output.",
                  "You are responsible for ensuring that anything you publish is accurate, complies with Google's content policies, and complies with any disclosure rules that apply to you.",
                ]}
              />
              <p>
                As between you and us, and to the extent we hold any rights in it, the output
                generated for you is yours to use. We make no representation that AI output is
                original, non-infringing or unique to you - comparable prompts can produce
                comparable text for other users.
              </p>
            </Section>

            {/* 12 */}
            <Section id="your-content" index={n("your-content")} title="Your Content and Data">
              <p>
                &quot;Your Content&quot; means everything you put into the Service or that the
                Service retrieves on your instruction: project settings, uploaded files, drafts you
                write, crawl results for your sites, and the Google Business Profile data retrieved
                under an authorisation you granted.
              </p>
              <p>
                You keep all ownership of Your Content. You grant us a limited, non-exclusive,
                worldwide, royalty-free licence to host, store, process, transmit and display it -
                and to share it with the providers in section {n("third-party")} - purely to operate
                the Service and deliver the features you use. That licence exists for no other
                purpose and ends when the content is deleted, subject to the backup cycles described
                in the{" "}
                <Link to="/privacy" className="font-medium text-brand-600 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                Data obtained from Google APIs is handled in line with the Google API Services User
                Data Policy, including its Limited Use requirements. We do not sell it, and we do
                not use it for advertising. The full treatment of Google user data - what is
                accessed, why, how it is stored and protected, how long it is kept and how to have
                it deleted - is set out in the Privacy Policy.
              </p>
              <p>
                You are responsible for keeping your own copies of anything you would not want to
                lose. We do not hold Your Content as a backup service.
              </p>
            </Section>

            {/* 13 */}
            <Section
              id="intellectual-property"
              index={n("intellectual-property")}
              title="Intellectual Property"
            >
              <p>
                The Service - its software, interface, design, documentation, scoring models and the{" "}
                {ORG.product} name and logo - is owned by <Val>{ORG.legalName}</Val> or its
                licensors and is protected by intellectual-property law. Subject to these Terms and
                to payment of any applicable fees, we grant you a limited, non-exclusive,
                non-transferable, revocable licence to use the Service for your internal business
                purposes.
              </p>
              <p>
                Nothing in these Terms transfers ownership of the Service to you. All rights not
                expressly granted are reserved. Third-party names and marks that appear in the
                Service, including Google&apos;s, belong to their respective owners and are used
                only to identify those services.
              </p>
              <p>
                If you send us feedback or suggestions, we may use them to improve the Service
                without obligation or payment to you.
              </p>
            </Section>

            {/* 14 */}
            <Section id="fees" index={n("fees")} title="Plans, Fees and Billing">
              <p>
                Some features are available on paid plans. The plans, their inclusions and their
                prices are shown in the pricing section of our homepage, and the plan you select at
                checkout is the one that applies to you.
              </p>
              <Bullets
                items={[
                  "Subscription fees are billed in advance for the billing period you choose, and payments are processed by Stripe. We do not store your full card details.",
                  "Unless stated otherwise at checkout, subscriptions renew automatically at the end of each period until you cancel.",
                  "You can cancel at any time; cancellation takes effect at the end of the current period, and access continues until then.",
                  "Fees are exclusive of taxes unless stated otherwise, and you are responsible for any taxes that apply to you.",
                  "We may change prices, and will give reasonable advance notice before a change affects a renewal.",
                ]}
              />
              <p>
                Except where a refund is required by law or expressly offered at the point of sale,
                fees already paid are non-refundable.
              </p>
            </Section>

            {/* 15 */}
            <Section
              id="availability"
              index={n("availability")}
              title="Service Availability and Changes"
            >
              <p>
                We work to keep the Service available and dependable, but we do not promise
                uninterrupted or error-free operation, and we do not offer a service-level guarantee
                unless one is agreed with you separately in writing.
              </p>
              <p>The Service may be unavailable or degraded because of:</p>
              <Bullets
                items={[
                  "Planned maintenance and deployments.",
                  `Faults, outages, quota limits or policy changes at Google or another provider listed in section ${n("third-party")}.`,
                  "Events outside our reasonable control, including network, hosting and infrastructure failures.",
                ]}
              />
              <p>
                We may add, change, suspend or withdraw features at any time. Where a change
                materially reduces the functionality of a paid plan, we will give reasonable notice
                and, where appropriate, a pro-rated refund for the unused part of the period.
              </p>
            </Section>

            {/* 16 */}
            <Section id="termination" index={n("termination")} title="Suspension and Termination">
              <p>
                You may stop using the Service and close your account at any time by contacting us
                at <MailLink address={ORG.email.support} />.
              </p>
              <p>
                We may suspend or terminate your access, with notice where it is reasonable to give
                it and immediately where it is not, if:
              </p>
              <Bullets
                items={[
                  `You breach these Terms, in particular sections ${n("authorisation")} and ${n("prohibited")}.`,
                  "Your use puts the Service, other users, or our standing with Google or another provider at risk.",
                  "Payment for a paid plan fails and is not resolved after we ask you to fix it.",
                  "We are required to do so by law, or by a provider whose service we depend on.",
                ]}
              />
              <p>On termination, for whatever reason:</p>
              <Bullets
                items={[
                  "Your right to use the Service ends immediately.",
                  "Any Google Business Profile connection is disconnected and the token we hold is revoked with Google.",
                  "Your data is deleted or retained in line with the retention periods in the Privacy Policy. You can ask us to delete it sooner using the process described there.",
                  `Sections that by their nature should survive - including ${n("intellectual-property")}, ${n("disclaimers")}, ${n("liability")}, ${n("indemnity")} and ${n("governing-law")} - continue to apply.`,
                ]}
              />
            </Section>

            {/* 17 */}
            <Section id="privacy" index={n("privacy")} title="Privacy and Data Protection">
              <p>
                Our{" "}
                <Link to="/privacy" className="font-medium text-brand-600 hover:underline">
                  Privacy Policy
                </Link>{" "}
                explains what personal information and Google user data the Service handles, why,
                who it is shared with, how it is secured, how long it is kept, and how to have it
                deleted. It forms part of these Terms.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  <KeyRound className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Deleting your data or revoking Google access
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm text-white/65">
                  <li className="flex gap-3">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                      aria-hidden="true"
                    />
                    <span>
                      <strong className="font-semibold text-white">In the Service:</strong>{" "}
                      disconnect the Business Profile from the project&apos;s Local SEO area. This
                      revokes the token with Google and deletes the stored connection and its
                      locations.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                      aria-hidden="true"
                    />
                    <span>
                      <strong className="font-semibold text-white">In your Google Account:</strong>{" "}
                      remove {ORG.product} at{" "}
                      <a
                        href="https://myaccount.google.com/connections"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-medium text-brand-600 hover:underline"
                      >
                        myaccount.google.com/connections
                      </a>
                      .
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                      aria-hidden="true"
                    />
                    <span>
                      <strong className="font-semibold text-white">By email:</strong> write to{" "}
                      <MailLink address={ORG.email.privacy} /> to request deletion of your account,
                      your Google-derived data and any tokens we hold.
                    </span>
                  </li>
                </ul>
              </div>
            </Section>

            {/* 18 */}
            <Section id="disclaimers" index={n("disclaimers")} title="Disclaimers">
              <p>
                To the fullest extent permitted by law, the Service is provided &quot;as is&quot;
                and &quot;as available&quot;, without warranties of any kind, whether express,
                implied or statutory, including implied warranties of merchantability, fitness for a
                particular purpose, non-infringement and accuracy.
              </p>
              <p>In particular, we do not warrant that:</p>
              <Bullets
                items={[
                  "The Service will be uninterrupted, timely, secure or free of errors.",
                  "Audits, scores, recommendations or AI drafts are accurate, complete or suitable for your circumstances - they are informational, not professional advice.",
                  "Third-party data, including keyword, ranking and backlink datasets, is accurate or current.",
                  "Using the Service will produce any particular ranking, traffic or commercial result.",
                  "Google or any other provider will accept, retain or continue to display a change published through the Service.",
                ]}
              />
              <p>
                Nothing in these Terms excludes or limits any liability that cannot lawfully be
                excluded or limited, including liability for death or personal injury caused by
                negligence, or for fraud. If your local law gives you consumer rights that cannot be
                waived, those rights are unaffected.
              </p>
            </Section>

            {/* 19 */}
            <Section id="liability" index={n("liability")} title="Limitation of Liability">
              <p>
                To the fullest extent permitted by law, neither party is liable to the other for
                indirect, incidental, special, consequential, exemplary or punitive damages, or for
                loss of profits, revenue, goodwill, business opportunity, or loss or corruption of
                data, however caused and under any theory of liability, even if advised that such
                damages were possible.
              </p>
              <p>
                To the fullest extent permitted by law, our total aggregate liability arising out of
                or relating to the Service and these Terms is limited to the greater of the total
                fees you paid us for the Service in the twelve months immediately before the event
                giving rise to the claim, or one hundred US dollars (USD 100).
              </p>
              <p>
                In particular, we are not liable for loss arising from changes published to a live
                Google Business Profile at your instruction or under an automation rule you enabled,
                from action taken by Google in respect of a listing or account, or from the
                unavailability of a third-party service.
              </p>
              <p>These limits apply subject to section {n("disclaimers")}.</p>
            </Section>

            {/* 20 */}
            <Section id="indemnity" index={n("indemnity")} title="Indemnity">
              <p>
                You agree to indemnify and hold us harmless against claims, losses, liabilities and
                reasonable costs, including legal fees, arising from your breach of these Terms,
                your breach of a third-party platform&apos;s terms, your infringement of another
                party&apos;s rights, or a claim that you were not authorised to manage a Business
                Profile, website or other property you connected to the Service.
              </p>
              <p>
                We will notify you of any such claim, give you reasonable control of its defence,
                and cooperate at your expense. You may not settle a claim in a way that imposes an
                obligation on us without our written consent.
              </p>
            </Section>

            {/* 21 */}
            <Section id="changes" index={n("changes")} title="Changes to These Terms">
              <p>
                We may update these Terms as the Service and the law change. When we do, we will
                revise the &quot;Last updated&quot; date at the top of this page.
              </p>
              <p>
                For material changes - those that meaningfully affect your rights or obligations -
                we will give notice before they take effect, by email to the address on your account
                or by a notice inside the Service, normally at least 14 days in advance. Continuing
                to use the Service after a change takes effect means you accept the revised Terms.
                If you do not accept them, stop using the Service and close your account before the
                effective date.
              </p>
            </Section>

            {/* 22 */}
            <Section
              id="governing-law"
              index={n("governing-law")}
              title="Governing Law and Disputes"
            >
              <p>
                These Terms, and any dispute arising out of or in connection with them or the
                Service, are governed by the laws of <Val>{ORG.jurisdiction}</Val>, without regard
                to its conflict-of-laws rules.
              </p>
              <p>
                The courts of <Val>{ORG.courts}</Val> have exclusive jurisdiction over any such
                dispute, and both parties submit to that jurisdiction. If you are a consumer, this
                does not deprive you of the protection of the mandatory laws of your country of
                residence, or of the right to bring proceedings there.
              </p>
              <p>
                Before starting formal proceedings, please contact us at{" "}
                <MailLink address={ORG.email.legal} /> so we can try to resolve the matter directly.
              </p>
              <p>
                If a provision of these Terms is found unenforceable, it is severed and the rest
                continues in force. Our failure to enforce a provision is not a waiver of it. These
                Terms, together with the Privacy Policy, are the entire agreement between us about
                the Service.
              </p>
            </Section>

            {/* 23 */}
            <Section id="contact" index={n("contact")} title="Contact Us">
              <p>
                For questions about these Terms, the Google Business Profile integration, your
                account, or a data-deletion request, contact us using the details below. We aim to
                respond within five business days.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      General and account support
                    </h4>
                    <address className="mt-1 text-sm not-italic leading-relaxed text-white/65">
                      <MailLink address={ORG.email.support} />
                    </address>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Privacy, Google data and deletion
                    </h4>
                    <address className="mt-1 text-sm not-italic leading-relaxed text-white/65">
                      <MailLink address={ORG.email.privacy} />
                    </address>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Legal notices
                    </h4>
                    <address className="mt-1 text-sm not-italic leading-relaxed text-white/65">
                      <MailLink address={ORG.email.legal} />
                    </address>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Postal address
                    </h4>
                    <address className="mt-1 space-y-1 text-sm not-italic leading-relaxed text-white/65">
                      <div>
                        <Val>{ORG.legalName}</Val>
                      </div>
                      {ORG.address.map((line) => (
                        <div key={line}>
                          <Val>{line}</Val>
                        </div>
                      ))}
                    </address>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link to="/privacy" className="ui-button ui-button-secondary">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Privacy Policy
                </Link>
                <Link to="/" className="ui-button ui-button-secondary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Back to {ORG.product}
                </Link>
              </div>
            </Section>
          </article>
        </div>
      </div>

      {/* Back to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-brand-glow transition-opacity ${
          showTop ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  );
}
