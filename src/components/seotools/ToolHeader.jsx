import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/* `gradient` is still accepted so the ten call sites need no change, but the
   banner now uses the same shell as every other tool page instead of a
   per-tool coloured slab. */
export default function ToolHeader({ title, subtitle, Icon }) {
  return (
    <>
      <Link to="/seo-tools" className="ui-button ctool-tool-btn stool-back">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Tools
      </Link>

      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <span className="ctool-hero-icon">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">{title}</h1>
            {subtitle && <p className="ctool-subtitle">{subtitle}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
