import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PageLoader from "./PageLoader.jsx";
import RouteErrorBoundary from "./RouteErrorBoundary.jsx";

/**
 * Drop-in replacement for `<Outlet />` inside a layout's content region.
 *
 * Every layout renders this instead of the bare outlet, which gives the whole
 * application one loading and one error boundary per content area:
 *
 *   <main class="app-main">        <- icon rail, sidebar and top bar stay put
 *     RouteErrorBoundary           <- a thrown error becomes a retry card
 *       Suspense -> PageLoader     <- a lazy page becomes a centred spinner
 *         Outlet                   <- the page itself
 *
 * The boundaries deliberately sit here rather than around `<Routes>`. A single
 * outer boundary unmounts the entire shell while a chunk downloads, so the
 * navigation the user just clicked disappears and the fallback lands at the top
 * of a blank window instead of centred in the content area.
 *
 * `outletKey` is passed through for the layouts that already remount their
 * outlet per path, so their existing behaviour is unchanged.
 */
export default function RouteOutlet({ outletKey, label }) {
  const { pathname } = useLocation();

  return (
    <RouteErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader label={label} />}>
        <Outlet key={outletKey} />
      </Suspense>
    </RouteErrorBoundary>
  );
}
