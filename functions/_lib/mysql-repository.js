import process from 'node:process';
import { createPool } from 'mysql2/promise';

const STORAGE_TABLES = {
  adminSettings: { table: 'admin_settings', key: 'setting_key', value: 'setting_value' },
  stripeConnections: { table: 'stripe_connections', key: 'user_id' },
  'users/{uid}/gscConnection': { table: 'gsc_connections', key: 'user_id' },
  'users/{uid}/yandexConnection': { table: 'yandex_connections', key: 'user_id' },
  'users/{uid}/projects': { table: 'user_projects', key: 'user_id' },
  'users/{uid}/meta': { table: 'user_meta', key: 'user_id' },
  'users/{uid}/projects/{projectId}/toolResults': { table: 'tool_results', key: 'user_id' },
  project_data: { table: 'content_writer_profiles', key: 'user_id' },
};

function connectionConfig(env = process.env) {
  return {
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD === '' ? undefined : env.MYSQL_PASSWORD || undefined,
    database: env.MYSQL_DATABASE || 'code_step_mysql_migration',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

async function withPool(env, callback) {
  const pool = createPool(connectionConfig(env));
  try {
    return await callback(pool);
  } finally {
    try {
      await pool.end();
    } catch {
      // ignore pool close errors
    }
  }
}

function parseJsonField(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatDateForMySQL(dateValue) {
  if (!dateValue) return null;
  
  // Handle ISO strings
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0] + ' ' + date.toISOString().split('T')[1].split('.')[0];
  }
  
  // Handle timestamps (milliseconds since epoch)
  if (typeof dateValue === 'number') {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0] + ' ' + date.toISOString().split('T')[1].split('.')[0];
  }
  
  // Handle Date objects
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return null;
    return dateValue.toISOString().split('T')[0] + ' ' + dateValue.toISOString().split('T')[1].split('.')[0];
  }
  
  return null;
}

// Debug helper: log whether a password will be used (redacted)
export function debugConnectionFlag(env = process.env) {
  try {
    const hasPassword = typeof env.MYSQL_PASSWORD === 'string' && env.MYSQL_PASSWORD.length > 0;
    // Do not log the actual password
    console.debug('mysql-repository connection flag', {
      hasPassword,
      host: env.MYSQL_HOST || '127.0.0.1',
      database: env.MYSQL_DATABASE || 'code_step_mysql_migration',
    });
  } catch (e) {
    // ignore
  }
}

function isMySqlEnabled(env = process.env) {
  return Boolean(env.MYSQL_HOST || env.MYSQL_DATABASE || env.MYSQL_USER || env.MYSQL_PASSWORD);
}

function normalizeDocumentId(value) {
  return value == null ? null : String(value);
}

function parseStoragePath(collection) {
  const tokens = String(collection || '').split('/').filter(Boolean);
  if (tokens[0] !== 'users' || tokens.length < 3) return null;

  const userId = tokens[1] || null;
  if (tokens.length === 3) {
    if (tokens[2] === 'projects') {
      return { key: 'users/{uid}/projects', userId };
    }
    if (tokens[2] === 'meta') {
      return { key: 'users/{uid}/meta', userId };
    }
    if (tokens[2] === 'gscConnection') {
      return { key: 'users/{uid}/gscConnection', userId };
    }
    if (tokens[2] === 'yandexConnection') {
      return { key: 'users/{uid}/yandexConnection', userId };
    }
  }

  if (tokens.length === 5 && tokens[2] === 'projects' && tokens[4] === 'toolResults') {
    return { key: 'users/{uid}/projects/{projectId}/toolResults', userId, projectId: tokens[3] };
  }

  return null;
}

export function resolveStorageTarget(collection, documentId) {
  let parsed = parseStoragePath(collection);
  let template = parsed ? STORAGE_TABLES[parsed.key] : STORAGE_TABLES[collection] || null;

  if (!template) {
    throw new Error(`Unsupported storage collection: ${collection}`);
  }

  const target = { table: template.table };

  if (template.table === 'admin_settings') {
    target.settingKey = documentId || (parsed && parsed.settingKey) || 'apis';
    return target;
  }

  if (template.table === 'user_projects' || template.table === 'user_meta') {
    target.userId = parsed?.userId || (typeof documentId === 'object' ? documentId?.userId : null) || documentId || null;
    target.projectId = parsed?.projectId || (typeof documentId === 'string' ? documentId : null) || null;
    return target;
  }

  if (template.table === 'tool_results') {
    target.userId = parsed?.userId || (typeof documentId === 'object' ? documentId?.userId : null) || null;
    target.projectId = parsed?.projectId || (typeof documentId === 'object' ? documentId?.projectId : null) || null;
    target.toolKey = typeof documentId === 'string' ? documentId : typeof documentId === 'object' ? documentId?.toolKey : null;
    return target;
  }

  if (template.table === 'gsc_connections' || template.table === 'yandex_connections') {
    target.userId = parsed?.userId || documentId || null;
    return target;
  }

  if (template.table === 'content_writer_profiles') {
    target.userId = documentId || null;
    return target;
  }

  if (template.table === 'stripe_connections') {
    target.userId = documentId || null;
    return target;
  }

  return target;
}

export function buildRowPayload(collection, documentId, data) {
  const target = resolveStorageTarget(collection, documentId);
  const collectionKey = parseStoragePath(collection)?.key || collection;

  if (collectionKey === 'adminSettings') {
    return {
      setting_key: target.settingKey,
      setting_value: data,
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
      updated_by: data?.updatedBy || null,
    };
  }

  if (collectionKey === 'users/{uid}/projects/{projectId}/toolResults') {
    return {
      user_id: target.userId,
      project_id: target.projectId,
      tool_key: target.toolKey,
      project_url: data?.projectUrl || data?.url || null,
      result: data?.result ?? data ?? {},
      created_at: formatDateForMySQL(data?.createdAt || new Date()),
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
    };
  }

  if (collectionKey === 'users/{uid}/projects') {
    return {
      user_id: target.userId,
      project_id: data?.id || normalizeDocumentId(documentId) || null,
      project_name: data?.name || data?.project_name || null,
      domain: data?.domain || null,
      full_url: data?.fullUrl || data?.full_url || null,
      protocol: data?.protocol || 'https-http',
      scope: data?.scope || 'subdomains',
      folder: data?.folder || 'none',
      schedule: data?.schedule || 'weekly',
      user_agent: data?.userAgent || data?.user_agent || 'seox-desktop',
      url_limit: data?.urlLimit ?? data?.url_limit ?? 10000,
      total_urls: data?.totalUrls ?? data?.total_urls ?? 0,
      render_js: data?.renderJs ?? data?.render_js ?? 0,
      respect_robots: data?.respectRobots ?? data?.respect_robots ?? 1,
      notify_email: data?.notifyEmail ?? data?.notify_email ?? 1,
      owner: data?.owner || null,
      owner_email: data?.ownerEmail || data?.owner_email || null,
      owner_uid: data?.ownerUid || data?.owner_uid || null,
      project_data: data ?? {},
      selected_project_id: data?.selectedProjectId || data?.selected_project_id || null,
      deleted_project_ids: data?.deletedProjectIds || data?.deleted_project_ids || [],
      created_at: formatDateForMySQL(data?.createdAt || data?.created_at || new Date()),
      updated_at: formatDateForMySQL(data?.updatedAt || data?.updated_at || new Date()),
    };
  }

  if (collectionKey === 'users/{uid}/meta') {
    return {
      user_id: target.userId,
      selected_project_id: data?.selectedProjectId || null,
      deleted_project_ids: data?.deletedProjectIds || [],
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
    };
  }

  if (collectionKey === 'users/{uid}/gscConnection') {
    return {
      user_id: target.userId,
      access_token: data?.accessToken || null,
      refresh_token: data?.refreshToken || null,
      expires_at: data?.expiresAt ? formatDateForMySQL(Number(data.expiresAt)) : null,
      google_email: data?.googleEmail || null,
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
    };
  }

  if (collectionKey === 'users/{uid}/yandexConnection') {
    return {
      user_id: target.userId,
      access_token: data?.accessToken || null,
      refresh_token: data?.refreshToken || null,
      expires_at: data?.expiresAt ? formatDateForMySQL(Number(data.expiresAt)) : null,
      yandex_email: data?.yandexEmail || null,
      yandex_user_id: data?.yandexUserId || null,
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
    };
  }

  if (collection === 'stripeConnections') {
    return {
      user_id: target.userId,
      stripe_account_id: data?.stripeAccountId || null,
      email: data?.email || null,
      created_at: formatDateForMySQL(data?.createdAt || new Date()),
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
      last_onboarding_link_at: formatDateForMySQL(data?.lastOnboardingLinkAt),
    };
  }

  if (collection === 'project_data') {
    return {
      user_id: target.userId,
      profile_data: data ?? {},
      created_at: formatDateForMySQL(data?.createdAt || new Date()),
      updated_at: formatDateForMySQL(data?.updatedAt || new Date()),
    };
  }

  return { data };
}

export async function verifyMySqlAccessToken(request, env) {
  const token = request?.headers?.get?.('authorization') || request?.headers?.authorization || '';
  const authorization = String(token || '').trim();
  if (!authorization) {
    const error = new Error('Missing auth token');
    error.status = 401;
    throw error;
  }

  if (!isMySqlEnabled(env)) {
    return { uid: 'local-dev-user', email: 'dev@example.com', admin: true };
  }

  const [scheme, value] = authorization.split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !value) {
    const error = new Error('Invalid auth token');
    error.status = 401;
    throw error;
  }

  return { uid: value, email: `${value}@local`, admin: true };
}

function serializeRow(row, collection) {
  if (!row) return null;
  const collectionKey = parseStoragePath(collection)?.key || collection;
  if (collection === 'adminSettings') {
    return {
      dataforseoLogin: row.setting_value?.dataforseoLogin || '',
      dataforseoPassword: row.setting_value?.dataforseoPassword || '',
      dataforseoUpdatedAt: row.setting_value?.dataforseoUpdatedAt || '',
      dataforseoUpdatedBy: row.setting_value?.updated_by || '',
      id: row.id,
    };
  }
  if (collectionKey === 'users/{uid}/projects') {
    return { ...row.project_data, id: row.project_id, updatedAt: row.updated_at };
  }
  if (collectionKey === 'users/{uid}/meta') {
    return { selectedProjectId: row.selected_project_id, deletedProjectIds: row.deleted_project_ids, updatedAt: row.updated_at };
  }
  if (collectionKey === 'users/{uid}/projects/{projectId}/toolResults') {
    return { ...row.result, projectUrl: row.project_url, updatedAt: row.updated_at };
  }
  if (collectionKey === 'users/{uid}/gscConnection') {
    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      googleEmail: row.google_email,
      updatedAt: row.updated_at,
    };
  }
  if (collectionKey === 'users/{uid}/yandexConnection') {
    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      yandexEmail: row.yandex_email,
      yandexUserId: row.yandex_user_id,
      updatedAt: row.updated_at,
    };
  }
  if (collection === 'stripeConnections') {
    return {
      stripeAccountId: row.stripe_account_id,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastOnboardingLinkAt: row.last_onboarding_link_at,
    };
  }
  if (collection === 'project_data') {
    return { ...row.profile_data, updatedAt: row.updated_at };
  }
  return row;
}

export async function listMySqlCollection(env, collection, pageSize = 500) {
  if (!isMySqlEnabled(env)) {
    return [];
  }

  const target = resolveStorageTarget(collection, '');
  const collectionKey = parseStoragePath(collection)?.key || collection;
  return withPool(env, async (pool) => {
    let query;
    let params;

    if (collectionKey === 'users/{uid}/projects') {
      query = 'SELECT * FROM `user_projects` WHERE `user_id` = ? ORDER BY `updated_at` DESC LIMIT ?';
      params = [target.userId, pageSize];
    } else if (collectionKey === 'users/{uid}/meta') {
      query = 'SELECT * FROM `user_meta` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'users/{uid}/projects/{projectId}/toolResults') {
      query = 'SELECT * FROM `tool_results` WHERE `user_id` = ? ORDER BY `updated_at` DESC LIMIT ?';
      params = [target.userId, pageSize];
    } else if (collectionKey === 'users/{uid}/gscConnection') {
      query = 'SELECT * FROM `gsc_connections` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'users/{uid}/yandexConnection') {
      query = 'SELECT * FROM `yandex_connections` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'stripeConnections') {
      query = 'SELECT * FROM `stripe_connections` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'project_data') {
      query = 'SELECT * FROM `content_writer_profiles` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'adminSettings') {
      query = 'SELECT * FROM `admin_settings` LIMIT ?';
      params = [pageSize];
    } else {
      query = `SELECT * FROM \`${target.table}\` LIMIT ?`;
      params = [pageSize];
    }

    try {
      const [rows] = await pool.query(query, params);
      return Array.isArray(rows) ? rows.map((row) => serializeRow(row, collection)) : [];
    } catch (queryError) {
      const errorMsg = queryError?.message || queryError?.sqlMessage || String(queryError);
      const err = new Error(`MySQL list query failed: ${errorMsg}`);
      err.originalError = queryError;
      throw err;
    }
  });
}

export async function getMySqlDocument(env, collection, documentId) {
  if (!isMySqlEnabled(env)) {
    return null;
  }

  const target = resolveStorageTarget(collection, documentId);
  const collectionKey = parseStoragePath(collection)?.key || collection;
  return withPool(env, async (pool) => {
    let query;
    let params;

    if (collectionKey === 'users/{uid}/projects') {
      query = 'SELECT * FROM `user_projects` WHERE `user_id` = ? AND `project_id` = ? LIMIT 1';
      params = [target.userId, target.projectId || normalizeDocumentId(documentId)];
    } else if (collectionKey === 'users/{uid}/meta') {
      query = 'SELECT * FROM `user_meta` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'users/{uid}/projects/{projectId}/toolResults') {
      query = 'SELECT * FROM `tool_results` WHERE `user_id` = ? AND `project_id` = ? AND `tool_key` = ? LIMIT 1';
      params = [target.userId, target.projectId || documentId?.projectId, target.toolKey || documentId?.toolKey];
    } else if (collectionKey === 'users/{uid}/gscConnection') {
      query = 'SELECT * FROM `gsc_connections` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'users/{uid}/yandexConnection') {
      query = 'SELECT * FROM `yandex_connections` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'stripeConnections') {
      query = 'SELECT * FROM `stripe_connections` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'project_data') {
      query = 'SELECT * FROM `content_writer_profiles` WHERE `user_id` = ? LIMIT 1';
      params = [target.userId];
    } else if (collectionKey === 'adminSettings') {
      query = 'SELECT * FROM `admin_settings` WHERE `setting_key` = ? LIMIT 1';
      params = [target.settingKey];
    } else {
      query = `SELECT * FROM \`${target.table}\` LIMIT 1`;
      params = [];
    }

    try {
      const [rows] = await pool.query(query, params);
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      return serializeRow(row, collection);
    } catch (queryError) {
      const errorMsg = queryError?.message || queryError?.sqlMessage || String(queryError);
      const err = new Error(`MySQL get query failed: ${errorMsg}`);
      err.originalError = queryError;
      throw err;
    }
  });
}

export async function patchMySqlDocument(env, collection, documentId, fields) {
  if (!isMySqlEnabled(env)) {
    return { success: true, storage: 'mysql-fallback' };
  }

  const collectionKey = parseStoragePath(collection)?.key || collection;
  const payload = buildRowPayload(collection, documentId, fields);
  return withPool(env, async (pool) => {
    let query;
    let params;

    if (collectionKey === 'users/{uid}/projects') {
      query = `INSERT INTO \`user_projects\` (
        \`user_id\`, \`project_id\`, \`project_name\`, \`domain\`, \`full_url\`, \`protocol\`, \`scope\`, \`folder\`,
        \`schedule\`, \`user_agent\`, \`url_limit\`, \`render_js\`, \`respect_robots\`, \`notify_email\`, \`owner\`,
        \`owner_email\`, \`owner_uid\`, \`project_data\`, \`selected_project_id\`, \`deleted_project_ids\`,
        \`created_at\`, \`updated_at\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
        \`project_name\`=VALUES(\`project_name\`),
        \`domain\`=VALUES(\`domain\`),
        \`full_url\`=VALUES(\`full_url\`),
        \`protocol\`=VALUES(\`protocol\`),
        \`scope\`=VALUES(\`scope\`),
        \`folder\`=VALUES(\`folder\`),
        \`schedule\`=VALUES(\`schedule\`),
        \`user_agent\`=VALUES(\`user_agent\`),
        \`url_limit\`=VALUES(\`url_limit\`),
        \`render_js\`=VALUES(\`render_js\`),
        \`respect_robots\`=VALUES(\`respect_robots\`),
        \`notify_email\`=VALUES(\`notify_email\`),
        \`owner\`=VALUES(\`owner\`),
        \`owner_email\`=VALUES(\`owner_email\`),
        \`owner_uid\`=VALUES(\`owner_uid\`),
        \`project_data\`=VALUES(\`project_data\`),
        \`selected_project_id\`=VALUES(\`selected_project_id\`),
        \`deleted_project_ids\`=VALUES(\`deleted_project_ids\`),
        \`updated_at\`=VALUES(\`updated_at\`);
      `;
      params = [
        payload.user_id,
        payload.project_id,
        payload.project_name,
        payload.domain,
        payload.full_url,
        payload.protocol,
        payload.scope,
        payload.folder,
        payload.schedule,
        payload.user_agent,
        payload.url_limit,
        payload.render_js,
        payload.respect_robots,
        payload.notify_email,
        payload.owner,
        payload.owner_email,
        payload.owner_uid,
        JSON.stringify(payload.project_data),
        payload.selected_project_id,
        JSON.stringify(payload.deleted_project_ids),
        payload.created_at,
        payload.updated_at,
      ];
    } else if (collectionKey === 'users/{uid}/meta') {
      query = `INSERT INTO \`user_meta\` (\`user_id\`, \`selected_project_id\`, \`deleted_project_ids\`, \`updated_at\`) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`selected_project_id\`=VALUES(\`selected_project_id\`), \`deleted_project_ids\`=VALUES(\`deleted_project_ids\`), \`updated_at\`=VALUES(\`updated_at\`);`;
      params = [payload.user_id, payload.selected_project_id, JSON.stringify(payload.deleted_project_ids), payload.updated_at];
    } else if (collectionKey === 'users/{uid}/projects/{projectId}/toolResults') {
      query = `INSERT INTO \`tool_results\` (\`user_id\`, \`project_id\`, \`tool_key\`, \`project_url\`, \`result\`, \`created_at\`, \`updated_at\`) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`project_url\`=VALUES(\`project_url\`), \`result\`=VALUES(\`result\`), \`updated_at\`=VALUES(\`updated_at\`);`;
      params = [payload.user_id, payload.project_id, payload.tool_key, payload.project_url, JSON.stringify(payload.result), payload.created_at, payload.updated_at];
    } else if (collectionKey === 'users/{uid}/gscConnection') {
      query = `INSERT INTO \`gsc_connections\` (\`user_id\`, \`access_token\`, \`refresh_token\`, \`expires_at\`, \`google_email\`, \`updated_at\`) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`access_token\`=VALUES(\`access_token\`), \`refresh_token\`=VALUES(\`refresh_token\`), \`expires_at\`=VALUES(\`expires_at\`), \`google_email\`=VALUES(\`google_email\`), \`updated_at\`=VALUES(\`updated_at\`);`;
      params = [payload.user_id, payload.access_token, payload.refresh_token, payload.expires_at, payload.google_email, payload.updated_at];
    } else if (collectionKey === 'users/{uid}/yandexConnection') {
      query = `INSERT INTO \`yandex_connections\` (\`user_id\`, \`access_token\`, \`refresh_token\`, \`expires_at\`, \`yandex_email\`, \`yandex_user_id\`, \`updated_at\`) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`access_token\`=VALUES(\`access_token\`), \`refresh_token\`=VALUES(\`refresh_token\`), \`expires_at\`=VALUES(\`expires_at\`), \`yandex_email\`=VALUES(\`yandex_email\`), \`yandex_user_id\`=VALUES(\`yandex_user_id\`), \`updated_at\`=VALUES(\`updated_at\`);`;
      params = [payload.user_id, payload.access_token, payload.refresh_token, payload.expires_at, payload.yandex_email, payload.yandex_user_id, payload.updated_at];
    } else if (collection === 'stripeConnections') {
      query = `INSERT INTO \`stripe_connections\` (\`user_id\`, \`stripe_account_id\`, \`email\`, \`created_at\`, \`updated_at\`, \`last_onboarding_link_at\`) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`stripe_account_id\`=VALUES(\`stripe_account_id\`), \`email\`=VALUES(\`email\`), \`updated_at\`=VALUES(\`updated_at\`), \`last_onboarding_link_at\`=VALUES(\`last_onboarding_link_at\`);`;
      params = [payload.user_id, payload.stripe_account_id, payload.email, payload.created_at, payload.updated_at, payload.last_onboarding_link_at];
    } else if (collection === 'project_data') {
      query = `INSERT INTO \`content_writer_profiles\` (\`user_id\`, \`profile_data\`, \`created_at\`, \`updated_at\`) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`profile_data\`=VALUES(\`profile_data\`), \`updated_at\`=VALUES(\`updated_at\`);`;
      params = [payload.user_id, JSON.stringify(payload.profile_data), payload.created_at, payload.updated_at];
    } else if (collection === 'adminSettings') {
      query = `INSERT INTO \`admin_settings\` (\`setting_key\`, \`setting_value\`, \`updated_at\`, \`updated_by\`) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE \`setting_value\`=VALUES(\`setting_value\`), \`updated_at\`=VALUES(\`updated_at\`), \`updated_by\`=VALUES(\`updated_by\`);`;
      params = [payload.setting_key, JSON.stringify(payload.setting_value), payload.updated_at, payload.updated_by];
    } else {
      throw new Error(`Unsupported MySQL patch collection: ${collection}`);
    }

    try {
      const [result] = await pool.query(query, params);
      return { success: true, storage: 'mysql', result };
    } catch (queryError) {
      const errorMsg = queryError?.message || queryError?.sqlMessage || String(queryError);
      const err = new Error(`MySQL query failed: ${errorMsg}`);
      err.originalError = queryError;
      throw err;
    }
  });
}

export async function deleteMySqlDocument(env, collection, documentId) {
  if (!isMySqlEnabled(env)) {
    return true;
  }

  const target = resolveStorageTarget(collection, documentId);
  const collectionKey = parseStoragePath(collection)?.key || collection;
  return withPool(env, async (pool) => {
    let query;
    let params;

    if (collectionKey === 'users/{uid}/projects') {
      query = 'DELETE FROM `user_projects` WHERE `user_id` = ? AND `project_id` = ?';
      params = [target.userId, target.projectId || normalizeDocumentId(documentId)];
    } else if (collectionKey === 'users/{uid}/meta') {
      query = 'DELETE FROM `user_meta` WHERE `user_id` = ?';
      params = [target.userId];
    } else if (collectionKey === 'users/{uid}/projects/{projectId}/toolResults') {
      query = 'DELETE FROM `tool_results` WHERE `user_id` = ? AND `project_id` = ? AND `tool_key` = ?';
      params = [target.userId, target.projectId || documentId?.projectId, target.toolKey || documentId?.toolKey];
    } else if (collectionKey === 'users/{uid}/gscConnection') {
      query = 'DELETE FROM `gsc_connections` WHERE `user_id` = ?';
      params = [target.userId];
    } else if (collectionKey === 'users/{uid}/yandexConnection') {
      query = 'DELETE FROM `yandex_connections` WHERE `user_id` = ?';
      params = [target.userId];
    } else if (collection === 'stripeConnections') {
      query = 'DELETE FROM `stripe_connections` WHERE `user_id` = ?';
      params = [target.userId];
    } else if (collection === 'project_data') {
      query = 'DELETE FROM `content_writer_profiles` WHERE `user_id` = ?';
      params = [target.userId];
    } else if (collection === 'adminSettings') {
      query = 'DELETE FROM `admin_settings` WHERE `setting_key` = ?';
      params = [target.settingKey];
    } else {
      throw new Error(`Unsupported MySQL delete collection: ${collection}`);
    }

    try {
      await pool.query(query, params);
      return true;
    } catch (queryError) {
      const errorMsg = queryError?.message || queryError?.sqlMessage || String(queryError);
      const err = new Error(`MySQL delete query failed: ${errorMsg}`);
      err.originalError = queryError;
      throw err;
    }
  });
}
