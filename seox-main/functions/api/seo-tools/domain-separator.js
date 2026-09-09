import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { separateDomains } from '../../_lib/domain-separator.js';

const MAX_TOKEN_LENGTH = 512;

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'Domain separation failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({
    success: false,
    status: status === 401 ? 'unauthorized' : status === 400 ? 'validation_error' : 'error',
    message,
    data: null,
    error: {
      code: status === 401 ? 'UNAUTHORIZED' : status === 400 ? 'INVALID_REQUEST' : 'DOMAIN_SEPARATOR_ERROR',
      details: status >= 500 ? undefined : error.message,
    },
  }, status, headers);
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('POST, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') {
    return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);
  }

  try {
    const input = await readJson(request);
    const adminToken = typeof input?.admin_token === 'string' ? input.admin_token.trim() : '';
    if (!adminToken) {
      return apiError(Object.assign(new Error('Admin token is required.'), { status: 401 }), headers);
    }
    if (adminToken.length > MAX_TOKEN_LENGTH) {
      return apiError(Object.assign(new Error('Invalid admin token.'), { status: 401 }), headers);
    }

    configureMysqlConnection(env);
    const admin = await queryOne(
      `SELECT id FROM users
       WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL
       LIMIT 1`,
      [adminToken]
    );
    if (!admin) {
      return apiError(Object.assign(new Error('Invalid admin token.'), { status: 401 }), headers);
    }

    const processed = separateDomains(input);
    return jsonResponse({
      success: true,
      status: 'success',
      message: 'Domain separation completed successfully.',
      data: {
        domains: processed.result,
        count: processed.uniqueDomainCount,
        processing: {
          inputLineCount: processed.inputLineCount,
          uniqueDomainCount: processed.uniqueDomainCount,
          inputCharacterCount: processed.inputCharacterCount,
        },
      },
      meta: {
        adminId: admin.id,
        processedAt: new Date().toISOString(),
      },
    }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
