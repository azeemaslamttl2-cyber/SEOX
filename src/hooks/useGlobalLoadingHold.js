import { useEffect, useId } from "react";
import { holdGlobalLoader } from "../lib/routeTransition.js";

/**
 * Keeps the global loader up while a page's *required* data is in flight.
 *
 * Without this the loader lifts the moment the route commits, which is only
 * "React mounted" - the page is on screen but still empty. With it, a reload of
 * a data-gated page shows one continuous centred loader from the browser's
 * first frame until the page can actually be read.
 *
 *   const { storageReady } = useProjectSelection();
 *   const [loading, setLoading] = useState(true);
 *   useGlobalLoadingHold(!storageReady || loading);
 *
 * Only for data the page cannot render without. A background refresh, a
 * prefetch, or anything the page has a sensible empty state for must not be
 * passed here - the loader is meant to lift as soon as the page is usable, not
 * when it is complete.
 *
 * The hold is released by the effect cleanup, so it lifts on failure exactly as
 * it does on success as long as `active` is driven by a flag cleared in a
 * `finally`. It also lifts if the page unmounts mid-flight, and
 * `holdGlobalLoader` caps it independently, so a request that never settles
 * cannot leave a permanent spinner.
 *
 * A hold taken when no load is pending is a no-op, so this is safe to call
 * during a client-side visit to the page as well as on a cold load.
 *
 * @param {boolean} active true while required data is still loading
 */
export function useGlobalLoadingHold(active) {
  // Per component instance, so two pages holding at once cannot collide and a
  // remount cannot leak the previous instance's hold.
  const key = useId();

  useEffect(() => {
    if (!active) return undefined;
    return holdGlobalLoader(key);
  }, [active, key]);
}

export default useGlobalLoadingHold;
