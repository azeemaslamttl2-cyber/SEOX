import { query } from './mysql.js';
import { deleteMySqlDocument, getMySqlDocument, listMySqlCollection, patchMySqlDocument } from './mysql-repository.js';
import { requireAdmin, requireUser } from './auth-token.js';

export const verifyAccessToken = requireUser;
export const assertAdmin = requireAdmin;
export const listStoredCollection = listMySqlCollection;
export const getStoredDocument = async (env, collection, id) => getMySqlDocument(env, collection, id);
export const deleteStoredDocument = async (env, collection, id) => deleteMySqlDocument(env, collection, id);
export const upsertStoredDocument = async (env, collection, id, fields) => patchMySqlDocument(env, collection, id, fields);
export const sqlTimestamp = (value = new Date()) => value instanceof Date ? value.toISOString() : String(value);

export async function readFirstCollection(env, envName, fallbacks, limit = 500) {
  const names = [env[envName], ...fallbacks].filter(Boolean);
  for (const name of names) {
    const rows = await listStoredCollection(env, name, limit);
    if (rows.length || env[envName] === name) return rows.slice(0, limit);
  }
  return [];
}

export async function listAuthUsers() {
  return query('SELECT id AS localId, email, display_name AS displayName, created_at AS createdAt, is_admin AS admin, plan FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC');
}

export async function lookupAuthUsers(env, ids) {
  if (!ids?.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return query(`SELECT id AS localId, email, display_name AS displayName, created_at AS createdAt, is_admin AS admin, plan FROM users WHERE id IN (${placeholders})`, ids);
}
