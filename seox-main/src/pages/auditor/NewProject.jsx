import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  CircleDashed,
} from "lucide-react";
import Logo from "../../components/Logo.jsx";
import { useCrawl } from "../../context/CrawlContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationsContext.jsx";
import {
  createEmptyProjectToolChecks,
  PROJECT_TOOL_DEFS,
  runProjectToolChecks,
} from "../../lib/projectToolChecks.js";

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

const CHECK_MODE_TOOL_KEYS = [
  "speed",
  "eeat",
  "semantic",
  "robots",
  "crawlOptimization",
  "duplicate",
  "gsc",
  "bing",
];

function cleanScopeInput(value = "", { stripTrailingSlash = false } = {}) {
  let cleaned = value.trim().replace(/^(?:https?:)?\/\//i, "");
  if (stripTrailingSlash) {
    cleaned = cleaned.replace(/\/+$/, "");
  }
  return cleaned;
}

function crawlProtocolPrefix(protocol) {
  return protocol === "http" ? "http://" : "https://";
}

function buildCrawlUrl(domain, protocol) {
  const cleaned = cleanScopeInput(domain, { stripTrailingSlash: true });
  return cleaned ? `${crawlProtocolPrefix(protocol)}${cleaned}` : "";
}

export default function NewProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checksMode = searchParams.get("mode") === "checks";
  const { startCrawl, setProject } = useCrawl();
  const { user } = useAuth();
  const { notify } = useNotifications();
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
  const [userAgent, setUserAgent] = useState("ai-smart-seo-desktop");
  const [renderJs, setRenderJs] = useState(false);
  const [respectRobots, setRespectRobots] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  const normalizedDomain = useMemo(
    () => cleanScopeInput(domain, { stripTrailingSlash: true }),
    [domain]
  );

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

  const goNext = () => setStep((s) => Math.min(flowSteps.length, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const fullUrl = useMemo(
    () => buildCrawlUrl(normalizedDomain, protocol),
    [normalizedDomain, protocol]
  );

  const handleStartCrawl = async () => {
    setSubmitting(true);
    setSaveError("");
    const proj = {
      id: `proj_${Date.now()}`,
      name: finalName || normalizedDomain,
      domain: normalizedDomain,
      fullUrl: fullUrl || buildCrawlUrl(normalizedDomain, protocol),
      scope,
      protocol,
      folder,
      urlLimit,
      schedule,
      userAgent,
      renderJs,
      respectRobots,
      notifyEmail,
      owner: user?.email,
      createdAt: new Date().toISOString(),
    };

    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      await setProject(proj);
      notify({
        type: "success",
        title: "Project saved",
        body: `${proj.name} was added to your dashboard.`,
        href: "/dashboard",
      });
      if (checksMode) {
        navigate("/dashboard");
      } else {
        startCrawl(proj, { skipOnline: true });
        navigate("/auditor/log");
      }
    } catch (error) {
      setSaveError(error?.message || "Could not save this project online. Please try again.");
      notify({
        type: "error",
        title: "Project was not saved online",
        body: error?.message || "Could not save this project online.",
      });
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
              AI Smart <span className="text-brand-400">Seo</span>
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
            userId={user?.uid || user?.id || ""}
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
        Set up your website to start analyzing it with AI Smart Seo.
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
  userId = "",
}) {
  const [toolChecks, setToolChecks] = useState(null);

  const previewProject = useMemo(
    () => ({
      id: `checks_${fullUrl}`,
      name: projectName || fullUrl,
      domain: fullUrl,
      fullUrl,
    }),
    [fullUrl, projectName]
  );

  useEffect(() => {
    if (!checksMode || !fullUrl) {
      setToolChecks(null);
      return undefined;
    }

    let cancelled = false;
    const initial = createEmptyProjectToolChecks(previewProject);
    initial.status = "running";
    initial.startedAt = new Date().toISOString();
    setToolChecks(initial);

    runProjectToolChecks(previewProject, {
      userId,
      persist: false,
      onUpdate: (next) => {
        if (!cancelled) setToolChecks(next);
      },
    }).catch((error) => {
      if (cancelled) return;
      setToolChecks((current) => ({
        ...(current || initial),
        status: "error",
        updatedAt: new Date().toISOString(),
        error: error?.message || "Could not run project checks.",
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [checksMode, fullUrl, previewProject, userId]);

  const liveToolDefs = useMemo(
    () => PROJECT_TOOL_DEFS.filter((tool) => CHECK_MODE_TOOL_KEYS.includes(tool.key)),
    []
  );

  return (
    <div className="text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">
        Ready to <span className="gradient-text">{checksMode ? "check" : "crawl"}</span>?
      </h1>
      <p className="mt-3 text-base text-white/55">
        {checksMode ? "AI Smart Seo will run available tools for " : "Fine-tune how AI Smart Seo crawls "}
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
          <Tile
            title="Dashboard checks"
            subtitle={
              toolChecks?.status === "running"
                ? "Running live tool checks without starting the Site Audit crawler"
                : "Live tool checks for this project"
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {liveToolDefs.map((def) => (
                <ToolCheckStatus
                  key={def.key}
                  tool={toolChecks?.tools?.[def.key] || { ...def, status: "queued" }}
                />
              ))}
            </div>
            {toolChecks?.error && (
              <p className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {toolChecks.error}
              </p>
            )}
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
            <Tile title="Schedule" subtitle="How often AI Smart Seo should re-crawl your site">
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
            <Tile title="User agent" subtitle="Which crawler AI Smart Seo should identify as">
              <Select
                value={userAgent}
                onChange={setUserAgent}
                options={[
                  { value: "ai-smart-seo-desktop", label: "AI Smart Seo desktop crawler" },
                  { value: "ai-smart-seo-mobile", label: "AI Smart Seo mobile crawler" },
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

function statusMeta(status) {
  if (status === "complete") {
    return {
      Icon: Check,
      className: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200",
      iconClass: "text-emerald-300",
      label: "Done",
    };
  }
  if (status === "running") {
    return {
      Icon: Loader2,
      className: "border-sky-500/20 bg-sky-500/[0.06] text-sky-100",
      iconClass: "animate-spin text-sky-300",
      label: "Running",
    };
  }
  if (status === "skipped") {
    return {
      Icon: CircleDashed,
      className: "border-amber-500/20 bg-amber-500/[0.06] text-amber-100",
      iconClass: "text-amber-300",
      label: "Setup",
    };
  }
  if (status === "error") {
    return {
      Icon: AlertTriangle,
      className: "border-rose-500/20 bg-rose-500/[0.06] text-rose-100",
      iconClass: "text-rose-300",
      label: "Error",
    };
  }
  return {
    Icon: CircleDashed,
    className: "border-white/10 bg-white/[0.03] text-white/60",
    iconClass: "text-white/35",
    label: "Queued",
  };
}

function ToolCheckStatus({ tool }) {
  const status = tool.status || "queued";
  const { Icon, className, iconClass, label } = statusMeta(status);
  const score = Number.isFinite(tool.score) ? `${tool.score}%` : label;

  return (
    <div className={`flex min-h-[58px] items-center gap-3 rounded-lg border px-3 py-2 text-xs ${className}`}>
      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-white/85">{tool.label}</p>
          <span className="flex-shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase text-white/55">
            {score}
          </span>
        </div>
        <p className="mt-0.5 truncate text-white/45">
          {tool.summary || tool.detail || "Waiting to run"}
        </p>
      </div>
    </div>
  );
}
