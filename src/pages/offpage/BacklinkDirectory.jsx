import { useState, useCallback } from "react";
import {
  Search,
  Download,
  Upload,
  ArrowLeft,
  ExternalLink,
  Copy,
  ChevronDown,
  Monitor,
  User,
  Building2,
  Wrench,
  Star,
  MessageCircle,
  GraduationCap,
  Landmark,
  MessagesSquare,
  Bookmark,
  PenTool,
  FolderOpen,
  Tag,
  Briefcase,
  Megaphone,
  Link,
  MapPin,
  Globe,
  FileUp,
  Rocket,
  BarChart3,
  Newspaper,
  Users,
  Ticket,
  Coins,
  Globe2,
} from "lucide-react";
import { allBacklinkCategories, totalOpportunities, totalCategories } from "../../data/backlinksData/index.js";

const iconMap = {
  monitor: Monitor,
  user: User,
  building: Building2,
  wrench: Wrench,
  star: Star,
  messageCircle: MessageCircle,
  graduationCap: GraduationCap,
  landmark: Landmark,
  messagesSquare: MessagesSquare,
  bookmark: Bookmark,
  penTool: PenTool,
  folder: FolderOpen,
  tag: Tag,
  briefcase: Briefcase,
  megaphone: Megaphone,
  link: Link,
  mapPin: MapPin,
  globe: Globe,
  globe2: Globe2,
  fileUp: FileUp,
  rocket: Rocket,
  barChart: BarChart3,
  newspaper: Newspaper,
  users: Users,
  ticket: Ticket,
  coins: Coins,
};

function Favicon({ domain, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-white/40"
        style={{ width: size, height: size }}
      >
        {domain.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`}
      alt={domain}
      width={size}
      height={size}
      className="flex-shrink-0 rounded-lg"
      onError={onError}
      loading="lazy"
    />
  );
}

export default function BacklinkDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [selectedCat, setSelectedCat] = useState(null);
  const totalDone = allBacklinkCategories.reduce((sum, c) => sum + c.done, 0);

  const filteredCategories = allBacklinkCategories.filter(
    (c) =>
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (typeFilter === "All Types" || c.category === typeFilter)
  );

  // If a category is selected, show its detail view
  if (selectedCat !== null) {
    const cat = allBacklinkCategories[selectedCat];
    const Icon = iconMap[cat.icon] || FolderOpen;
    return (
      <div className="mx-auto max-w-6xl">
        {/* Category Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent)]" />
          <div className="relative z-10 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedCat(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-black text-white">{cat.category}</h2>
                  <p className="text-xs text-white/60">{cat.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  {cat.totalLinks} total links
                </span>
                <button className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25">
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2">
          <Search className="h-4 w-4 text-white/30" />
          <input
            className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/25 focus:outline-none"
            placeholder="Search backlinks..."
          />
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="grid grid-cols-[2fr_0.6fr_0.8fr_0.8fr_0.6fr_0.8fr_0.6fr] gap-2 border-b border-white/[0.06] px-5 py-3">
            <TH label="Website Name" />
            <TH label="TLD" />
            <TH label="Link Type" />
            <TH label="Traffic" />
            <TH label="DR" />
            <TH label="Status" />
            <TH label="Actions" />
          </div>

          {cat.links.map((link, i) => (
            <div
              key={i}
              className={`grid grid-cols-[2fr_0.6fr_0.8fr_0.8fr_0.6fr_0.8fr_0.6fr] gap-2 px-5 py-3 transition hover:bg-white/[0.02] ${
                i < cat.links.length - 1 ? "border-b border-white/[0.03]" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Favicon domain={link.domain} size={32} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/85 truncate">{link.name}</div>
                  <div className="text-[10px] text-white/30">{link.domain}</div>
                </div>
              </div>
              <div className="flex items-center text-xs text-white/50">{link.tld}</div>
              <div className="flex items-center">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  link.linkType === "Dofollow"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : link.linkType === "Nofollow"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/10 text-white/40"
                }`}>
                  {link.linkType}
                </span>
              </div>
              <div className="flex items-center text-xs text-white/50">{link.traffic}</div>
              <div className="flex items-center">
                <span className={`font-bold text-sm ${
                  link.dr >= 90 ? "text-emerald-400" : link.dr >= 70 ? "text-blue-400" : link.dr >= 50 ? "text-amber-400" : "text-rose-400"
                }`}>{link.dr}</span>
              </div>
              <div className="flex items-center">
                {link.status === "Done" ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">✓ Done</span>
                ) : (
                  <button className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-semibold text-white/40 hover:bg-white/[0.06]">
                    Mark Done
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:bg-white/[0.06] hover:text-white/50">
                  <Copy className="h-3 w-3" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:bg-white/[0.06] hover:text-white/50">
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Category grid view
  return (
    <div className="mx-auto max-w-6xl">
      {/* ─── Hero Header ─── */}
      <div className="dashboard-welcome backlink-directory-welcome relative overflow-hidden rounded-2xl border border-brand-600 bg-brand-500 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float-slow rounded-full bg-college-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 animate-float rounded-full bg-college-yellow/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Backlink Directory</h1>
              <p className="mt-1 text-sm text-white">{totalOpportunities.toLocaleString()} opportunities across {totalCategories} categories</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white">
                Progress {totalDone}/{totalOpportunities.toLocaleString()} ({Math.round((totalDone / totalOpportunities) * 100)}%)
              </span>
              <button className="ui-button ui-button-secondary">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>
          <button className="ui-button ui-button-secondary mt-5">
            <Upload className="h-3.5 w-3.5" /> Import Backlink Report
          </button>
        </div>
      </div>

      {/* ─── Search + Filter ─── */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
          <Search className="h-4 w-4 text-white/30" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/25 focus:outline-none"
            placeholder="Search backlinks..."
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent text-xs text-white/70 focus:outline-none"
          >
            <option value="All Types">All Types</option>
            {allBacklinkCategories.map((c) => (
              <option key={c.category} value={c.category}>{c.category}</option>
            ))}
          </select>
          <ChevronDown className="h-3 w-3 text-white/30" />
        </div>
      </div>

      {/* ─── Category Grid ─── */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filteredCategories.map((cat, i) => {
          const Icon = iconMap[cat.icon] || FolderOpen;
          const globalIdx = allBacklinkCategories.indexOf(cat);
          return (
            <button
              key={cat.category}
              onClick={() => setSelectedCat(globalIdx)}
              className="backlink-category-card group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition hover:bg-white/[0.04] hover:border-white/[0.1]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 transition group-hover:bg-indigo-500/20">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-white/85">{cat.category}</h3>
              <p className="mt-0.5 text-[11px] text-white/35">{cat.desc}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  {cat.totalLinks} links
                </span>
                {cat.done > 0 && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {cat.done} done
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TH({ label }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</span>
  );
}
