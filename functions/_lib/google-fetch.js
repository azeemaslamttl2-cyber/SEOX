// Outbound HTTP to Google, with the three guards a bare fetch() does not have:
// a connect timeout, a bounded retry, and an error that names its own cause.
//
// Why this exists
// ---------------
// The Business Profile connection failed in production with nothing but
// "fetch failed" on screen. That string is Node's own message for a network
// error, and the journal showed the real cause:
//
//   [TypeError: fetch failed] { [cause]: AggregateError [ETIMEDOUT]:
//       at internalConnectMultiple (node:net:1339:18) ...
//       code: 'ETIMEDOUT', [errors]: [ [Error], [Error] ] }
//
// Two connect attempts, both timed out. `oauth2.googleapis.com` is the one host
// in the OAuth legs that resolves to exactly one A and one AAAA record, and the
// application host has no global IPv6 address - only a link-local fe80::/10 on
// ens160 - so the AAAA attempt can never complete. Node still tries it, because
// the default DNS result order is `verbatim` and Happy Eyeballs walks the list.
//
// That alone is survivable - Happy Eyeballs is supposed to move on to the next
// address. What makes it fatal is the budget it allows each one:
//
//   node -p "require('net').getDefaultAutoSelectFamilyAttemptTimeout()"  ->  250
//   ping oauth2.googleapis.com  ->  rtt min/avg/max = 323.7/323.8/324.2 ms
//
// A TCP handshake costs one round trip, so from this host the IPv4 connect to
// that endpoint *cannot* finish inside 250 ms. Node cancels it, falls to the
// AAAA address, gets ENETUNREACH, and reports both failures as ETIMEDOUT - the
// two-element [errors] array above. Which frontend DNS returns decides whether
// a call works: `mybusinessaccountmanagement` answers in 48 ms and has always
// been fine, while `oauth2.googleapis.com` has been measured at 147 ms and at
// 324 ms on the same day. That is the whole intermittency.
//
// So, three things: give each connect attempt a realistic budget, prefer the
// address family that provably works, and treat a network failure as retryable
// rather than fatal. The authorization code Google issues is single use, so
// losing this one call costs the user the entire consent round trip.
//
// What is deliberately NOT retried: an HTTP error. A 401, 403 or 429 is
// Google's considered answer and repeating it only burns quota - the Business
// Profile APIs ship with a per-minute quota of zero until Google approves the
// access request, and every extra call is spent against it.

import process from 'node:process';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;

// Connect-level failures. The request never reached Google, so replaying it
// cannot double-apply anything.
const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
]);

/**
 * Does this host have a usable IPv6 route?
 *
 * A link-local fe80::/10 address is not one: it cannot reach the public
 * internet, and an AAAA connect over it fails with ENETUNREACH. Only a global
 * address counts.
 */
function hasGlobalIPv6(interfaces) {
  for (const addresses of Object.values(interfaces || {})) {
    for (const address of addresses || []) {
      if (address.internal) continue;
      // Node reports family as 'IPv6' (string) or 6 (number) depending on version.
      if (address.family !== 'IPv6' && address.family !== 6) continue;
      const value = String(address.address || '').toLowerCase();
      if (value.startsWith('fe80:') || value.startsWith('::1')) continue;
      return true;
    }
  }
  return false;
}

/**
 * Give outbound connects a realistic budget, and prefer the address family that
 * works on this host.
 *
 * Both halves are no-ops where they should be: a host that already allows a
 * long enough connect attempt keeps its setting, and a dual-stack host keeps
 * verbatim DNS order, where preferring IPv4 would be a regression. Runs once,
 * and only under Node - a Workers runtime has neither module and needs neither.
 */
let tuningPromise = null;
export function tuneOutboundNetworking() {
  if (!tuningPromise) tuningPromise = applyTuning();
  return tuningPromise;
}

// One RTT is all a handshake needs, but 250 ms of it is not enough from every
// host to every Google frontend. Four seconds is still far below the request
// timeout and leaves ample room for a slow but working path; a genuinely dead
// address still fails fast on ENETUNREACH/ECONNREFUSED rather than waiting.
const MIN_CONNECT_ATTEMPT_MS = 4000;

async function applyConnectAttemptTimeout() {
  try {
    const net = await import('node:net');
    if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout !== 'function') return;

    const current = net.getDefaultAutoSelectFamilyAttemptTimeout?.() ?? 0;
    if (current >= MIN_CONNECT_ATTEMPT_MS) return;

    net.setDefaultAutoSelectFamilyAttemptTimeout(MIN_CONNECT_ATTEMPT_MS);
    console.warn(
      `Raised the TCP connect attempt budget from ${current}ms to ${MIN_CONNECT_ATTEMPT_MS}ms: ` +
        'the default is shorter than the round trip to some Google endpoints, which surfaces as ' +
        '"fetch failed" (ETIMEDOUT) on an otherwise healthy connection.'
    );
  } catch {
    // Not Node. The retry below still covers us.
  }
}

async function applyTuning() {
  await applyConnectAttemptTimeout();

  // An explicit operator choice always wins over the probe below.
  const override = String(process.env?.GOOGLE_DNS_RESULT_ORDER || '').trim();

  try {
    const [dns, os] = await Promise.all([import('node:dns'), import('node:os')]);
    if (typeof dns.setDefaultResultOrder !== 'function') return false;

    if (override === 'verbatim' || override === 'ipv4first') {
      dns.setDefaultResultOrder(override);
      return true;
    }
    if (hasGlobalIPv6(os.networkInterfaces())) return false;

    dns.setDefaultResultOrder('ipv4first');
    console.warn(
      'No global IPv6 address on this host; preferring IPv4 for outbound Google calls. ' +
        'Set GOOGLE_DNS_RESULT_ORDER=verbatim to override.'
    );
    return true;
  } catch {
    // Not Node, or the runtime forbids it. The retry below still covers us.
    return false;
  }
}

function networkError(message, cause) {
  const error = new Error(message);
  error.status = 502;
  error.code = 'NETWORK';
  if (cause) error.cause = cause;
  return error;
}

/** The most specific code Node buried in the cause chain. */
export function causeCode(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current.code) return String(current.code);
    if (Array.isArray(current.errors) && current.errors.length) {
      const nested = current.errors.find((entry) => entry?.code);
      if (nested?.code) return String(nested.code);
    }
    current = current.cause;
  }
  return '';
}

function isRetryable(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return true;
  const code = causeCode(error);
  return code ? RETRYABLE_CODES.has(code) : false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch() against a Google endpoint.
 *
 * Resolves with the Response for any HTTP status - a 4xx is an answer, and the
 * caller reads its body. Rejects only when the call never got one, and then
 * with a message that names the host and the underlying code instead of the
 * opaque "fetch failed".
 *
 * @param {string} url
 * @param {RequestInit} init
 * @param {{ timeoutMs?: number, retries?: number, label?: string }} options
 */
export async function googleFetch(url, init = {}, options = {}) {
  await tuneOutboundNetworking();

  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, label } = options;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return 'Google';
    }
  })();
  const what = label || host;

  let lastError;
  let attempts = 0;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    attempts += 1;
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === retries) break;

      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `${what}: ${causeCode(error) || error?.message || 'network error'} on attempt ${
          attempt + 1
        }/${retries + 1}; retrying in ${delay}ms.`
      );
      await sleep(delay);
    }
  }

  const code = causeCode(lastError) || lastError?.name || 'network error';
  console.error(
    `${what}: giving up after ${attempts} attempt${attempts === 1 ? '' : 's'}.`,
    lastError
  );
  throw networkError(
    `Could not reach ${host} (${code}). The server's outbound connection to Google failed, ` +
      `so this is not a problem with the Google account or its permissions.`,
    lastError
  );
}
