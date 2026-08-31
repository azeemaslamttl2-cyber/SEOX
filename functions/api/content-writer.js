import { requireUser } from '../_lib/auth-token.js';
import { getMySqlDocument, patchMySqlDocument } from '../_lib/mysql-repository.js';

export async function onRequest({ request, env }) {
  try {
    const user = await requireUser(request, env);
    if (request.method === 'GET') {
      return Response.json((await getMySqlDocument(env, 'project_data', user.id)) || {});
    }
    if (request.method !== 'PUT') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return Response.json({ error: 'Invalid content profile.' }, { status: 400 });
    await patchMySqlDocument(env, 'project_data', user.id, data);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Content profile request failed.' }, { status: error.status || 500 });
  }
}
