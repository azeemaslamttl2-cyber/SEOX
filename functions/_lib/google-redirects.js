import process from 'node:process';
import { getAdminSetting } from './app-settings.js';

/**
 * Google OAuth redirect URIs.
 *
 * The application runs three independent Google OAuth flows and each one
 * returns to a *different* route:
 *
 *   sign-in           -> /api/auth/google/callback   google_auth_redirect_uri
 *   Search Console    -> /gsc/oauth-callback         google_gsc_redirect_uri
 *   Business Profile  -> /gbp/oauth-callback         google_gbp_redirect_uri
 *
 * Because the routes differ, one flow can never stand in for another: sending a
 * Business Profile consent back to the sign-in callback lands the user on a page
 * that knows nothing about the pending GBP connection. The GBP settings
 * therefore fall back to *its own* route on the application origin, never to
 * another flow's configured URI.
 *
 * That cross-flow fallback is what produced "redirect URI mismatch" in
 * production: with `google_gbp_redirect_uri` unset, the browser fell back to
 * `<origin>/gbp/oauth-callback` while the server fell back to the sign-in
 * URI, so the two sides disagreed about a value they must agree on exactly.
 */

export const GOOGLE_CALLBACK_PATHS = {
  auth: '/api/auth/google/callback',
  gsc: '/gsc/oauth-callback',
  gbp: '/gbp/oauth-callback',
};

const SETTING_BY_FLOW = {
  auth: 'google_auth_redirect_uri',
  gsc: 'google_gsc_redirect_uri',
  gbp: 'google_gbp_redirect_uri',
};

export function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Public origin of the application. A loopback request URL means a local
 * process behind the production host, so the public host is used instead -
 * Google rejects a loopback redirect for a web client.
 */
export function appOrigin(request, env = process.env) {
  const configured = String(env?.APP_URL || '').trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (!isLoopbackHostname(url.hostname)) return url.origin;
    } catch {
      // Fall back to the request origin when APP_URL is invalid.
    }
  }

  const requestUrl = new URL(request.url);
  return isLoopbackHostname(requestUrl.hostname) ? 'https://aismart.thetowertech.com' : requestUrl.origin;
}

/**
 * Is this override actually a callback for `flow`?
 *
 * Each flow is handled by exactly one route, so an override pointing anywhere
 * else cannot work - a GBP consent sent to /api/auth/google/callback reaches
 * the sign-in handler and the connection is silently never completed. The
 * comparison allows a base path (a deployment under a sub-path still ends with
 * the route) while rejecting another flow's route outright.
 */
export function overrideMatchesFlow(url, flow) {
  const path = GOOGLE_CALLBACK_PATHS[flow];
  if (!path) return false;
  if (url.pathname === path || url.pathname.endsWith(path)) return true;
  // Never accept a URI that belongs to one of the other flows.
  return false;
}

/**
 * The redirect URI for one Google flow: the configured value when it is a
 * usable non-loopback URL for *this* flow, otherwise that flow's own route on
 * the application origin.
 */
export async function googleRedirectUri(flow, request, env = process.env) {
  const path = GOOGLE_CALLBACK_PATHS[flow];
  if (!path) throw new Error(`Unknown Google OAuth flow: ${flow}`);

  const override = String(await getAdminSetting(SETTING_BY_FLOW[flow], env)).trim();
  if (override) {
    try {
      const url = new URL(override);
      if (!isLoopbackHostname(url.hostname) && overrideMatchesFlow(url, flow)) {
        return url.toString();
      }
      // Log the setting name only - never the stored value, which can carry a
      // host an operator would rather not see in logs.
      console.warn(
        `Ignoring ${SETTING_BY_FLOW[flow]}: it does not point at ${path}. Using the derived URI instead.`
      );
    } catch {
      // Fall back to the derived URI when the stored override is not a URL.
    }
  }

  return new URL(path, appOrigin(request, env)).toString();
}
