import bcrypt from 'bcryptjs';
import { createPool } from 'mysql2/promise';

async function buildPasswordHash(password) {
  return await bcrypt.hash(password, 12);
}

const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD === '' ? undefined : process.env.MYSQL_PASSWORD || undefined,
  database: process.env.MYSQL_DATABASE || 'code-step-mysql',
};

const email = 'demo@seox.io';
const password = 'Password123!';
const displayName = 'Demo User';

const pool = createPool(config);

try {
  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  await pool.query(`USE \`${config.database}\``);
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  const passwordHash = await buildPasswordHash(password);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, provider, created_at, updated_at)
     VALUES (?, ?, ?, 'email', ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       display_name = VALUES(display_name),
       updated_at = VALUES(updated_at)`,
    [email, passwordHash, displayName, now, now]
  );

  console.log(`Seeded login user: ${email} / ${password}`);
} catch (error) {
  console.error('Failed to seed login user:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
