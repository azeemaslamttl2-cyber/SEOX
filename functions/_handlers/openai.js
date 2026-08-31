import { requireAuthenticatedUser } from "../_lib/request-auth.js";

// Unified AI API endpoint for Content Writer - supports OpenAI, OpenRouter, Claude, DeepSeek, and Gemini.

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        try {
            await requireAuthenticatedUser(req);
        } catch (error) {
            return res.status(error?.status || 401).json({ error: error?.message || 'Unauthorized' });
        }

        const {
            prompt,
            apiKey,
            model,
            systemPrompt,
            temperature = 0.7,
            maxTokens = 4000,
            provider = 'openai' // 'openai' | 'openrouter' | 'claude' | 'deepseek' | 'gemini'
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Gemini and DeepSeek can use server-side keys, others require user-provided keys
        if (provider !== 'gemini' && provider !== 'deepseek' && !apiKey) {
            const providerLabel = provider === 'claude'
                ? 'Claude'
                : provider === 'openrouter'
                    ? 'OpenRouter'
                    : provider === 'deepseek'
                        ? 'DeepSeek'
                        : 'OpenAI';
            return res.status(400).json({ error: `${providerLabel} API key is required. Please add it in Settings.` });
        }

        // Route to appropriate provider
        if (provider === 'deepseek') {
            const deepSeekKey = apiKey || process.env.DEEPSEEK_API_KEY;
            if (!deepSeekKey) {
                return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
            }

            const messages = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            messages.push({ role: 'user', content: prompt });

            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepSeekKey}`
                },
                body: JSON.stringify({
                    model: model || 'deepseek-chat',
                    messages: messages,
                    temperature: temperature,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return res.status(response.status).json({
                    error: errorData.error?.message || `DeepSeek API error: ${response.status}`
                });
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';

            return res.status(200).json({
                text,
                usage: data.usage,
                model: data.model,
                provider: 'deepseek'
            });

        } else if (provider === 'gemini') {
            // Gemini API (Google) - uses server-side API key
            const GEMINI_KEY = process.env.GEMINI_API_KEY;
            if (!GEMINI_KEY) {
                return res.status(500).json({ error: 'Gemini API key not configured on server' });
            }

            const geminiModel = model || 'gemini-3-flash-preview';

            const requestBody = {
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: temperature ?? 0.7,
                    maxOutputTokens: maxTokens || 8192,
                }
            };

            if (systemPrompt) {
                requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                }
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return res.status(response.status).json({
                    error: errorData.error?.message || `Gemini API error: ${response.status}`
                });
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            return res.status(200).json({
                text,
                usage: data.usageMetadata,
                model: geminiModel,
                provider: 'gemini'
            });

        } else if (provider === 'claude') {
            // Claude (Anthropic) API
            const messages = [{ role: 'user', content: prompt }];

            const requestBody = {
                model: model || 'claude-sonnet-4-20250514',
                max_tokens: maxTokens || 8000,
                messages: messages
            };

            if (systemPrompt) {
                requestBody.system = systemPrompt;
            }

            if (temperature !== undefined) {
                requestBody.temperature = temperature;
            }

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return res.status(response.status).json({
                    error: errorData.error?.message || `Claude API error: ${response.status}`
                });
            }

            const data = await response.json();

            // Extract text from Claude's response format
            let text = '';
            if (data.content && Array.isArray(data.content)) {
                text = data.content
                    .filter(block => block.type === 'text')
                    .map(block => block.text)
                    .join('');
            }

            return res.status(200).json({
                text,
                usage: data.usage,
                model: data.model,
                provider: 'claude',
                stopReason: data.stop_reason
            });

        } else if (provider === 'openrouter') {
            // OpenRouter API
            const messages = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            messages.push({ role: 'user', content: prompt });

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': req.headers.origin || 'https://www.seox.com',
                    'X-Title': 'SEOX Content Writer'
                },
                body: JSON.stringify({
                    model: model || 'openai/gpt-4o-mini',
                    messages: messages,
                    temperature: temperature,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return res.status(response.status).json({
                    error: errorData.error?.message || errorData.message || `OpenRouter API error: ${response.status}`
                });
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';

            return res.status(200).json({
                text,
                usage: data.usage,
                model: data.model,
                provider: 'openrouter'
            });

        } else {
            // OpenAI API (default)
            const messages = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }

            messages.push({ role: 'user', content: prompt });

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'gpt-4o',
                    messages: messages,
                    temperature: temperature,
                    max_completion_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return res.status(response.status).json({
                    error: errorData.error?.message || `OpenAI API error: ${response.status}`
                });
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';

            return res.status(200).json({
                text,
                usage: data.usage,
                model: data.model,
                provider: 'openai'
            });
        }

    } catch (error) {
        console.error('AI API error:', error);
        return res.status(500).json({ error: error.message || 'Failed to call AI API' });
    }
}
