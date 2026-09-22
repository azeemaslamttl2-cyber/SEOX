// AES-GCM encryption for third-party credentials held on behalf of a user.
//
// This is the generalised form of the Business Profile token encryption that
// gbp-crypto.js has always provided: the algorithm, the payload format and the
// error behaviour are unchanged, the only difference is that the environment
// variable holding the key is now a parameter. gbp-crypto.js re-exports these
// functions bound to GBP_TOKEN_ENCRYPTION_KEY, so every existing GBP call site
// keeps working untouched.
//
// Generate a key with `openssl rand -base64 32`.

const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = 'v1';

// One cached CryptoKey per environment variable name. Importing a key is not
// free and these are read on every request that touches a connection.
const keyCache = new Map();

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

export function secretKeyConfigured(env, keyName) {
  return Boolean(String(env?.[keyName] || '').trim());
}

async function importKey(env, keyName, label) {
  const raw = String(env?.[keyName] || '').trim();
  if (!raw) {
    throw configError(
      `${keyName} is not configured. Generate one with: openssl rand -base64 32`
    );
  }

  const cached = keyCache.get(keyName);
  if (cached && cached.raw === raw) return cached.key;

  let bytes;
  try {
    bytes = base64ToBytes(raw);
  } catch {
    throw configError(`${keyName} must be base64 encoded.`);
  }
  if (bytes.length !== KEY_BYTES) {
    throw configError(
      `${keyName} must decode to ${KEY_BYTES} bytes (got ${bytes.length}).`
    );
  }

  const key = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  keyCache.set(keyName, { raw, key, label });
  return key;
}

export async function encryptWithKey(env, keyName, plaintext, label = 'secret') {
  if (!plaintext) return null;
  const key = await importKey(env, keyName, label);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(String(plaintext))
  );
  return `${VERSION}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptWithKey(env, keyName, payload, label = 'secret') {
  if (!payload) return null;
  const [version, ivPart, dataPart] = String(payload).split('.');
  if (version !== VERSION || !ivPart || !dataPart) {
    throw configError(`Stored ${label} is malformed. Reconnect the integration.`);
  }

  const key = await importKey(env, keyName, label);
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
      `Stored ${label} could not be decrypted. It was encrypted with a different ${keyName}.`
    );
  }
}
