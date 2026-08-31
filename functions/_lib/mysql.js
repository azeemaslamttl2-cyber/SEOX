import mysql from 'mysql2/promise';
import process from 'node:process';

let pool = null;
let connectionEnv = process.env;

// Vite loads .env files for its configuration but does not copy those values
// into process.env.  API middleware supplies that loaded environment per
// request, so retain it for the MySQL helpers used by the API handler.
export function configureMysqlConnection(env) {
  connectionEnv = env || process.env;
}

export function getPool(env = connectionEnv) {
  if (!pool) {
    pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT),
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
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
