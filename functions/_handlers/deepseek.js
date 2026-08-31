import { requireAuthenticatedUser } from "../_lib/request-auth.js";

// Shared Node-style handler used by the Cloudflare Pages Function wrapper.
// API key is stored server-side via environment variable: DEEPSEEK_API_KEY.
// Mirrors the old Gemini endpoint shape so existing tools can switch providers cleanly.

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const MAX_PROMPT_CHARS = 60_000;
const MAX_SYSTEM_CHARS = 12_000;
const MAX_TOKENS = 8192;

export default async function handler(req, res) {
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
        await requireAuthenticatedUser(req);
    } catch (error) {
        return res.status(error?.status || 401).json({ error: error?.message || 'Unauthorized' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
    }

    const {
        prompt,
        action,
        systemInstruction,
        responseMimeType,
        temperature,
        maxTokens,
        model,
        titles,
    } = req.body;

    if (action === 'analyzeBacklinkTitles') {
        return handleBacklinkTitleAnalysis(req, res, apiKey, titles);
    }

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    if (String(prompt).length > MAX_PROMPT_CHARS || String(systemInstruction || '').length > MAX_SYSTEM_CHARS) {
        return res.status(413).json({ error: 'Prompt is too large' });
    }

    try {
        const result = await callDeepSeek({
            apiKey,
            prompt,
            systemInstruction,
            responseMimeType,
            temperature,
            maxTokens,
            model,
        });

        return res.status(200).json({
            text: result.text,
            action,
            usage: result.usage,
            model: result.model,
        });
    } catch (error) {
        console.error('DeepSeek API error:', error.details || error);
        return res.status(error.status || 500).json({
            error: error.message || 'Failed to call DeepSeek API',
            details: error.details,
        });
    }
}

async function callDeepSeek({
    apiKey,
    prompt,
    systemInstruction,
    responseMimeType,
    temperature = 0.7,
    maxTokens = 8192,
    model = DEEPSEEK_MODEL,
}) {
    const wantsJson = responseMimeType === 'application/json';
    const systemMessages = [];

    if (systemInstruction) {
        systemMessages.push(systemInstruction);
    }

    if (wantsJson) {
        systemMessages.push('Return valid JSON only.');
    }

    const messages = [];
    if (systemMessages.length > 0) {
        messages.push({ role: 'system', content: systemMessages.join('\n\n') });
    }
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
        model: model || DEEPSEEK_MODEL,
        messages,
        temperature: clampNumber(temperature, 0.7, 0, 2),
        max_tokens: clampNumber(maxTokens, 8192, 1, MAX_TOKENS),
        stream: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.error?.message || `DeepSeek API error: ${response.status}`);
            error.status = response.status;
            error.details = errorData;
            throw error;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';

        return {
            text,
            usage: data.usage,
            model: data.model || model,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function handleBacklinkTitleAnalysis(req, res, apiKey, titles) {
    if (!titles || !Array.isArray(titles) || titles.length === 0) {
        return res.status(400).json({ error: 'Titles array is required' });
    }

    try {
        const titlesToAnalyze = titles.slice(0, 50);

        const prompt = `You are an SEO expert analyzing backlink page titles for spam and quality indicators.

Analyze these page titles from backlink sources and flag any that appear to be:
- Spam/scam pages
- Adult content
- Casino/gambling content
- Pharmaceutical spam
- Hacked pages
- PBN (Private Blog Network) pages
- Low-quality/doorway pages
- Foreign language spam
- Auto-generated content
- Link farms

For each title, provide spam flags if applicable. Only flag pages that show clear spam signals.

Page titles to analyze:
${titlesToAnalyze.map((t, i) => `${i + 1}. [ID:${t.id}] Domain: ${t.domain} | Title: "${t.title}"`).join('\n')}

Respond in JSON format:
{
  "results": [
    {
      "id": <number>,
      "flags": ["flag1", "flag2"],
      "spamScore": <0-100>
    }
  ]
}

Only include entries that have actual spam flags (score >= 30). Skip clean entries.`;

        const result = await callDeepSeek({
            apiKey,
            prompt,
            systemInstruction: 'Return valid JSON only.',
            responseMimeType: 'application/json',
            temperature: 0.3,
            maxTokens: 4096,
        });

        try {
            const parsed = JSON.parse(cleanJsonText(result.text || '{}'));
            return res.status(200).json({
                results: parsed.results || [],
                success: true,
                usage: result.usage,
                model: result.model,
            });
        } catch {
            console.error('Failed to parse AI response:', result.text);
            return res.status(200).json({ results: [], error: 'Failed to parse AI response' });
        }
    } catch (error) {
        console.error('Analyze backlinks error:', error.details || error);
        return res.status(200).json({
            results: [],
            error: error.message,
            success: false,
        });
    }
}

function cleanJsonText(text) {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function clampNumber(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}
