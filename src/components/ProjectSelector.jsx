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

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }

    // Projects are already loaded via CrawlContext + useEagerProjects.
    // Open the dropdown immediately without re-fetching.
    // If needed, user can manually refresh by right-clicking or using a button.
    setOpen(true);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-lg border border-[#e8d1d0] bg-white px-4 py-2 text-sm font-medium text-[#2d2b6f] shadow-sm transition hover:border-[#d9b8b4] hover:bg-[#fff9f9]"
      >
        <Globe className="h-4 w-4 text-[#ea5b4a]" />
        <span className="max-w-[180px] truncate">{displayName}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#554f8a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[#f0dedb] bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#6a668c]">
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
                     ? "bg-[#fceae7] text-[#2d2b6f]"
                     : "text-[#3b3a5d] hover:bg-[#f7f4f5] hover:text-[#2d2b6f]"
                 }`}
               >
                 <Globe
                   className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-[#ea5b4a]" : "text-[#8a86ae]"}`}
                 />
                 <span className="truncate">{p.name || p.domain || p.url || "Untitled"}</span>
                 {isSelected && <Check className="ml-auto h-4 w-4 text-[#ea5b4a]" />}
               </button>
             );
            })}
            {projects.length === 0 && <p className="px-3 py-4 text-sm text-[#6a668c]">No projects found.</p>}
          </div>
          <div className="mt-1 border-t border-[#f3e5e4] pt-1">
            <Link
             to="/auditor/new?mode=checks"
             onClick={() => setOpen(false)}
             className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#48507b] transition hover:bg-[#f9f5f5] hover:text-[#2d2b6f]"
            >
             <Plus className="h-4 w-4 text-[#ea5b4a]" />
             Add New Project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
