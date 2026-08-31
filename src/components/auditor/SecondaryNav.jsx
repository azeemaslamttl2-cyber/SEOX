import { NavLink } from "react-router-dom";

const nav = [
  {
    section: "Audit",
    items: [
      { label: "Overview", to: "/auditor", end: true },
      { label: "All issues", to: "/auditor/issues", badge: "7" },
      { label: "Bulk export", to: "/auditor/export" },
      { label: "Project history", to: "/auditor/history" },
      { label: "Crawl log", to: "/auditor/log" },
    ],
  },
  {
    section: "Tools",
    items: [
      { label: "Page explorer", to: "/auditor/pages" },
      { label: "Link explorer", to: "/auditor/links" },
      { label: "Internal link opportunities", to: "/auditor/internal-links" },
      { label: "Structure explorer", to: "/auditor/structure" },
    ],
  },
  {
    section: "Reports",
    items: [
      { label: "Internal pages", to: "/auditor/reports/internal" },
      { label: "Indexability", to: "/auditor/reports/indexability" },
      { label: "Links", to: "/auditor/reports/links" },
      { label: "Redirects", to: "/auditor/reports/redirects" },
      { label: "Content", to: "/auditor/reports/content" },
      { label: "Social tags", to: "/auditor/reports/social" },
      { label: "Duplicates", to: "/auditor/reports/duplicates" },
      { label: "Localization", to: "/auditor/reports/localization" },
      { label: "Performance", to: "/auditor/reports/performance" },
      { label: "Images", to: "/auditor/reports/images" },
      { label: "JavaScript", to: "/auditor/reports/javascript" },
      { label: "CSS", to: "/auditor/reports/css" },
      { label: "External pages", to: "/auditor/reports/external" },
      { label: "Sitemaps", to: "/auditor/reports/sitemaps" },
      { label: "Other", to: "/auditor/reports/other" },
    ],
  },
];

function Badge({ kind, children }) {
  if (kind === "new") {
    return (
      <span className="ml-auto rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-900">
        {children}
      </span>
    );
  }
  return (
    <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
      {children}
    </span>
  );
}

export default function SecondaryNav() {
  return (
    <aside className="app-sidebar no-scrollbar sticky top-0 hidden h-screen w-[232px] flex-shrink-0 overflow-y-auto border-r border-white/10 bg-ink-900/60 px-3 py-5 md:block">
      <nav className="space-y-5">
        {nav.map((section) => (
          <div key={section.section}>
            <h4 className="flex items-center gap-1.5 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
              {section.icon && <section.icon className="h-3.5 w-3.5 text-brand-400" />}
              {section.section}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                        item.indent ? "ml-3" : ""
                      } ${
                        isActive
                          ? "bg-gradient-to-r from-brand-500/15 to-transparent text-brand-200"
                          : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="h-1 w-1 rounded-full bg-brand-400" />
                        )}
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <Badge kind={item.badgeKind}>{item.badge}</Badge>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
