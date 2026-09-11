import { AlertTriangle, RotateCcw } from "lucide-react";
import PageLoader from "./PageLoader.jsx";
import { usePageLoading } from "../hooks/usePageLoading.js";

/**
 * Wraps a page whose content cannot be drawn until some data has arrived.
 *
 *   <PageStatus loading={loading} hasData={projects.length > 0} error={error} onRetry={refresh}>
 *     ...the page...
 *   </PageStatus>
 *
 * This is for the case in point 9 of the brief where the *page itself* is not
 * meaningful yet. A page made of independent sections should keep its own
 * per-section loading states instead of blocking everything behind this.
 *
 * `hasData` is what keeps a cached page instant: when the projects context
 * already holds the list, the children render straight away and the refresh
 * happening behind them is never shown as a loader.
 */
export default function PageStatus({
  loading,
  hasData,
  error,
  onRetry,
  label,
  delay,
  children,
  errorTitle = "This page could not be loaded",
}) {
  const { showLoader, showError } = usePageLoading({ loading, hasData, error, delay });

  if (showLoader) return <PageLoader label={label} delay={0} />;

  if (showError) {
    return (
      <div className="page-error" role="alert">
        <div className="page-error-card">
          <div className="page-error-icon">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="page-error-title">{errorTitle}</h2>
          <p className="page-error-message">
            {typeof error === "string" ? error : error?.message || "Something went wrong."}
          </p>
          {onRetry && (
            <div className="page-error-actions">
              <button type="button" onClick={onRetry} className="page-error-primary">
                <RotateCcw className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return children;
}
