import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import {
  endRouteTransition,
  getRouteTransitionState,
  subscribeRouteTransition,
} from "../lib/routeTransition.js";

/**
 * The centred loader shown while a navigation is in flight.
 *
 * Fixed and full-screen because the destination layout may not be mounted yet -
 * moving between sections swaps the whole shell, so there is no content area to
 * sit inside. It uses the same spinner and label markup as `PageLoader`, so the
 * two look identical.
 *
 * `page-loader-full` supplies the surface colour; the fixed positioning and
 * stacking are inline, so this needs no new CSS and cannot be affected by the
 * light-theme compatibility layer that rewrites border utility classes.
 *
 * During the initial load (`boot`) this renders nothing: the identical loader
 * from index.html is already on screen and stays there, unbroken, until
 * routeTransition.js removes it. Rendering both would stack two spinners and
 * cost a swap between two DOM nodes that look the same.
 */
export function RouteTransitionOverlay() {
  const { visible, boot } = useSyncExternalStore(
    subscribeRouteTransition,
    getRouteTransitionState,
    getRouteTransitionState
  );

  if (!visible || boot) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="page-loader page-loader-full"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        minHeight: "100vh",
      }}
    >
      <div className="page-loader-inner">
        <div className="page-loader-spinner animate-spin" />
        <p className="page-loader-label">Loading...</p>
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  );
}

/**
 * Clears the pending flag when the destination route actually commits.
 *
 * It sits *inside* the router's Suspense boundary and wraps everything the
 * router renders. While a lazy chunk is still downloading React holds the
 * commit of this whole subtree, so this effect cannot run early - which is the
 * point: the loader hides when the page is ready, not when the URL changed.
 */
export function RouteReadySignal({ children }) {
  const { pathname, search } = useLocation();

  useEffect(() => {
    endRouteTransition(pathname + search);
  }, [pathname, search]);

  return children;
}
