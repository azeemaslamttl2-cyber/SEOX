import { readFile } from 'node:fs/promises';
import { loadUploadStorage, safeChildPath, verifyReportDownloadUrl } from '../screaming-frog.js';

const REPORT_NAME = /^screaming-frog-report-\d{8}-\d{3,}\.(csv|pdf)$/;

function failure(message, status) {
  return Response.json({ status: 'error', success: false, message }, { status });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return failure('Method not allowed', 405);
  const query = new URL(request.url).searchParams;
  const filename = String(query.get('file') || '');
  if (!REPORT_NAME.test(filename)) return failure('Report file was not found', 404);

  try {
    const valid = await verifyReportDownloadUrl(filename, query.get('expires'), query.get('signature'), env);
    if (!valid) return failure('This report download link is invalid or has expired', 403);
    const storage = await loadUploadStorage(env);
    // Reports are only ever generated under the server-authenticated admin
    // account. The signed URL is required even when the filename is known.
    const adminDirectory = safeChildPath(storage.path, storage.root, 'admin');
    const target = safeChildPath(storage.path, adminDirectory, filename);
    const file = await readFile(target).catch((cause) => {
      if (cause?.code === 'ENOENT') return null;
      throw cause;
    });
    if (!file) return failure('The requested report is no longer available', 404);
    const contentType = filename.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/pdf';
    return new Response(file, {
      headers: {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (cause) {
    return failure(cause?.message || 'Unable to download report', cause?.status || 500);
  }
}
