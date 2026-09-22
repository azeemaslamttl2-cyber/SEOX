// The `state` parameter carried through the Business Profile consent.
//
// It used to be bare base64 JSON: readable, and writable by anyone. Because the
// exchange trusted the projectId the browser sent back, a crafted callback URL
// could attach an attacker's freshly authorised Google account to a project id
// of their choosing in the victim's session - the CSRF that `state` exists to
// prevent.
//
// It is now a short-lived HS256 JWT signed with AUTH_JWT_SECRET, the same
// secret and the same pattern the Google sign-in flow already uses. The payload
// stays readable by the browser (a JWT body is just base64url JSON, and the
// callback page needs the projectId to show the right project), but only the
// server can mint or alter one.

import process from 'node:process';
import { SignJWT, jwtVerify } from 'jose';

const STATE_TTL = '15m';

function secret(env = process.env) {
  const value = String(env?.AUTH_JWT_SECRET || '');
  if (value.length < 32) throw new Error('AUTH_JWT_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(value);
}

/** Only ever a path inside this app, so the state cannot become an open redirect. */
export function safeReturnTo(value) {
  const candidate = String(value || '').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/local-seo/gbp';
  return candidate;
}

/**
 * @param {{ projectId: string, returnTo?: string, userId?: string|number }} payload
 */
export async function signGbpState(payload, env = process.env) {
  return new SignJWT({
    projectId: String(payload?.projectId || ''),
    returnTo: safeReturnTo(payload?.returnTo),
    // Binds the consent to the SEOX user who started it, so a state minted in
    // one session cannot be replayed in another.
    uid: payload?.userId === undefined ? null : String(payload.userId),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secret(env));
}

/**
 * Verifies the signature and returns the payload.
 *
 * Throws a 400 on anything unverifiable - a forged state, an expired one, or a
 * state minted for a different signed-in user.
 */
export async function verifyGbpState(token, env = process.env, { userId } = {}) {
  let payload;
  try {
    ({ payload } = await jwtVerify(String(token || ''), secret(env)));
  } catch (cause) {
    // A missing secret is an operator problem, not a bad request.
    if (String(cause?.message || '').includes('AUTH_JWT_SECRET')) throw cause;
    const error = new Error(
      'The Business Profile sign-in could not be verified. Start the connection again from the ' +
        'Business Profile page.'
    );
    error.status = 400;
    error.code = 'INVALID_OAUTH_STATE';
    throw error;
  }

  if (payload.uid && userId !== undefined && String(payload.uid) !== String(userId)) {
    const error = new Error('This Business Profile sign-in belongs to a different SEOX session.');
    error.status = 400;
    error.code = 'INVALID_OAUTH_STATE';
    throw error;
  }

  return { projectId: payload.projectId || '', returnTo: safeReturnTo(payload.returnTo) };
}
