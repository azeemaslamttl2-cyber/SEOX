// AES-GCM encryption for Google Business Profile OAuth tokens.
//
// A GBP refresh token grants long-lived write access to a client's live
// business listing, so it is never stored in plaintext. Generate the key once
// with `openssl rand -base64 32` and set it as GBP_TOKEN_ENCRYPTION_KEY.
//
// The implementation moved to secret-crypto.js when the Jira integration
// needed the same primitive under its own key. Nothing about the algorithm,
// the stored payload format ("v1.<iv>.<ciphertext>") or the error behaviour
// changed, so tokens encrypted before that move still decrypt.

import {
  decryptWithKey,
  encryptWithKey,
  secretKeyConfigured,
} from './secret-crypto.js';

const KEY_NAME = 'GBP_TOKEN_ENCRYPTION_KEY';
const LABEL = 'GBP token';

export function encryptionKeyConfigured(env) {
  return secretKeyConfigured(env, KEY_NAME);
}

export async function encryptSecret(env, plaintext) {
  return encryptWithKey(env, KEY_NAME, plaintext, LABEL);
}

export async function decryptSecret(env, payload) {
  return decryptWithKey(env, KEY_NAME, payload, LABEL);
}
