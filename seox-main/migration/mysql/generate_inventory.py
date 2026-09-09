from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = Path(__file__).resolve().parent
IGNORE_DIRS = {'.git', 'node_modules', 'dist', 'coverage'}


def iter_files():
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        parts = set(path.relative_to(ROOT).parts)
        if parts & IGNORE_DIRS:
            continue
        yield path.relative_to(ROOT).as_posix()


def escape_sql(value: str) -> str:
    return str(value).replace("'", "''")


def write_project_files_sql(path: Path):
    rows = []
    for rel in sorted(iter_files()):
        rows.append(
            f"INSERT INTO project_files (path, category, language, notes) VALUES ('{escape_sql(rel)}', 'source', NULL, NULL);"
        )
    path.write_text('\n'.join(rows) + '\n', encoding='utf-8')


def write_project_inventory_txt(path: Path):
    path.write_text('\n'.join(sorted(iter_files())) + '\n', encoding='utf-8')


def write_seed_analysis_sql(path: Path):
    inserts = []
    config_rows = [
        ('.env', 'env', 'Firebase and MySQL env vars must be migrated', 'Replace with MySQL connection variables and JWT settings'),
        ('.env.example', 'env-example', 'Template values for Firebase web config', 'Replace with MySQL and auth provider variables'),
        ('.env.local', 'env-local', 'Local Firebase credentials', 'Remove Firebase config and add MySQL connection settings'),
        ('.dev.vars.example', 'cloudflare-env', 'Cloudflare Pages secrets for Firebase and Stripe', 'Replace Firebase service account with MySQL credentials'),
        ('wrangler.jsonc', 'wrangler', 'Cloudflare deployment config', 'Keep, but remove Firebase-specific runtime assumptions'),
        ('package.json', 'package', 'Frontend dependencies', 'Remove firebase package, add mysql client or API wrapper dependency'),
    ]
    for p, ctype, summary, strategy in config_rows:
        inserts.append(
            f"INSERT INTO configuration_files (path, config_type, current_value_summary, replacement_strategy, notes) VALUES ('{escape_sql(p)}', '{escape_sql(ctype)}', '{escape_sql(summary)}', '{escape_sql(strategy)}', 'Migration from Firebase config to MySQL');"
        )

    collection_rows = [
        ('adminSettings', 'functions/api/api-settings.js', 'Admin API settings document', ['dataforseoLogin', 'dataforseoPassword', 'dataforseoUpdatedAt', 'dataforseoUpdatedBy'], ['string', 'string', 'string', 'string'], ['stored in a single admin settings row'], 'admin_settings'),
        ('stripeConnections', 'functions/api/stripe-connect.js', 'Stripe Connect account state', ['stripeAccountId', 'email', 'createdAt', 'updatedAt', 'lastOnboardingLinkAt'], ['string', 'string', 'string', 'string', 'string'], ['one row per uid'], 'stripe_connections'),
        ('users/{uid}/gscConnection', 'functions/api/gsc-token.js', 'Google Search Console OAuth token store', ['accessToken', 'refreshToken', 'expiresAt', 'googleEmail', 'updatedAt'], ['string', 'string', 'number', 'string', 'string'], ['one row per user'], 'gsc_connections'),
        ('users/{uid}/yandexConnection', 'functions/_handlers/webmaster-api.js', 'Yandex Webmaster OAuth token store', ['accessToken', 'refreshToken', 'expiresAt', 'yandexEmail', 'yandexUserId', 'updatedAt'], ['string', 'string', 'number', 'string', 'string', 'string'], ['one row per user'], 'yandex_connections'),
        ('users/{uid}/projects', 'functions/api/projects.js', 'User project metadata', ['id', 'name', 'domain', 'ownerUid', 'ownerEmail', 'updatedAt'], ['string', 'string', 'string', 'string', 'string', 'string'], ['one row per project'], 'user_projects'),
        ('users/{uid}/meta', 'functions/api/projects.js', 'Selected project and deleted IDs', ['selectedProjectId', 'deletedProjectIds', 'updatedAt'], ['string', 'array', 'string'], ['one row per user'], 'user_meta'),
        ('users/{uid}/projects/{projectId}/toolResults', 'functions/api/projects.js', 'Tool result snapshots', ['projectId', 'toolKey', 'projectUrl', 'result', 'updatedAt'], ['string', 'string', 'string', 'json', 'string'], ['one row per tool per project'], 'tool_results'),
        ('project_data', 'src/pages/content/ContentWriterDashboard.jsx', 'Content writer articles state', ['contentWriterArticles', 'contentWriterStates_*'], ['array', 'json'], ['one row per user'], 'content_writer_profiles'),
    ]
    for name, source_file, description, fields, inferred_types, relationships, mysql_table in collection_rows:
        inserts.append(
            f"INSERT INTO firestore_collections (collection_name, source_file, description, document_fields_json, inferred_types_json, relationships_json, mysql_table_name, notes) VALUES ('{escape_sql(name)}', '{escape_sql(source_file)}', '{escape_sql(description)}', '{json.dumps(fields)}', '{json.dumps(inferred_types)}', '{json.dumps(relationships)}', '{escape_sql(mysql_table)}', 'Mapped to MySQL table');"
        )

    mapping_rows = [
        ('adminSettings', 'admin_settings', 'Single-row settings store'),
        ('stripeConnections', 'stripe_connections', 'One row per user connection'),
        ('users/{uid}/gscConnection', 'gsc_connections', 'One row per user'),
        ('users/{uid}/yandexConnection', 'yandex_connections', 'One row per user'),
        ('users/{uid}/projects', 'user_projects', 'One row per project'),
        ('users/{uid}/meta', 'user_meta', 'One row per user'),
        ('users/{uid}/projects/{projectId}/toolResults', 'tool_results', 'One row per tool result'),
        ('project_data', 'content_writer_profiles', 'One row per user with JSON payloads'),
    ]
    for firestore_collection, mysql_table, notes in mapping_rows:
        inserts.append(
            f"INSERT INTO database_schema_mapping (firestore_collection, mysql_table, mapping_notes) VALUES ('{escape_sql(firestore_collection)}', '{escape_sql(mysql_table)}', '{escape_sql(notes)}');"
        )

    endpoint_rows = [
        ('/api/projects', 'GET', 'functions/api/projects.js', 1, 1, 'Project listing and persistence'),
        ('/api/projects', 'POST', 'functions/api/projects.js', 1, 1, 'Project metadata save'),
        ('/api/projects', 'DELETE', 'functions/api/projects.js', 1, 1, 'Delete project'),
        ('/api/api-settings', 'GET', 'functions/api/api-settings.js', 1, 1, 'Read settings'),
        ('/api/api-settings', 'POST', 'functions/api/api-settings.js', 1, 1, 'Write settings'),
        ('/api/gsc-token', 'POST', 'functions/api/gsc-token.js', 1, 1, 'Search Console OAuth token operations'),
        ('/api/stripe-connect', 'GET', 'functions/api/stripe-connect.js', 1, 1, 'Stripe connection lookup'),
        ('/api/stripe-connect', 'POST', 'functions/api/stripe-connect.js', 1, 1, 'Stripe onboarding flow'),
        ('/api/admin-data', 'GET', 'functions/api/admin-data.js', 1, 1, 'Admin dashboard data'),
        ('/api/admin-stripe', 'GET', 'functions/api/admin-stripe.js', 1, 1, 'Admin Stripe connection list'),
        ('/api/webmaster-api', 'POST', 'functions/api/webmaster-api.js', 1, 1, 'Yandex token persistence'),
    ]
    for path, method, handler, auth, fs, notes in endpoint_rows:
        inserts.append(
            f"INSERT INTO api_endpoints (path, method, handler_file, uses_firebase_auth, uses_firestore, notes) VALUES ('{escape_sql(path)}', '{escape_sql(method)}', '{escape_sql(handler)}', {int(auth)}, {int(fs)}, '{escape_sql(notes)}');"
        )

    inserts.append("INSERT INTO progress_status (phase, status, completed_items, notes) VALUES ('analysis', 'completed', 12, 'Firebase/Firestore inventory and migration plan created');")
    path.write_text('\n'.join(inserts) + '\n', encoding='utf-8')


def write_app_schema_sql(path: Path):
    schema = """CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'email',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS user_projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  project_data JSON NOT NULL,
  selected_project_id VARCHAR(255) NULL,
  deleted_project_ids JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_project (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS user_meta (
  user_id VARCHAR(128) NOT NULL,
  selected_project_id VARCHAR(255) NULL,
  deleted_project_ids JSON NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS tool_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  tool_key VARCHAR(100) NOT NULL,
  project_url VARCHAR(500) NULL,
  result JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tool_result (user_id, project_id, tool_key)
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON NULL,
  updated_at DATETIME NOT NULL,
  updated_by VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_settings_key (setting_key)
);

CREATE TABLE IF NOT EXISTS stripe_connections (
  user_id VARCHAR(128) NOT NULL,
  stripe_account_id VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_onboarding_link_at DATETIME NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS gsc_connections (
  user_id VARCHAR(128) NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  google_email VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS yandex_connections (
  user_id VARCHAR(128) NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  yandex_email VARCHAR(255) NULL,
  yandex_user_id VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS content_writer_profiles (
  user_id VARCHAR(128) NOT NULL,
  profile_data JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);
"""
    path.write_text(schema, encoding='utf-8')


def write_data_migration_sql(path: Path):
    migration_sql = """INSERT INTO users (id, email, display_name, provider, created_at, updated_at)
SELECT uid, email, display_name, 'firebase', NOW(), NOW() FROM staging_users WHERE uid IS NOT NULL;

INSERT INTO user_projects (user_id, project_id, project_data, selected_project_id, deleted_project_ids, created_at, updated_at)
SELECT user_id, project_id, JSON_OBJECT('raw', project_payload), selected_project_id, JSON_ARRAY(), NOW(), NOW() FROM staging_projects;

INSERT INTO gsc_connections (user_id, access_token, refresh_token, expires_at, google_email, updated_at)
SELECT user_id, access_token, refresh_token, FROM_UNIXTIME(expires_at / 1000), google_email, NOW() FROM staging_gsc_connections;
"""
    path.write_text(migration_sql, encoding='utf-8')


if __name__ == '__main__':
    write_project_inventory_txt(OUT_DIR / 'project_file_inventory.txt')
    write_project_files_sql(OUT_DIR / 'seed_project_files.sql')
    write_seed_analysis_sql(OUT_DIR / 'seed_analysis.sql')
    write_app_schema_sql(OUT_DIR / 'app_schema.sql')
    write_data_migration_sql(OUT_DIR / 'data_migration.sql')
    print('Generated migration SQL seed files')
