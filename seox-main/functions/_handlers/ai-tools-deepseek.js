// Vercel Serverless Function for DeepSeek API calls.
// API key is stored server-side via environment variable: DEEPSEEK_API_KEY.

import { buildAiOperation } from './ai-operations.js';
import {
    applyApiSecurity,
    enforceRateLimit,
    requireFirebaseUser,
    requireJsonBody
} from './security.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const JSON_RESPONSE_ATTEMPTS = 2;
const DEEPSEEK_REQUEST_TIMEOUT_MS = 45_000;

export class InvalidJsonResponseError extends Error {
    constructor(message = 'The AI service returned invalid JSON') {
        super(message);
        this.name = 'InvalidJsonResponseError';
        this.code = 'AI_INVALID_JSON';
    }
}

export class AiProviderTimeoutError extends Error {
    constructor(message = 'The AI provider timed out') {
        super(message);
        this.name = 'AiProviderTimeoutError';
        this.code = 'AI_TIMEOUT';
        this.status = 504;
    }
}

function normalizeJsonObject(text) {
    const value = typeof text === 'string' ? text.trim() : '';
    if (!value) throw new InvalidJsonResponseError('The AI service returned an empty JSON response');

    let parsed;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new InvalidJsonResponseError();
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new InvalidJsonResponseError('The AI service did not return a JSON object');
    }

    // Returning canonical JSON guarantees browser callers never receive fences,
    // explanatory prose, or syntactically incomplete model output.
    return JSON.stringify(parsed);
}

export default async function handler(req, res) {
    if (!applyApiSecurity(req, res, { methods: ['POST', 'OPTIONS'] })) return;
    if (!enforceRateLimit(req, res, { key: 'deepseek', limit: 20 })) return;
    if (!requireJsonBody(req, res, { maxBytes: 300_000 })) return;
    if (!await requireFirebaseUser(req, res)) return;

    return handleDeepSeekRequest(req, res);
}

export async function handleDeepSeekRequest(req, res) {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
    }

    let request;
    try {
        request = buildAiOperation(req.body?.operation, req.body?.inputs);
    } catch (error) {
        return res.status(400).json({ error: error.message || 'Invalid AI operation' });
    }

    try {
        const result = await callDeepSeek({ apiKey, ...request });

        return res.status(200).json({
            text: result.text,
            usage: result.usage,
            model: result.model,
        });
    } catch (error) {
        console.error('DeepSeek AI operation failed:', error?.status || error?.message);
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

export async function callDeepSeek({
    apiKey,
    prompt,
    systemInstruction,
    responseMimeType,
    temperature = 0.7,
    maxTokens = 8192,
    model = DEEPSEEK_MODEL,
    thinking = false,
}) {
    const wantsJson = responseMimeType === 'application/json';
    const thinkingEnabled = thinking === true;
    const baseSystemMessages = [];

    if (systemInstruction) {
        baseSystemMessages.push(systemInstruction);
    }

    if (wantsJson) {
        baseSystemMessages.push('Return one complete, valid JSON object only. Never truncate a string or omit closing braces.');
    }

    const attempts = wantsJson ? JSON_RESPONSE_ATTEMPTS : 1;
    let lastJsonError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const systemMessages = [...baseSystemMessages];
        if (attempt > 0) {
            systemMessages.push('The previous response was malformed or incomplete. Regenerate it from scratch as a smaller, complete JSON object.');
        }

        const messages = [];
        if (systemMessages.length > 0) {
            messages.push({ role: 'system', content: systemMessages.join('\n\n') });
        }
        messages.push({ role: 'user', content: prompt });

        const requestBody = {
            model,
            messages,
            max_tokens: maxTokens,
            stream: false,
            thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
            ...(!thinkingEnabled ? {
                temperature: attempt > 0 ? Math.min(temperature, 0.2) : temperature,
            } : {}),
            ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_REQUEST_TIMEOUT_MS);

        try {
            let response;
            try {
                response = await fetch(DEEPSEEK_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });
            } catch (error) {
                if (error?.name === 'AbortError') throw new AiProviderTimeoutError();
                throw error;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || `DeepSeek API error: ${response.status}`);
                error.status = response.status;
                error.details = errorData;
                throw error;
            }

            const data = await response.json();
            const choice = data.choices?.[0];
            const rawText = choice?.message?.content || '';

            if (wantsJson) {
                if (choice?.finish_reason === 'length') {
                    lastJsonError = new InvalidJsonResponseError('The AI service returned truncated JSON');
                    continue;
                }
                try {
                    const text = normalizeJsonObject(rawText);
                    return {
                        text,
                        usage: data.usage,
                        model: data.model || model,
                    };
                } catch (error) {
                    lastJsonError = error;
                    continue;
                }
            }

            return {
                text: rawText,
                usage: data.usage,
                model: data.model || model,
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastJsonError || new InvalidJsonResponseError();
}
