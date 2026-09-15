import { useEffect, useState } from "react";

/**
 * The one page-level loading indicator for the application.
 *
 * It is centred in whatever region it is placed in - inside a layout's
 * `<main>` that means the content area, clear of the icon rail and sidebar.
 *
 * Rendering is held back for `delay` ms so a fast route or a warm cache never
 * flashes a spinner. As a Suspense fallback this works naturally: the component
 * mounts the moment the boundary suspends, renders nothing while the delay
 * runs, and only paints if the wait turns out to be noticeable.
 *
 * The spinner's colours live in `.page-loader-spinner` in index.css rather than
 * in utility classes: the light-theme compatibility layer rewrites every
 * `border-white*` class with `border-color: ... !important`, which repaints all
 * four sides and would flatten a `border-t-*` accent into a plain grey ring
 * with no visible rotation.
 */
export default function PageLoader({
  label = "Loading...",
  delay = 200,
  fullScreen = false,
  className = "",
}) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return undefined;
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Always mounted, so screen readers hear the status when it does appear.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`page-loader ${fullScreen ? "page-loader-full" : ""} ${className}`.trim()}
    >
      {visible && (
        <div className="page-loader-inner">
          <div className="page-loader-spinner animate-spin" />
          <p className="page-loader-label">{label}</p>
        </div>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
