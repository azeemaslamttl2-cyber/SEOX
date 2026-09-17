import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  FileCheck2,
  Info,
  KeyRound,
  Lock,
  Mail,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Public privacy policy.
 *
 * Rendered inside RootLayout, so it inherits the marketing Navbar and
 * Footer. The markup deliberately uses the same legacy utility
 * vocabulary as the other public sections (text-white, border-white/10,
 * bg-white/[0.02]) because the compatibility layer in index.css remaps
 * those names to the light palette. Modern token classes would render
 * correctly on their own but would not match Hero/FAQ/Footer, and the
 * !important remaps would still win wherever the two overlapped.
 *
 * framer-motion is intentionally not imported. It is a 115 KB dependency
 * that only HomePage pulls in; a static legal page does not justify
 * dragging that chunk onto a second entry point.
 * ------------------------------------------------------------------ */

const LAST_UPDATED = { iso: "2026-09-01", label: "1 September 2026" };
const EFFECTIVE = { iso: "2026-09-15", label: "15 September 2026" };

const META_DESCRIPTION =
  "How PGC collects, uses, shares and protects personal information, how long we keep it, " +
  "and the privacy rights and choices available to you.";

const SECTIONS = [
  { id: "introduction", title: "Introduction" },
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use-your-information", title: "How We Use Your Information" },
  { id: "cookies-and-tracking", title: "Cookies and Tracking Technologies" },
  { id: "third-party-services", title: "Third-Party Services" },
  { id: "data-storage-and-security", title: "Data Storage and Security" },
  { id: "data-retention", title: "Data Retention" },
  { id: "user-rights", title: "Your Rights and Choices" },
  { id: "childrens-privacy", title: "Children's Privacy" },
  { id: "policy-changes", title: "Changes to This Privacy Policy" },
  { id: "contact-information", title: "Contact Information" },
];

const SUMMARY_CARDS = [
  {
    icon: Check,
    title: "We never sell your data",
    body: "We do not sell personal information, and we do not share it for cross-context behavioural advertising.",
  },
  {
    icon: Lock,
    title: "Encrypted in transit and at rest",
    body: "TLS 1.2+ protects data on the wire; AES-256 protects stored data and backups.",
  },
  {
    icon: Clock,
    title: "Non-essential cookies are opt-in",
    body: "Analytics and marketing tags load only after you consent, and you can withdraw consent at any time.",
  },
  {
    icon: Download,
    title: "Export or delete anytime",
    body: "Download a machine-readable copy of your account data, or ask us to erase it, from your settings.",
  },
];

const PROCESSING_ROWS = [
  ["Creating and administering your account", "Account information", "Performance of a contract"],
  ["Running crawls, audits and reports you request", "Account, project and usage data", "Performance of a contract"],
  ["Processing payments and preventing payment fraud", "Billing information, device data", "Contract; legal obligation"],
  ["Responding to support requests", "Communications, account information", "Contract; legitimate interests"],
  ["Securing our systems and investigating abuse", "Server logs, device data", "Legitimate interests; legal obligation"],
  ["Measuring and improving product performance", "Aggregated usage and analytics data", "Consent (analytics cookies)"],
  ["Sending product updates and marketing email", "Contact details, engagement data", "Consent, or soft opt-in for customers"],
  ["Meeting tax, accounting and legal obligations", "Billing records, correspondence", "Legal obligation"],
];

const COOKIE_ROWS = [
  ["pgc_session", "Strictly necessary", "Keeps you signed in between page loads", "Session"],
  ["pgc_csrf", "Strictly necessary", "Protects forms against cross-site request forgery", "Session"],
  ["pgc_consent", "Strictly necessary", "Stores your cookie preferences", "6 months"],
  ["pgc_locale", "Functional", "Remembers your language and display preferences", "12 months"],
  ["_analytics_id", "Analytics", "Distinguishes visitors for aggregate traffic reporting", "13 months"],
  ["_campaign_ref", "Marketing", "Measures campaign performance across referrals", "90 days"],
];

const SUBPROCESSOR_ROWS = [
  ["[CLOUD PROVIDER]", "Application hosting, database and object storage", "All service data", "EU, US"],
  ["[PAYMENT PROCESSOR]", "Subscriptions, payments and invoicing", "Billing details", "US, EU"],
  ["[EMAIL PROVIDER]", "Transactional and marketing email", "Name, email, engagement", "EU"],
  ["[ANALYTICS PROVIDER]", "Aggregate product analytics", "Pseudonymous usage events", "EU"],
  ["[SUPPORT DESK]", "Help desk and live chat", "Ticket content, contact details", "EU"],
  ["[ERROR MONITORING]", "Crash and error reporting", "Stack traces, scrubbed request data", "EU"],
];

const RETENTION_ROWS = [
  ["Active account data", "For the life of the account", "To provide the Services"],
  ["Closed account data", "30 days, then deleted", "Grace period for accidental closure"],
  ["Crawl results and audit reports", "12 months after the project is deleted", "So you can restore recent work"],
  ["Encrypted backups", "35 days on a rolling cycle", "Disaster recovery"],
  ["Invoices and tax records", "[7 years]", "Statutory accounting obligations"],
  ["Support tickets", "24 months after closure", "Service quality and dispute handling"],
  ["Security and access logs", "12 months", "Incident investigation"],
  ["Marketing contacts", "Until you unsubscribe, then 12 months", "Proof of consent withdrawal"],
];

const SECURITY_CARDS = [
  {
    icon: Lock,
    title: "Encryption",
    body: "TLS 1.2+ with HSTS in transit; AES-256 for stored data and backups. Secrets live in a managed key vault with automatic rotation.",
  },
  {
    icon: KeyRound,
    title: "Access control",
    body: "Least-privilege, role-based access with mandatory multi-factor authentication. Administrative access is time-bound and logged.",
  },
  {
    icon: Database,
    title: "Monitoring",
    body: "Centralised audit logging, anomaly alerting and on-call coverage for security events affecting production.",
  },
  {
    icon: FileCheck2,
    title: "Assurance",
    body: "Annual third-party penetration testing, continuous dependency scanning and [SOC 2 TYPE II / ISO 27001] certification.",
  },
];

const RIGHTS = [
  ["Access", "ask whether we hold data about you and receive a copy of it."],
  ["Rectification", "have inaccurate or incomplete data corrected."],
  ["Erasure", "ask us to delete data we no longer have a lawful reason to keep."],
  ["Restriction", "ask us to pause processing while a dispute is resolved."],
  ["Portability", "receive your data in a structured, machine-readable format, or have it sent to another provider."],
  ["Objection", "object to processing based on our legitimate interests, including profiling."],
  ["Withdraw consent", "withdraw consent at any time, without affecting processing already carried out."],
  ["Opt out of marketing", "unsubscribe from any marketing email using the link in its footer."],
  ["Non-discrimination", "receive equal service and pricing when you exercise a privacy right."],
];

const REVISIONS = [
  ["2026-09-01", "Added the sub-processor table, documented Global Privacy Control support, and clarified backup retention."],
  ["2026-03-14", "Expanded US state privacy rights and introduced the request appeal process."],
  ["2025-08-22", "Moved analytics behind a consent-gated loader; shortened log retention from 24 to 12 months."],
  ["2025-01-10", "First published."],
];

const CONSENT_GATE_CODE = `// SAMPLE ONLY - replace the IDs and endpoint with your own values.
const CONSENT_KEY = 'pgc_consent';
const CONSENT_VERSION = 2; // bump to re-prompt after a policy change

function readConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    return saved && saved.version === CONSENT_VERSION ? saved : null;
  } catch {
    return null; // storage blocked (private mode, blocked cookies)
  }
}

function saveConsent(categories) {
  const record = {
    version: CONSENT_VERSION,
    grantedAt: new Date().toISOString(),
    analytics: Boolean(categories.analytics),
    marketing: Boolean(categories.marketing),
  };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch {}
  applyConsent(record);
}

function applyConsent(consent) {
  if (consent.analytics) loadAnalytics();
  // Marketing tags are gated exactly the same way:
  // if (consent.marketing) loadMarketingPixel();
}

let analyticsLoaded = false;
function loadAnalytics() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  const s = document.createElement('script');
  s.src = 'https://analytics.example.com/tag.js?id=MEASUREMENT_ID';
  s.async = true;
  document.head.appendChild(s);
}

// Respect an opt-out signal before any banner is shown.
const optedOut = navigator.globalPrivacyControl === true;
const existing = readConsent();

if (optedOut) {
  saveConsent({ analytics: false, marketing: false });
} else if (existing) {
  applyConsent(existing);
} else {
  showConsentBanner(); // your banner UI calls saveConsent({ ... })
}`;

const CONSENT_DEFAULTS_CODE = `<!-- Place this before any tag manager or analytics script. -->
<script>
  window.dataLayer = window.dataLayer || [];
  function track() { dataLayer.push(arguments); }

  track('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  // Called by the banner once the visitor accepts analytics:
  function grantAnalytics() {
    track('consent', 'update', { analytics_storage: 'granted' });
  }
<\/script>`;

const HEADERS_CODE = `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' data:; frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: geolocation=(), camera=(), microphone=()
Set-Cookie: pgc_session=...; HttpOnly; Secure; SameSite=Lax; Path=/`;

const EXPORT_CODE = `# SAMPLE - illustrative endpoint and token.
curl -X POST "https://api.example.com/v1/privacy/export" \\
  -H "Authorization: Bearer $PGC_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "format": "json", "include": ["profile", "projects", "billing"] }'

# 202 Accepted
# {
#   "request_id": "exp_9f3a21c4",
#   "status": "queued",
#   "estimated_ready_at": "2026-09-18T09:00:00Z",
#   "delivery": "A signed download link is emailed to the account owner
#                and expires 72 hours after it is generated."
# }`;

/* ------------------------------------------------------------------ *
 * Presentational helpers
 * ------------------------------------------------------------------ */

/** Marks example text the site owner must swap for real legal details. */
function Placeholder({ children }) {
  return (
    <span className="mx-0.5 inline-block max-w-full break-all rounded-md border border-dashed border-white/20 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.82em] text-white/70 sm:whitespace-nowrap sm:break-normal">
      {children}
    </span>
  );
}

function Section({ id, index, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 border-t border-white/10 py-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-heading`} className="flex items-baseline gap-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
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

function Card({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      {Icon ? (
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-brand-500/25 bg-brand-500/10 text-brand-600">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/60">{children}</p>
    </div>
  );
}

/**
 * Renders placeholder tokens like [CLOUD PROVIDER] inside table cells as
 * dashed chips, so example values stay obvious wherever they appear.
 */
function Cell({ value }) {
  const parts = String(value).split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[") ? <Placeholder key={i}>{part}</Placeholder> : <span key={i}>{part}</span>
      )}
    </>
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
                <th key={h} scope="col" className="whitespace-nowrap border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-white/10 last:border-0">
                {row.map((cell, c) => (
                  <td key={c} className={`px-4 py-3 align-top text-white/65 ${mono.includes(c) ? "font-mono text-[13px] text-white/80" : ""}`}>
                    <Cell value={cell} />
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

function CodeBlock({ filename, code, language = "text" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure origin, denied permission). The
      // code stays selectable, so there is nothing to recover from.
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.02] px-4 py-2">
        <span className="font-mono text-xs text-white/55">{filename}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-navy-950 px-4 py-4 text-[12.5px] leading-relaxed text-[#dde1f2]">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function PrivacyPolicy() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [showTop, setShowTop] = useState(false);

  /* There is no Helmet or metadata framework in this SPA, so the document
     head is set here and restored on unmount to avoid leaking the legal
     title into whatever route the visitor opens next. */
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy | PGC";

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

  const sectionNumber = (id) => SECTIONS.findIndex((s) => s.id === id) + 1;

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
                Privacy Policy
              </li>
            </ol>
          </nav>

          <span className="chip">Legal &amp; Trust Center</span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Privacy <span className="gradient-text">Policy</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/60">
            This policy explains what personal information PGC collects when you visit our website or
            use our SEO platform, why we collect it, who we share it with, how long we keep it, and
            the choices and rights you have over it.
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
              <ShieldCheck className="h-4 w-4 text-white/40" aria-hidden="true" />
              <dt className="sr-only">Reading time</dt>
              <dd>About a 9 minute read</dd>
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
            <a
              href="#contact-information"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact our privacy team
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
              <h2 id="toc-heading" className="px-2 text-[11px] font-bold uppercase tracking-wider text-white/45">
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

          {/* Policy */}
          <article className="min-w-0 max-w-3xl">
            <div className="mb-10">
              <Callout tone="warning">
                <p>
                  <strong>Sample content notice.</strong> Every value in a dashed box — for example{" "}
                  <Placeholder>[COMPANY LEGAL NAME]</Placeholder> or{" "}
                  <Placeholder>[REGISTERED ADDRESS]</Placeholder> — is example text that must be
                  replaced with this site&apos;s real legal details before the page is published.
                </p>
                <p>
                  This is drafting scaffolding, not legal advice. Have qualified counsel review the
                  final wording against the laws that apply to you (GDPR, UK GDPR, CCPA/CPRA, PIPEDA
                  or your local equivalent) and confirm that it matches what the platform actually
                  does.
                </p>
              </Callout>
            </div>

            {/* 01 */}
            <Section id="introduction" index={sectionNumber("introduction")} title="Introduction">
              <p>
                <Placeholder>[COMPANY LEGAL NAME]</Placeholder>, trading as <strong className="font-semibold text-white">PGC</strong>{" "}
                (&quot;PGC&quot;, &quot;we&quot;, &quot;us&quot; or &quot;our&quot;), operates the website at{" "}
                <Placeholder>[https://www.example.com]</Placeholder> and the SEO platform, APIs and
                related services that link to this policy (together, the &quot;Services&quot;).
              </p>
              <p>
                This Privacy Policy describes the personal information we handle, the purposes we
                handle it for, the legal bases we rely on where that concept applies, and how you can
                exercise your rights. It applies to everyone who interacts with the Services,
                wherever they are located.
              </p>
              <p>
                It does not apply to third-party websites, products or services that we link to but do
                not control — including sites you submit for crawling and audit. Those are governed by
                their own privacy notices.
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="font-semibold text-white">Who is responsible for your data</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  For the purposes of the EU and UK General Data Protection Regulation, the controller
                  of personal information collected through the Services is{" "}
                  <Placeholder>[COMPANY LEGAL NAME]</Placeholder>, registered at{" "}
                  <Placeholder>[REGISTERED ADDRESS]</Placeholder>, company number{" "}
                  <Placeholder>[COMPANY REGISTRATION NUMBER]</Placeholder>. Where we process content
                  on behalf of a business customer, we act as a processor and handle that content
                  under our Data Processing Addendum rather than this policy.
                </p>
              </div>

              <h3 className="pt-2 font-semibold text-white">Summary at a glance</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {SUMMARY_CARDS.map((card) => (
                  <Card key={card.title} icon={card.icon} title={card.title}>
                    {card.body}
                  </Card>
                ))}
              </div>
            </Section>

            {/* 02 */}
            <Section id="information-we-collect" index={sectionNumber("information-we-collect")} title="Information We Collect">
              <p>
                We collect information in three ways: information you give us directly, information
                collected automatically as you use the Services, and information we receive from third
                parties.
              </p>

              <h3 className="pt-2 font-semibold text-white">2.1 Information you provide to us</h3>
              <dl className="space-y-3">
                {[
                  ["Account information", "Name, work email address, password hash, job title, company name and the time zone you select when you create an account."],
                  ["Project data", "The domains, URLs, keywords, competitors and crawl settings you add to a project, together with the reports generated from them."],
                  ["Billing information", "Billing contact, billing address, VAT or tax identifier, and the last four digits and expiry of your payment card. Full card numbers go directly to our payment provider's hosted fields and never reach our servers."],
                  ["Support and communications", "The content of support tickets, emails, chat transcripts, call notes and any attachments you send us."],
                  ["Connected accounts", "Tokens and account identifiers you authorise when you connect a third-party service such as a search console or analytics property."],
                  ["Optional submissions", "Newsletter sign-ups, webinar registrations, survey responses, testimonials and job applications."],
                ].map(([term, def]) => (
                  <div key={term}>
                    <dt className="font-semibold text-white">{term}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-white/60">{def}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="pt-2 font-semibold text-white">2.2 Information collected automatically</h3>
              <ul className="list-disc space-y-2 pl-5 marker:text-brand-500">
                <li>
                  <strong className="font-semibold text-white">Device and connection data</strong> — IP
                  address, browser type and version, operating system, screen size, device type and
                  preferred language.
                </li>
                <li>
                  <strong className="font-semibold text-white">Usage data</strong> — pages and features
                  viewed, referring URL, actions taken, session duration and timestamps.
                </li>
                <li>
                  <strong className="font-semibold text-white">Server logs</strong> — HTTP method,
                  requested path, status code, response time and a truncated IP address retained for
                  security monitoring.
                </li>
                <li>
                  <strong className="font-semibold text-white">Cookies and similar technologies</strong>{" "}
                  — as described in <a href="#cookies-and-tracking" className="font-medium text-brand-600 hover:underline">Section 4</a>.
                </li>
              </ul>

              <h3 className="pt-2 font-semibold text-white">2.3 Information from third parties</h3>
              <ul className="list-disc space-y-2 pl-5 marker:text-brand-500">
                <li>
                  <strong className="font-semibold text-white">Single sign-on providers</strong> — if you
                  sign in with a workplace identity provider, we receive your name, email address and
                  avatar URL.
                </li>
                <li>
                  <strong className="font-semibold text-white">Payment processors</strong> — transaction
                  status, fraud signals and the billing country attached to your payment method.
                </li>
                <li>
                  <strong className="font-semibold text-white">Data partners</strong> — search volume,
                  backlink and ranking datasets we license to power reports. These describe websites
                  rather than individuals.
                </li>
              </ul>

              <Callout tone="warning">
                <p>
                  <strong>We do not knowingly collect special category data.</strong> Please do not
                  send us health, biometric, genetic, racial or ethnic origin, political, religious or
                  sexual orientation data through support channels or free-text fields. If you do, we
                  will delete it once it is identified.
                </p>
              </Callout>
            </Section>

            {/* 03 */}
            <Section id="how-we-use-your-information" index={sectionNumber("how-we-use-your-information")} title="How We Use Your Information">
              <p>
                We use personal information only for the purposes set out below. Where the GDPR or UK
                GDPR applies, the legal basis we rely on for each purpose is listed alongside it.
              </p>

              <DataTable
                caption="Sample processing table — replace each row with the purposes that genuinely apply to your service."
                headers={["Purpose", "Data used", "Legal basis (EU/UK)"]}
                rows={PROCESSING_ROWS}
              />

              <h3 className="pt-2 font-semibold text-white">Automated decision-making</h3>
              <p>
                We use automated rules to flag suspected spam, abuse and fraudulent payments. These
                checks may temporarily restrict an account, but a member of our team reviews every
                restriction before it becomes permanent. We do not carry out automated decision-making
                that produces legal or similarly significant effects without human involvement.
              </p>

              <h3 className="pt-2 font-semibold text-white">What we will not do</h3>
              <p>
                We do not sell personal information for money, share it for cross-context behavioural
                advertising, or use the content in your workspace to train machine-learning models
                unless you have explicitly enabled a feature that says so.
              </p>
            </Section>

            {/* 04 */}
            <Section id="cookies-and-tracking" index={sectionNumber("cookies-and-tracking")} title="Cookies and Tracking Technologies">
              <p>
                Cookies are small text files stored on your device. We also use closely related
                technologies such as <code className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[0.85em] text-white/80">localStorage</code>, pixels
                and SDKs. Strictly necessary cookies are set as soon as you arrive because the
                Services cannot function without them. Every other category loads only after you opt
                in through our consent banner.
              </p>

              <DataTable
                caption="Example cookie inventory — audit your own site and list the real cookies, providers and durations."
                headers={["Cookie", "Category", "Purpose", "Expires"]}
                rows={COOKIE_ROWS}
                mono={[0]}
              />

              <h3 className="pt-2 font-semibold text-white">Managing your preferences</h3>
              <p>
                You can change your choices at any time from the cookie preferences panel, or by
                clearing cookies in your browser settings. Blocking strictly necessary cookies will
                break sign-in and other core features. We also honour the{" "}
                <a href="https://globalprivacycontrol.org/" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
                  Global Privacy Control
                </a>{" "}
                signal where it is legally recognised.
              </p>

              <h3 className="pt-2 font-semibold text-white">Example: a minimal consent gate</h3>
              <p>
                The snippet below shows the pattern we follow — no analytics tag is loaded until
                consent is stored. Treat it as an illustration of the approach rather than production
                code; a real deployment should use an audited consent management platform.
              </p>
              <CodeBlock filename="consent-gate.js — sample" code={CONSENT_GATE_CODE} language="javascript" />

              <p>
                If your analytics vendor supports a consent-mode API, every non-essential purpose
                should default to denied until the visitor chooses:
              </p>
              <CodeBlock filename="consent-defaults.html — sample" code={CONSENT_DEFAULTS_CODE} language="html" />
              <p className="text-sm text-white/45">
                Replace <code className="font-mono">MEASUREMENT_ID</code> and the vendor endpoint with
                your own values, and delete any category you do not actually use.
              </p>
            </Section>

            {/* 05 */}
            <Section id="third-party-services" index={sectionNumber("third-party-services")} title="Third-Party Services">
              <p>
                We rely on a small set of vetted providers (sub-processors) to run the Services. Each
                is bound by a written data processing agreement, may use personal information only on
                our documented instructions, and is reviewed before onboarding and annually
                thereafter.
              </p>

              <DataTable
                caption="Example sub-processor list — publish and maintain your own at a stable URL."
                headers={["Provider", "Function", "Data processed", "Region"]}
                rows={SUBPROCESSOR_ROWS}
              />

              <h3 className="pt-2 font-semibold text-white">International transfers</h3>
              <p>
                Some providers process data outside the country where you live. When we transfer
                personal information out of the European Economic Area, the United Kingdom or
                Switzerland, we rely on an adequacy decision where one exists, and otherwise on the
                European Commission&apos;s Standard Contractual Clauses together with the UK
                International Data Transfer Addendum, supported by a transfer impact assessment. You
                can request a copy of the safeguards we use by writing to{" "}
                <Placeholder>[privacy@example.com]</Placeholder>.
              </p>

              <h3 className="pt-2 font-semibold text-white">Other disclosures</h3>
              <ul className="list-disc space-y-2 pl-5 marker:text-brand-500">
                <li>
                  <strong className="font-semibold text-white">Legal and regulatory</strong> — where we
                  must comply with a valid court order, subpoena or lawful request from a public
                  authority. We notify affected customers unless legally prohibited.
                </li>
                <li>
                  <strong className="font-semibold text-white">Enforcement and safety</strong> — to
                  enforce our Terms of Service or protect the rights, property or safety of our users
                  and the public.
                </li>
                <li>
                  <strong className="font-semibold text-white">Corporate transactions</strong> — in
                  connection with a merger, acquisition, financing or sale of assets. Personal
                  information stays subject to this policy until it is replaced by a notice we tell
                  you about in advance.
                </li>
                <li>
                  <strong className="font-semibold text-white">With your direction</strong> — when you
                  connect a third-party integration, we share only the data that integration requires,
                  and its own privacy policy then applies.
                </li>
              </ul>
            </Section>

            {/* 06 */}
            <Section id="data-storage-and-security" index={sectionNumber("data-storage-and-security")} title="Data Storage and Security">
              <p>
                Production data is stored in <Placeholder>[PRIMARY DATA REGION]</Placeholder> with
                encrypted backups replicated to <Placeholder>[BACKUP REGION]</Placeholder>. We
                maintain technical and organisational measures appropriate to the risk, reviewed at
                least annually.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {SECURITY_CARDS.map((card) => (
                  <Card key={card.title} icon={card.icon} title={card.title}>
                    <Cell value={card.body} />
                  </Card>
                ))}
              </div>

              <h3 className="pt-2 font-semibold text-white">Security headers we set</h3>
              <p>
                As one example of our hardening baseline, every response from the Services carries the
                following headers:
              </p>
              <CodeBlock filename="response-headers.conf — sample" code={HEADERS_CODE} language="nginx" />

              <h3 className="pt-2 font-semibold text-white">Breach notification</h3>
              <p>
                No system is perfectly secure, and we cannot guarantee absolute security. If a personal
                data breach is likely to result in a risk to your rights and freedoms, we will notify
                the relevant supervisory authority within 72 hours of becoming aware of it and inform
                affected users without undue delay. To report a vulnerability, email{" "}
                <Placeholder>[security@example.com]</Placeholder>.
              </p>
            </Section>

            {/* 07 */}
            <Section id="data-retention" index={sectionNumber("data-retention")} title="Data Retention">
              <p>
                We keep personal information only for as long as we need it for the purpose it was
                collected for, plus any period required by law. When a retention period ends, the data
                is deleted or irreversibly anonymised on our next scheduled purge.
              </p>

              <DataTable
                caption="Example retention schedule — align these periods with your own legal and operational requirements."
                headers={["Category", "Retention period", "Reason"]}
                rows={RETENTION_ROWS}
              />

              <p>
                Data held in encrypted backups may persist for up to 35 days after deletion from live
                systems. It is isolated from production, is not used for any other purpose, and is
                removed when the backup expires.
              </p>
            </Section>

            {/* 08 */}
            <Section id="user-rights" index={sectionNumber("user-rights")} title="Your Rights and Choices">
              <p>
                Depending on where you live, you may have some or all of the following rights over your
                personal information.
              </p>
              <ul className="list-disc space-y-2 pl-5 marker:text-brand-500">
                {RIGHTS.map(([name, description]) => (
                  <li key={name}>
                    <strong className="font-semibold text-white">{name}</strong> — {description}
                  </li>
                ))}
              </ul>

              <h3 className="pt-2 font-semibold text-white">How to make a request</h3>
              <p>
                Signed-in users can export or delete account data directly from{" "}
                <strong className="font-semibold text-white">Settings → Privacy</strong>. Otherwise,
                email <Placeholder>[privacy@example.com]</Placeholder> with the subject line
                &quot;Privacy request&quot;. We acknowledge within 5 business days and respond within
                30 days, or within 45 days where US state law permits an extension and we tell you
                why. We may ask for information to verify your identity, and we use it only for that
                verification. An authorised agent may submit a request on your behalf with written
                proof of authorisation.
              </p>

              <h3 className="pt-2 font-semibold text-white">Example: a data export request</h3>
              <CodeBlock filename="export-my-data.sh — sample API call" code={EXPORT_CODE} language="bash" />

              <h3 className="pt-2 font-semibold text-white">Region-specific rights</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="font-semibold text-white">European Economic Area, United Kingdom and Switzerland</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-white/60">
                    You may lodge a complaint with your local supervisory authority — for example the{" "}
                    <Placeholder>[LEAD SUPERVISORY AUTHORITY]</Placeholder> or the UK Information
                    Commissioner&apos;s Office. We would appreciate the chance to address your concern
                    first.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">California (CCPA/CPRA)</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-white/60">
                    You may request the categories and specific pieces of personal information
                    collected, request deletion or correction, and limit the use of sensitive personal
                    information. We do not sell or share personal information as those terms are
                    defined by the CPRA, and have not done so in the preceding 12 months.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Other US states</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-white/60">
                    Residents of states with comprehensive privacy laws — including Colorado,
                    Connecticut, Virginia, Utah and Texas — have comparable rights, including the right
                    to appeal a refused request by replying to our decision email.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Canada, Australia and elsewhere</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-white/60">
                    Rights under PIPEDA, the Australian Privacy Principles and other applicable laws
                    are honoured through the same request process described above.
                  </dd>
                </div>
              </dl>
            </Section>

            {/* 09 */}
            <Section id="childrens-privacy" index={sectionNumber("childrens-privacy")} title="Children's Privacy">
              <p>
                The Services are built for businesses and are not directed to children. We do not
                knowingly collect personal information from anyone under{" "}
                <Placeholder>[16]</Placeholder> years of age (or under 13 where local law sets that
                threshold, such as COPPA in the United States).
              </p>
              <p>
                If we learn that we have collected personal information from a child without the
                consent required by law, we will delete it promptly. If you believe a child has
                provided us with personal information, contact{" "}
                <Placeholder>[privacy@example.com]</Placeholder> and we will investigate and remove the
                data.
              </p>
              <p>
                Business customers are responsible for ensuring that the end users whose data they add
                to their workspace meet the age requirements of their own terms and applicable law.
              </p>
            </Section>

            {/* 10 */}
            <Section id="policy-changes" index={sectionNumber("policy-changes")} title="Changes to This Privacy Policy">
              <p>
                We may update this policy as our Services, our providers or the law change. The
                &quot;Last updated&quot; date at the top of the page always reflects the most recent
                revision.
              </p>
              <p>
                For material changes — a new purpose for processing, a new category of recipient, or a
                change that reduces your rights — we will give at least{" "}
                <Placeholder>[30]</Placeholder> days&apos; notice by email to account owners and by an
                in-product banner before the change takes effect. Continuing to use the Services after
                the effective date means the updated policy applies to you.
              </p>

              <h3 className="pt-2 font-semibold text-white">Revision history</h3>
              <ul className="divide-y divide-white/10 border-y border-white/10">
                {REVISIONS.map(([date, note]) => (
                  <li key={date} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-5">
                    <time dateTime={date} className="shrink-0 font-mono text-xs text-white/45 sm:w-24 sm:pt-0.5">
                      {date}
                    </time>
                    <span className="text-sm leading-relaxed text-white/60">{note}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* 11 */}
            <Section id="contact-information" index={sectionNumber("contact-information")} title="Contact Information">
              <p>
                Questions, requests or complaints about this policy are welcome. We aim to reply within
                5 business days.
              </p>

              <div className="rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/[0.07] to-transparent p-5 sm:p-6">
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  <Users className="h-4.5 w-4.5 text-brand-600" aria-hidden="true" />
                  Get in touch
                </h3>
                <p className="mt-1.5 text-sm text-white/60">
                  Please use the privacy channels below rather than general support, so your request is
                  logged and tracked correctly.
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">Privacy enquiries</h4>
                    <address className="mt-1 text-sm not-italic leading-relaxed text-white/65">
                      <a href="mailto:privacy@example.com" className="font-medium text-brand-600 hover:underline">
                        privacy@example.com
                      </a>
                      <br />
                      <Placeholder>[+1 (555) 010-0199]</Placeholder>
                    </address>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">Data Protection Officer</h4>
                    <address className="mt-1 text-sm not-italic leading-relaxed text-white/65">
                      <Placeholder>[DPO FULL NAME]</Placeholder>
                      <br />
                      <a href="mailto:dpo@example.com" className="font-medium text-brand-600 hover:underline">
                        dpo@example.com
                      </a>
                    </address>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">Postal address</h4>
                    <address className="mt-1 space-y-1 text-sm not-italic leading-relaxed text-white/65">
                      <div><Placeholder>[COMPANY LEGAL NAME]</Placeholder></div>
                      <div><Placeholder>[STREET ADDRESS]</Placeholder></div>
                      <div><Placeholder>[CITY, POSTAL CODE, COUNTRY]</Placeholder></div>
                    </address>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">EU / UK representative</h4>
                    <address className="mt-1 space-y-1 text-sm not-italic leading-relaxed text-white/65">
                      <div><Placeholder>[ARTICLE 27 REPRESENTATIVE NAME]</Placeholder></div>
                      <div><Placeholder>[REPRESENTATIVE ADDRESS]</Placeholder></div>
                    </address>
                  </div>
                </div>
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
