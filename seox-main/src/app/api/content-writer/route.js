import { onRequest } from '../../../../functions/api/content-writer.js';

export async function GET(request) { return onRequest({ request, env: process.env }); }
export async function PUT(request) { return onRequest({ request, env: process.env }); }
