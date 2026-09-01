import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Globe, ChevronDown, Check, Plus } from "lucide-react";
import { useCrawl } from "../context/CrawlContext.jsx";

/**
 * Reusable website/project selector dropdown.
 * Reads from CrawlContext to show the list of audited websites.
 */
export default function ProjectSelector() {
  const { project, projects, selectProject } = useCrawl();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const displayName = project?.name || project?.domain || "Select website";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/[0.06]"
      >
        <Globe className="h-4 w-4 text-brand-400" />
        <span className="max-w-[180px] truncate">{displayName}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
            Your Websites
          </div>
          <div className="max-h-56 overflow-y-auto no-scrollbar">
            {projects.map((p) => {
              const isSelected = p.id === project?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    selectProject(p.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    isSelected
                      ? "bg-brand-500/10 text-brand-200"
                      : "text-white/80 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Globe
                    className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-brand-400" : "text-white/30"}`}
                  />
                  <span className="truncate">
                    {p.name || p.domain || p.url || "Untitled"}
                  </span>
                  {isSelected && <Check className="ml-auto h-4 w-4 text-brand-400" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-white/10 pt-1">
            <Link
              to="/auditor/new?mode=checks"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Plus className="h-4 w-4 text-brand-400" />
              Add New Project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
