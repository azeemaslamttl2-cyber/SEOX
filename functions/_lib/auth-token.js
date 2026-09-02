import { SignJWT, jwtVerify } from 'jose';
import { configureMysqlConnection, queryOne } from './mysql.js';

function secret(env = process.env) {
  const value = String(env.AUTH_JWT_SECRET || '');
  if (value.length < 32) throw new Error('AUTH_JWT_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(value);
}

export async function issueAccessToken(user, env = process.env) {
  return new SignJWT({ email: user.email, admin: Boolean(user.is_admin), plan: user.plan || 'free' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret(env));
}

export async function requireUser(request, env = process.env) {
  configureMysqlConnection(env);
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { const error = new Error('Unauthorized'); error.status = 401; throw error; }
  try {
    const { payload } = await jwtVerify(token, secret(env));
    let user;
    try {
      user = await queryOne('SELECT id, email, display_name, is_admin, role, plan FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1 LIMIT 1', [payload.sub]);
    } catch (cause) {
      // Older installations do not have account-status columns yet.
      if (cause?.code !== 'ER_BAD_FIELD_ERROR') throw cause;
      user = await queryOne('SELECT id, email, display_name FROM users WHERE id = ? LIMIT 1', [payload.sub]);
    }
    if (!user) { const error = new Error('Unauthorized'); error.status = 401; throw error; }
    return { uid: String(user.id), id: user.id, email: user.email, admin: Boolean(user.is_admin) || user.role === 'admin', plan: user.plan, displayName: user.display_name };
  } catch (cause) {
    if (cause.status) throw cause;
    if (String(cause?.message || '').includes('AUTH_JWT_SECRET')) throw cause;
    if (cause?.code || cause?.originalError) {
      console.error('Authentication user lookup failed:', {
        code: cause.code || cause.originalError?.code,
        message: cause.message || String(cause),
      });
      const error = new Error('Authentication service temporarily unavailable.');
      error.status = 503;
      throw error;
    }
    const error = new Error('Invalid or expired session.'); error.status = 401; throw error;
  }
}

export async function requireAdmin(request, env = process.env) {
  const user = await requireUser(request, env);
  if (!user.admin) { const error = new Error('You do not have admin access.'); error.status = 403; throw error; }
  return user;
}
