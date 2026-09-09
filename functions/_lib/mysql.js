import mysql from 'mysql2/promise';
import process from 'node:process';

let pool = null;
let connectionEnv = process.env;
let connectionKey = null;

function getConnectionKey(env = process.env) {
  return [
    env.MYSQL_HOST || "",
    env.MYSQL_PORT || "3306",
    env.MYSQL_USER || "",
    env.MYSQL_PASSWORD || "",
    env.MYSQL_DATABASE || "",
  ].join("\u001f");
}

// Vite loads .env files for its configuration but does not copy those values
// into process.env.  API middleware supplies that loaded environment per
// request, so retain it for the MySQL helpers used by the API handler.
export function configureMysqlConnection(env) {
  if (!env) return;
  const nextKey = getConnectionKey(env);
  if (connectionKey === null) connectionKey = getConnectionKey(connectionEnv);
  if (nextKey === connectionKey) {
    connectionEnv = env;
    return;
  }

  const previousPool = pool;
  connectionEnv = env;
  connectionKey = nextKey;
  pool = null;
  if (previousPool) previousPool.end().catch(() => {});
}

export function getPool(env = connectionEnv) {
  if (!pool) {
    connectionEnv = env;
    connectionKey = getConnectionKey(env);
    pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT),
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      charset: 'utf8mb4_general_ci',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function insert(sql, params = []) {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function update(sql, params = []) {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function deleteQuery(sql, params = []) {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return result;
}
