import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  X,
  Check,
  ChevronDown,
  Globe,
  Folder,
  ChevronRight,
  Settings2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  Zap,
  Bot,
  Bell,
} from "lucide-react";
import Logo from "../../components/Logo.jsx";
import { useCrawl } from "../../context/CrawlContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const steps = [
  { num: 1, label: "Scope", Icon: Globe },
  { num: 2, label: "Site Audit", Icon: Settings2 },
];

const PROTOCOLS = [
  { value: "https-http", label: "http + https" },
  { value: "https", label: "https only" },
  { value: "http", label: "http only" },
];

const SCOPES = [
  { value: "subdomains", label: "Subdomains" },
  { value: "exact", label: "Exact URL" },
  { value: "path", label: "Path" },
];

function cleanScopeInput(value = "", { stripTrailingSlash = false } = {}) {
  let cleaned = value.trim().replace(/^(?:https?:)?\/\//i, "");
  if (stripTrailingSlash) {
    cleaned = cleaned.replace(/\/+$/, "");
  }
  return cleaned;
}

function getProjectHost(value = "") {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const host = rawValue.replace(/^(?:https?:)?\/\//i, "").split("/")[0];
    return host.replace(/^www\./i, "").toLowerCase();
  }
}

function normalizeProjectUrlValue(value = "", { stripTrailingSlash = false } = {}) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      const path = stripTrailingSlash ? url.pathname.replace(/\/+$/, "") : url.pathname;
      return `${url.hostname.replace(/^www\./i, "").toLowerCase()}${path}${url.search}${url.hash}`;
    } catch {
      // fall through to fallback
    }
  }

  normalized = normalized.replace(/^(?:https?:)?\/\//i, "");
  if (stripTrailingSlash) normalized = normalized.replace(/\/+$/, "");
  return normalized.replace(/^www\./i, "").toLowerCase();
}

function crawlProtocolPrefix(protocol) {
  return protocol === "http" ? "http://" : "https://";
}

function buildCrawlUrl(domain, protocol) {
  const cleaned = cleanScopeInput(domain, { stripTrailingSlash: true });
  return cleaned ? `${crawlProtocolPrefix(protocol)}${cleaned}` : "";
}

export default function NewProject() {
  ///console.warn("Hello world-------------");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checksMode = searchParams.get("mode") === "checks";
  const { projects, startCrawl, setProject } = useCrawl();
  const { user } = useAuth();
  const flowSteps = useMemo(
    () => checksMode ? [
      { num: 1, label: "Scope", Icon: Globe },
      { num: 2, label: "Checks", Icon: Zap },
    ] : steps,
    [checksMode]
  );

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Scope form state
  const [protocol, setProtocol] = useState("https-http");
  const [domain, setDomain] = useState("");
  const [scope, setScope] = useState("subdomains");
  const [projectName, setProjectName] = useState("");
  const [folder, setFolder] = useState("none");

  // Audit settings
  const [urlLimit, setUrlLimit] = useState(10000);
  const [schedule, setSchedule] = useState("weekly");
  const [userAgent, setUserAgent] = useState("seox-desktop");
  const [renderJs, setRenderJs] = useState(false);
  const [respectRobots, setRespectRobots] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  const normalizedDomain = useMemo(
    () => normalizeProjectUrlValue(domain, { stripTrailingSlash: true }),
    [domain]
  );

  const currentHost = useMemo(() => getProjectHost(domain), [domain]);

  // Auto-fill name from domain
  const finalName = useMemo(() => {
    if (projectName.trim()) return projectName.trim();
    try {
      return normalizedDomain.split(".")[0] ? normalizedDomain : "";
    } catch {
      return "";
    }
  }, [projectName, normalizedDomain]);

  const canContinueStep1 = normalizedDomain.length > 3 && /\./.test(normalizedDomain);

  const duplicateProject = useMemo(
    () => {
      const currentNormalized = normalizeProjectUrlValue(normalizedDomain, { stripTrailingSlash: true });
      return projects.some((project) => {
        const existingValue = project.domain || project.full_url || project.fullUrl || project.url || "";
        const existingHost = getProjectHost(existingValue);
        const existingNormalized = normalizeProjectUrlValue(existingValue, {
          stripTrailingSlash: true,
        });

        return (
          (currentHost && existingHost && existingHost === currentHost) ||
          existingNormalized === currentNormalized
        );
      });
    },
    [projects, normalizedDomain, currentHost]
  );

  const goNext = () => {
    if (duplicateProject) {
      setSaveError(`A project for ${normalizedDomain} already exists.`);
      return;
    }
    setSaveError("");
    setStep((s) => Math.min(flowSteps.length, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const fullUrl = useMemo(
    () => buildCrawlUrl(normalizedDomain, protocol),
    [normalizedDomain, protocol]
  );

  const handleStartCrawl = async () => {
    if (duplicateProject) {
      setSaveError(`A project for ${normalizedDomain} already exists.`);
      setStep(1);
      return;
    }

    setSubmitting(true);
    setSaveError("");

    const projectId = `proj_${Date.now()}`;
    const safeOwnerName = user?.displayName || user?.name || user?.email || null;
    const createdAt = new Date().toISOString();

    const proj = {
      id: projectId,
      project_id: projectId,
      name: finalName || normalizedDomain,
      project_name: finalName || normalizedDomain,
      domain: normalizedDomain,
      fullUrl: fullUrl || buildCrawlUrl(normalizedDomain, protocol),
      full_url: fullUrl || buildCrawlUrl(normalizedDomain, protocol),
      scope,
      protocol,
      folder,
      urlLimit,
      url_limit: urlLimit,
      schedule,
      userAgent,
      user_agent: userAgent,
      renderJs,
      render_js: renderJs,
      respectRobots,
      respect_robots: respectRobots,
      notifyEmail,
      notify_email: notifyEmail,
      owner: safeOwnerName,
      owner_email: user?.email || null,
      owner_uid: user?.uid || null,
      total_urls: 0,
      compare_to: null,
      crawled_on: null,
      project_data: {
        protocol,
        scope,
        folder,
        schedule,
        userAgent,
        urlLimit,
        renderJs,
        respectRobots,
        notifyEmail,
        createdAt,
        owner: safeOwnerName,
        ownerEmail: user?.email || null,
        ownerUid: user?.uid || null,
      },
      createdAt,
      created_at: createdAt,
      updatedAt: createdAt,
      updated_at: createdAt,
    };

    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      await setProject(proj);
      if (checksMode) {
        navigate("/dashboard");
      } else {
        startCrawl(proj, { skipOnline: true });
        navigate("/auditor/log");
      }
    } catch (error) {
      setSaveError(error?.message || "Could not save this project online. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900 text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[700px] w-[1200px] -translate-x-1/2 rounded-full bg-brand-500/[0.08] blur-[160px]" />
        <div className="absolute -bottom-40 right-0 h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-[160px]" />
      </div>

      {/* Top bar with steps + cancel */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-900/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link to={checksMode ? "/dashboard" : "/auditor"} className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight">
              SEO<span className="text-brand-400">X</span>
            </span>
          </Link>

          <ol className="hidden items-center gap-1 md:flex">
            {flowSteps.map((s, i) => {
              const active = step === s.num;
              const done = step > s.num;
              return (
                <li key={s.num} className="flex items-center gap-1">
                  <button
                    onClick={() => done && setStep(s.num)}
                    disabled={!done}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/40"
                        : done
                        ? "text-emerald-300 hover:bg-white/[0.04]"
                        : "text-white/40"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        active
                          ? "bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow"
                          : done
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-white/5 text-white/40"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : s.num}
                    </span>
                    {s.label}
                  </button>
                  {i < flowSteps.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                  )}
                </li>
              );
            })}
          </ol>

          <Link
            to={checksMode ? "/dashboard" : "/auditor"}
            className="flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white"
          >
            <X className="h-4 w-4" />
            Cancel
          </Link>
        </div>

        {/* Mobile step pill */}
        <div className="border-t border-white/10 px-4 py-2 text-center text-xs text-white/60 md:hidden">
          Step <span className="font-bold text-brand-300">{step}</span> of {flowSteps.length} · {flowSteps[step - 1].label}
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:pt-16">
        {step === 1 && (
          <ScopeStep
            protocol={protocol}
            setProtocol={setProtocol}
            domain={domain}
            setDomain={setDomain}
            scope={scope}
            setScope={setScope}
            projectName={projectName}
            setProjectName={setProjectName}
            folder={folder}
            setFolder={setFolder}
            canContinue={canContinueStep1}
            error={saveError}
            onContinue={goNext}
          />
        )}

        {step === 2 && (
          <AuditStep
            urlLimit={urlLimit}
            setUrlLimit={setUrlLimit}
            schedule={schedule}
            setSchedule={setSchedule}
            userAgent={userAgent}
            setUserAgent={setUserAgent}
            renderJs={renderJs}
            setRenderJs={setRenderJs}
            respectRobots={respectRobots}
            setRespectRobots={setRespectRobots}
            notifyEmail={notifyEmail}
            setNotifyEmail={setNotifyEmail}
            projectName={finalName}
            fullUrl={fullUrl}
            onBack={goBack}
            onStart={handleStartCrawl}
            submitting={submitting}
            saveError={saveError}
            checksMode={checksMode}
          />
        )}
      </main>
    </div>
  );
}

/* ------------ STEP 1 — Scope -------------- */
function ScopeStep({
  protocol,
  setProtocol,
  domain,
  setDomain,
  scope,
  setScope,
  projectName,
  setProjectName,
  folder,
  setFolder,
  canContinue,
  error = "",
  onContinue,
}) {
  const handleDomainChange = (event) => {
    const rawValue = event.target.value;
    const inputType = event.nativeEvent?.inputType;
    const pastedFullUrl = inputType === "insertFromPaste" || /^https?:\/\//i.test(rawValue);
    setDomain(cleanScopeInput(rawValue, { stripTrailingSlash: pastedFullUrl }));
  };

  return (
    <div className="text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">
        Create a <span className="gradient-text">project</span>
      </h1>
      <p className="mt-3 text-base text-white/55">
        Set up your website to start analyzing it with PGC.
      </p>

      <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-ink-800/60 p-6 text-left backdrop-blur sm:p-8">
        {/* Scope row */}
        <Label icon={Globe}>Scope</Label>
        <div className="flex gap-2">
          <Select value={protocol} onChange={setProtocol} options={PROTOCOLS} compact />
          <input
            value={domain}
            onChange={handleDomainChange}
            onBlur={() =>
              setDomain((value) => cleanScopeInput(value, { stripTrailingSlash: true }))
            }
            inputMode="url"
            placeholder="Domain or path  ·  e.g. yourbrand.com"
            className="flex-1 rounded-xl border border-white/10 bg-ink-900/50 px-4 py-2.5 text-sm text-white placeholder:text-white/30 transition focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <Select value={scope} onChange={setScope} options={SCOPES} compact />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          We recommend using the{" "}
          <span className="font-medium text-white/70">http + https</span> protocol along
          with the non-<code className="rounded bg-white/5 px-1">www</code> version of your
          domain. You'll get the most complete backlink profile and accurate tracking data
          this way.
        </p>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        {/* Project name */}
        <Label className="mt-6">Project name</Label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="My SEO project"
          className="w-full rounded-xl border border-white/10 bg-ink-900/50 px-4 py-2.5 text-sm text-white placeholder:text-white/30 transition focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />

        {/* Folder */}
        <Label icon={Folder} className="mt-6">
          Folder
        </Label>
        <Select
          value={folder}
          onChange={setFolder}
          options={[
            { value: "none", label: "None" },
            { value: "clients", label: "Clients" },
            { value: "personal", label: "Personal projects" },
            { value: "agency", label: "Agency portfolio" },
          ]}
        />

      </div>

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-brand-glow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}

/* ------------ STEP 2 - Site Audit -------------- */
function AuditStep({
  urlLimit,
  setUrlLimit,
  schedule,
  setSchedule,
  userAgent,
  setUserAgent,
  renderJs,
  setRenderJs,
  respectRobots,
  setRespectRobots,
  notifyEmail,
  setNotifyEmail,
  projectName,
  fullUrl,
  onBack,
  onStart,
  submitting,
  saveError = "",
  checksMode = false,
}) {
  return (
    <div className="text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">
        Ready to <span className="gradient-text">{checksMode ? "check" : "crawl"}</span>?
      </h1>
      <p className="mt-3 text-base text-white/55">
        {checksMode ? "PGC will run available tools for " : "Fine-tune how PGC crawls "}
        <span className="font-semibold text-white">{fullUrl || "your site"}</span>.
      </p>

      <div className="mx-auto mt-8 max-w-3xl space-y-4 text-left">
        {/* Summary card */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Check className="h-4 w-4" /> Project ready
          </div>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <Detail label="Project name" value={projectName} />
            <Detail label="Scope" value={fullUrl} />
          </div>
        </div>

        {checksMode ? (
          <Tile title="Dashboard checks" subtitle="Runs without starting the Site Audit crawler">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "Speed Optimization",
                "E-E-A-T Audit",
                "Semantic Audit",
                "Robots.txt Analyzer",
                "Crawl Optimization",
                "Duplicate Checker",
                "GSC/Bing if connected",
                "Credential/upload tools marked as setup needed",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </Tile>
        ) : (
          <>
            {/* URL limit */}
            <Tile title="Crawl limit" subtitle="Max number of URLs we will crawl per scan">
              <div className="flex flex-wrap items-center gap-2">
                {[1000, 10000, 100000, 1000000].map((n) => (
                  <button
                    key={n}
                    onClick={() => setUrlLimit(n)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      urlLimit === n
                        ? "border-brand-500/40 bg-brand-500/15 text-brand-200"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
                <span className="text-xs text-white/40">URLs / crawl</span>
              </div>
            </Tile>

            {/* Schedule */}
            <Tile title="Schedule" subtitle="How often PGC should re-crawl your site">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: "once", l: "Once" },
                  { v: "daily", l: "Daily" },
                  { v: "weekly", l: "Weekly" },
                  { v: "monthly", l: "Monthly" },
                ].map((s) => (
                  <button
                    key={s.v}
                    onClick={() => setSchedule(s.v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      schedule === s.v
                        ? "border-brand-500/40 bg-brand-500/15 text-brand-200"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </Tile>

            {/* User agent */}
            <Tile title="User agent" subtitle="Which crawler PGC should identify as">
              <Select
                value={userAgent}
                onChange={setUserAgent}
                options={[
                  { value: "seox-desktop", label: "PGC desktop crawler" },
                  { value: "seox-mobile", label: "PGC mobile crawler" },
                  { value: "googlebot", label: "Googlebot" },
                  { value: "bingbot", label: "Bingbot" },
                ]}
              />
            </Tile>

            {/* Toggles */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Toggle
                icon={Zap}
                label="Render JavaScript"
                desc="Crawl SPAs and JS-heavy pages"
                checked={renderJs}
                onChange={setRenderJs}
              />
              <Toggle
                icon={Bot}
                label="Respect robots.txt"
                desc="Honor disallow directives"
                checked={respectRobots}
                onChange={setRespectRobots}
              />
              <Toggle
                icon={Bell}
                label="Notify by email"
                desc="When the crawl completes"
                checked={notifyEmail}
                onChange={setNotifyEmail}
              />
            </div>
          </>
        )}
      </div>

      {saveError && (
        <div className="mx-auto mt-5 max-w-3xl rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-left text-sm text-rose-100">
          <p className="font-semibold">Project was not saved online.</p>
          <p className="mt-1 text-xs text-rose-100/75">{saveError}</p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onStart}
          disabled={submitting}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-brand-glow transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {checksMode ? "Preparing checks..." : "Spinning up crawler..."}
            </>
          ) : (
            <>
              <Search className="h-4 w-4" /> {checksMode ? "Add website & run checks" : "Start crawl"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------ Reusable bits -------------- */
function Label({ icon: Icon, children, className = "" }) {
  return (
    <label className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/55 ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </label>
  );
}

function Select({ value, onChange, options, compact }) {
  return (
    <div className={`relative ${compact ? "" : "w-full"}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-xl border border-white/10 bg-ink-900/50 py-2.5 pl-3 pr-9 text-sm text-white transition focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          compact ? "" : "w-full"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function Tile({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-4 backdrop-blur">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mb-3 text-xs text-white/50">{subtitle}</p>
      {children}
    </div>
  );
}

function Toggle({ icon: Icon, label, desc, checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex w-full flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition ${
        checked
          ? "border-brand-500/40 bg-brand-500/[0.06]"
          : "border-white/10 bg-ink-800/60 hover:bg-ink-800/80"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <Icon className={`h-4 w-4 ${checked ? "text-brand-300" : "text-white/50"}`} />
        <span
          className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${
            checked ? "bg-brand-500" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </div>
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-[11px] leading-snug text-white/50">{desc}</p>
    </button>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-white/40">{label}:</span>
      <span className="font-medium text-white">{value || "—"}</span>
    </div>
  );
}
