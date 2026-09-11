import { Navigate, useLocation } from "react-router-dom";

/**
 * Keeps the old per-category settings URLs working after they were folded into
 * `/settings/general`.
 *
 *   /settings/stripe?stripe=return -> /settings/general?tab=stripe&stripe=return
 *   /settings/deepseek             -> /settings/general?tab=deepseek
 *
 * The incoming query string is carried over, so the Stripe onboarding return
 * link still reaches the panel that reads it.
 */
export default function LegacySettingsRedirect({ tab }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  return <Navigate to={`/settings/general?${params.toString()}`} replace />;
}
