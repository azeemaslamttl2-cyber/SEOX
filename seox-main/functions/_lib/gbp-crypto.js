// AES-GCM encryption for Google Business Profile OAuth tokens.
//
// A GBP refresh token grants long-lived write access to a client's live
// business listing, so it is never stored in plaintext. Generate the key once
// with `openssl rand -base64 32` and set it as GBP_TOKEN_ENCRYPTION_KEY.

const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';

let cachedKey = null;
let cachedRawKey = '';

function base64ToBytes(value) {
  const binary =
    typeof atob === 'function'
      ? atob(value)
      : Buffer.from(value, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

function configError(message) {
  const error = new Error(message);
  error.status = 500;
  return error;
}

export function encryptionKeyConfigured(env) {
  return Boolean(String(env?.GBP_TOKEN_ENCRYPTION_KEY || '').trim());
}

async function importKey(env) {
  const raw = String(env?.GBP_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw configError(
      'GBP_TOKEN_ENCRYPTION_KEY is not configured. Generate one with: openssl rand -base64 32'
    );
  }
  if (cachedKey && cachedRawKey === raw) return cachedKey;

  let bytes;
  try {
    bytes = base64ToBytes(raw);
  } catch {
    throw configError('GBP_TOKEN_ENCRYPTION_KEY must be base64 encoded.');
  }
  if (bytes.length !== KEY_BYTES) {
    throw configError(
      `GBP_TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${bytes.length}).`
    );
  }

  cachedKey = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  cachedRawKey = raw;
  return cachedKey;
}

export async function encryptSecret(env, plaintext) {
  if (!plaintext) return null;
  const key = await importKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(String(plaintext))
  );
  return `${VERSION}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(env, payload) {
  if (!payload) return null;
  const [version, ivPart, dataPart] = String(payload).split('.');
  if (version !== VERSION || !ivPart || !dataPart) {
    throw configError('Stored GBP token is malformed. Reconnect the Business Profile.');
  }

  const key = await importKey(env);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(ivPart) },
      key,
      base64ToBytes(dataPart)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // Wrong key, or the ciphertext was tampered with.
    throw configError(
      'Stored GBP token could not be decrypted. It was encrypted with a different GBP_TOKEN_ENCRYPTION_KEY.'
    );
  }
}
