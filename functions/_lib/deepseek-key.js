import { configureMysqlConnection, queryOne } from './mysql.js';

/**
 * Resolve a DeepSeek API key for a request, from the same store the
 * /api/deepseek endpoint uses for the browser pages: the per-user
 * deepseek_api_settings row, then the DEEPSEEK_API_KEY env fallback.
 *
 * Returns '' rather than throwing, so callers can degrade exactly like the
 * pages do when DeepSeek is unavailable. The key is never logged.
 */
export const DEEPSEEK_NOT_CONFIGURED =
  'DeepSeek API is not configured. Please configure it from DeepSeek Settings.';

export async function resolveDeepSeekApiKey(user, env) {
  if (user?.id && user.id !== 'configured-admin') {
    try {
      configureMysqlConnection(env);
      const row = await queryOne(
        'SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [user.id]
      );
      const apiKey = typeof row?.api_key === 'string' ? row.api_key.trim() : '';
      if (apiKey) return apiKey;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }

  return String(env?.DEEPSEEK_API_KEY || '').trim();
}
