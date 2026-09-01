import {
    applyApiSecurity,
    enforceRateLimit,
    requireFirebaseUser,
    requireJsonBody
} from './security.js';
import { buildAiOperation } from './ai-operations.js';
import { callDeepSeek } from './ai-tools-deepseek.js';

export default async function handler(req, res) {
    if (!applyApiSecurity(req, res, { methods: ['POST', 'OPTIONS'] })) return;
    if (!enforceRateLimit(req, res, { key: 'ai-tools', limit: 20 })) return;
    if (!requireJsonBody(req, res, { maxBytes: 250_000 })) return;
    if (!await requireFirebaseUser(req, res)) return;

    let request;
    try {
        request = buildAiOperation(req.body?.operation, req.body?.inputs);
    } catch (error) {
        return res.status(400).json({ error: error.message || 'Invalid AI operation' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'AI service is not configured' });
    }

    try {
        const result = await callDeepSeek({ apiKey, ...request });
        return res.status(200).json({
            text: result.text,
            usage: result.usage,
            model: result.model
        });
    } catch (error) {
        console.error('Secure AI operation failed:', error?.status || error?.message);
        const invalidJson = error?.code === 'AI_INVALID_JSON';
        const timedOut = error?.code === 'AI_TIMEOUT';
        return res.status(timedOut ? 504 : error?.status && error.status < 500 ? error.status : 502).json({
            error: timedOut
                ? 'The AI service timed out. Please try again.'
                : invalidJson
                ? 'The AI response was incomplete.'
                : 'The AI operation could not be completed',
            ...(invalidJson ? { code: 'AI_INVALID_JSON' } : {}),
            ...(timedOut ? { code: 'AI_TIMEOUT' } : {})
        });
    }
}
