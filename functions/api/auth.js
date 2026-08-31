import bcrypt from 'bcryptjs';
import process from 'node:process';
import { createPool } from 'mysql2/promise';
import { SignJWT, jwtVerify } from 'jose';
import { issueAccessToken } from '../_lib/auth-token.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function buildPasswordHash(password) {
  return await bcrypt.hash(password, 12);
}

async function verifyPasswordHash(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  return await bcrypt.compare(password, storedHash);
}

function getConnectionConfig(env = process.env) {
  const host = env.MYSQL_HOST || '127.0.0.1';
  const port = Number(env.MYSQL_PORT || 3306);
  const user = env.MYSQL_USER || 'root';
  const password = env.MYSQL_PASSWORD === '' ? undefined : env.MYSQL_PASSWORD || undefined;
  const database = env.MYSQL_DATABASE || 'code-step-mysql';

  try {
    const hasPassword = typeof env.MYSQL_PASSWORD === 'string' && env.MYSQL_PASSWORD.length > 0;
    console.debug('DB connection config', { host, user, database, hasPassword });
  } catch (e) {
    // ignore logging errors
  }

  return { host, port, user, password, database, waitForConnections: true, connectionLimit: 10, queueLimit: 0 };
}

async function withPool(env, callback) {
  const config = getConnectionConfig(env);
  if (!config) {
    return callback(null);
  }

  const pool = createPool(config);
  try {
    return await callback(pool);
  } finally {
    await pool.end();
  }
}

async function ensureUsersTable(pool, env = process.env) {
  if (!pool) return;
  const targetDatabase = env.MYSQL_DATABASE || 'code-step-mysql';
  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${targetDatabase}\``);
  await pool.query(`USE \`${targetDatabase}\``);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) DEFAULT NULL,
      display_name VARCHAR(255) DEFAULT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'email',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      role VARCHAR(50) DEFAULT NULL,
      plan VARCHAR(50) NOT NULL DEFAULT 'free',
      deleted_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function serializeUser(row, env) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.displayName || null,
    provider: row.provider || 'email',
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    uid: String(row.id),
    accessToken: await issueAccessToken(row, env),
  };
}

function googleConfig(env = process.env) {
  return {
    clientId: String(env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: String(env.GOOGLE_CLIENT_SECRET || '').trim(),
  };
}

function authSecret(env = process.env) {
  const value = String(env.AUTH_JWT_SECRET || '');
  if (value.length < 32) throw new Error('AUTH_JWT_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(value);
}

function safeReturnTo(value) {
  const target = String(value || '').trim();
  return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';
}

async function createGoogleState(returnTo, env) {
  return new SignJWT({ returnTo: safeReturnTo(returnTo) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(authSecret(env));
}

async function readGoogleState(state, env) {
  const { payload } = await jwtVerify(String(state || ''), authSecret(env));
  return safeReturnTo(payload.returnTo);
}

function loginErrorRedirect(request, message, env) {
  const target = new URL('/login', appOrigin(request, env));
  target.searchParams.set('google_error', message);
  return Response.redirect(target, 302);
}

function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function appOrigin(request, env = process.env) {
  const configured = String(env.APP_URL || '').trim();
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

function googleCallbackUrl(request, env) {
  const override = String(env.GOOGLE_AUTH_REDIRECT_URI || env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  if (override) {
    try {
      const url = new URL(override);
      if (!isLoopbackHostname(url.hostname)) return url.toString();
    } catch {
      // Fall back to the public application origin when the override is invalid.
    }
  }
  return new URL('/api/auth/google/callback', appOrigin(request, env)).toString();
}

async function findOrCreateGoogleUser(pool, profile, env) {
  await ensureUsersTable(pool, env);
  const email = normalizeEmail(profile?.email);
  const displayName = String(profile?.name || profile?.given_name || '').trim() || null;
  if (!email || profile?.email_verified === false) {
    const error = new Error('Google did not return a verified email address.');
    error.status = 400;
    throw error;
  }

  const [existingRows] = await pool.query(
    'SELECT id, email, display_name, provider, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  let user = existingRows[0];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (user) {
    await pool.query(
      'UPDATE users SET display_name = COALESCE(display_name, ?), provider = CASE WHEN provider = \'email\' THEN \'google\' ELSE provider END, updated_at = ? WHERE id = ?',
      [displayName, now, user.id]
    );
  } else {
    const [inserted] = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, provider, created_at, updated_at) VALUES (?, NULL, ?, \'google\', ?, ?)',
      [email, displayName, now, now]
    );
    const [rows] = await pool.query(
      'SELECT id, email, display_name, provider, created_at, updated_at FROM users WHERE id = ?',
      [inserted.insertId]
    );
    user = rows[0];
  }

  const [rows] = await pool.query(
    'SELECT id, email, display_name, provider, created_at, updated_at FROM users WHERE id = ?',
    [user.id]
  );
  return serializeUser(rows[0], env);
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const { clientId, clientSecret } = googleConfig(env);

    if (url.pathname.endsWith('/google')) {
      if (!clientId || !clientSecret) {
        return loginErrorRedirect(request, 'Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', env);
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: googleCallbackUrl(request, env),
        response_type: 'code',
        scope: 'openid email profile',
        state: await createGoogleState(url.searchParams.get('returnTo'), env),
        prompt: 'select_account',
      });
      return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
    }

    if (url.pathname.endsWith('/google/callback')) {
      if (!clientId || !clientSecret) {
        return loginErrorRedirect(request, 'Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', env);
      }
      if (url.searchParams.get('error')) {
        return loginErrorRedirect(request, url.searchParams.get('error_description') || 'Google sign-in was cancelled.', env);
      }

      const returnTo = await readGoogleState(url.searchParams.get('state'), env);
      const code = String(url.searchParams.get('code') || '').trim();
      if (!code) return loginErrorRedirect(request, 'Google did not return an authorization code.', env);

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: googleCallbackUrl(request, env),
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokens.access_token) {
        return loginErrorRedirect(request, tokens.error_description || 'Google could not complete sign-in.', env);
      }

      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok) return loginErrorRedirect(request, 'Google profile information could not be loaded.', env);

      const user = await withPool(env, (pool) => findOrCreateGoogleUser(pool, profile, env));
      const payload = Buffer.from(JSON.stringify({ user, returnTo })).toString('base64url');
      const target = new URL('/login', appOrigin(request, env));
      target.hash = new URLSearchParams({ google_auth: payload }).toString();
      return Response.redirect(target, 302);
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unsupported auth route.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return loginErrorRedirect(request, error?.message || 'Google sign-in failed.', env);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const path = new URL(request.url).pathname;

    if (path.endsWith('/register')) {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const displayName = String(body.displayName || '').trim();

      if (!email || !password) {
        return Response.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
      }

      return withPool(env, async (pool) => {
        if (pool) {
          await ensureUsersTable(pool, env);
          const [existingRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
          if (existingRows.length > 0) {
            return Response.json({ ok: false, error: 'User already exists.' }, { status: 409 });
          }

          const passwordHash = await buildPasswordHash(password);
          try {
            const masked = password ? `len:${password.length}` : 'empty';
            console.debug('Registering user', { email, password: masked, passwordHash: (passwordHash || '').slice(0, 12) + '...' });
          } catch (e) {
            // ignore logging errors
          }
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const [result] = await pool.query(
            'INSERT INTO users (email, password_hash, display_name, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [email, passwordHash, displayName || null, 'email', now, now]
          );
          const [rows] = await pool.query('SELECT id, email, display_name, provider, created_at, updated_at FROM users WHERE id = ?', [result.insertId]);
          const user = rows[0];
          return Response.json({ ok: true, user: await serializeUser(user, env) });
        }

        const fallbackUser = {
          id: `local-${Date.now()}`,
          email,
          displayName,
          provider: 'email',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return Response.json({ ok: true, user: await serializeUser(fallbackUser, env) });
      });
    }

    if (path.endsWith('/login')) {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');

      if (!email || !password) {
        return Response.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
      }

      return withPool(env, async (pool) => {
        if (pool) {
          await ensureUsersTable(pool, env);
          const [rows] = await pool.query('SELECT id, email, display_name, password_hash, provider, created_at, updated_at FROM users WHERE email = ? LIMIT 1', [email]);
          const user = rows[0];
          try {
            const masked = password ? `len:${password.length}` : 'empty';
            console.debug('Login attempt', { email, password: masked, userFound: !!user });
          } catch (e) {
            // ignore
          }

          const storedHashPresent = !!(user && user.password_hash);
          try {
            console.debug('Stored hash present:', storedHashPresent);
            if (storedHashPresent) console.debug('Stored hash (truncated):', (user.password_hash || '').slice(0, 12) + '...');
          } catch (e) {
            // ignore
          }

          const isValid = await verifyPasswordHash(password, user?.password_hash);
          try {
            console.debug('Password verification result', { email, isValid });
          } catch (e) {
            // ignore
          }

          if (!user || !isValid) {
            return Response.json({ ok: false, error: 'Invalid credentials.' }, { status: 401 });
          }

          return Response.json({ ok: true, user: await serializeUser(user, env) });
        }

        return Response.json({ ok: false, error: 'Invalid credentials.' }, { status: 401 });
      });
    }

    if (path.endsWith('/logout')) {
      return Response.json({ ok: true });
    }

    if (path.endsWith('/password-reset')) {
      return Response.json({ ok: true, message: 'Password reset is not configured for the local MySQL auth bridge yet.' });
    }

    return Response.json({ ok: false, error: 'Unsupported auth route.' }, { status: 404 });
  } catch (error) {
    console.error('Auth handler exception:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Internal auth handler error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
