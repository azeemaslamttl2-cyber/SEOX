import { Component } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

/**
 * Catches anything a routed page throws while rendering, so a failure ends in a
 * readable error with a way out instead of a spinner that never stops.
 *
 * The case that matters most is a rejected `React.lazy` import - a chunk that
 * 404s after a deploy, or a dropped connection. Without a boundary the nearest
 * Suspense stays suspended forever and the user sits on "Loading..." with no
 * indication that anything went wrong.
 *
 * `resetKey` clears a caught error when it changes (the router pathname), so
 * navigating away from a broken page recovers without a reload. It is compared
 * in `getDerivedStateFromProps` rather than used as a React `key`, because
 * keying the boundary would remount every page on each navigation and change
 * how existing screens keep their state.
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error, info) {
    // Never log request bodies or credentials - only where it broke.
    console.error("Page failed to render:", error?.message || error, info?.componentStack);
  }

  handleRetry() {
    this.setState({ error: null });
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A lazy import caches its rejection, so re-rendering the same chunk throws
    // again; a reload is the reliable recovery and is offered first.
    const isChunkError = /dynamically imported module|Importing a module script|chunk/i.test(
      String(error?.message || "")
    );

    return (
      <div className="page-error" role="alert">
        <div className="page-error-card">
          <div className="page-error-icon">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="page-error-title">This page could not be loaded</h2>
          <p className="page-error-message">
            {isChunkError
              ? "Part of the application failed to download. This usually clears after a reload."
              : error?.message || "Something went wrong while rendering this page."}
          </p>
          <div className="page-error-actions">
            <button type="button" onClick={this.handleReload} className="page-error-primary">
              <RefreshCw className="h-4 w-4" />
              Reload page
            </button>
            {!isChunkError && (
              <button type="button" onClick={this.handleRetry} className="page-error-secondary">
                <RotateCcw className="h-4 w-4" />
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
