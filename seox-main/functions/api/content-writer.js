import { requireUser } from '../_lib/auth-token.js';
import { getMySqlDocument, patchMySqlDocument } from '../_lib/mysql-repository.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, PUT, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    const user = await requireUser(request, env);
    const userId = user?.id || user?.uid;

    if (request.method === 'GET') {
      const doc = (await getMySqlDocument(env, 'project_data', userId)) || {};
      return jsonResponse(doc, 200, headers);
    }

    if (request.method !== 'PUT') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const data = await readJson(request);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResponse({ error: 'Invalid content profile.' }, 400, headers);
    }

    await patchMySqlDocument(env, 'project_data', userId, data);
    return jsonResponse({ ok: true, success: true }, 200, headers);
  } catch (error) {
    return jsonResponse({ error: error.message || 'Content profile request failed.' }, error.status || 500, headers);
  }
}

export default onRequest;
