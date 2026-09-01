const BLOCKED_ELEMENTS = [
    'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'portal', 'form', 'input', 'button', 'textarea', 'select', 'option',
    'meta', 'base', 'link'
].join(',');

const URL_ATTRIBUTES = new Set([
    'href', 'src', 'poster', 'cite', 'background', 'xlink:href', 'action', 'formaction'
]);
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
const DANGEROUS_STYLE = /(?:expression\s*\(|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data:text\/html)|@import|-moz-binding|behavior\s*:)/i;

function safeUrl(value, baseUrl) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (SAFE_DATA_IMAGE.test(trimmed)) return trimmed;
    try {
        const parsed = new URL(trimmed, baseUrl || window.location.origin);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

function sanitizeTree(doc, baseUrl) {
    doc.querySelectorAll(BLOCKED_ELEMENTS).forEach((element) => element.remove());
    for (const element of doc.querySelectorAll('*')) {
        for (const attribute of [...element.attributes]) {
            const name = attribute.name.toLowerCase();
            const value = attribute.value;
            if (name.startsWith('on')
                || name === 'srcdoc'
                || name === 'nonce'
                || name === 'ping'
                || name === 'autofocus') {
                element.removeAttribute(attribute.name);
                continue;
            }
            if (URL_ATTRIBUTES.has(name)) {
                const resolved = safeUrl(value, baseUrl);
                if (resolved) element.setAttribute(attribute.name, resolved);
                else element.removeAttribute(attribute.name);
                continue;
            }
            if (name === 'srcset') {
                const sanitized = value.split(',')
                    .map((candidate) => {
                        const [url, descriptor] = candidate.trim().split(/\s+/, 2);
                        const resolved = safeUrl(url, baseUrl);
                        return resolved ? `${resolved}${descriptor ? ` ${descriptor}` : ''}` : '';
                    })
                    .filter(Boolean)
                    .join(', ');
                if (sanitized) element.setAttribute(attribute.name, sanitized);
                else element.removeAttribute(attribute.name);
                continue;
            }
            if (name === 'style' && DANGEROUS_STYLE.test(value)) {
                element.removeAttribute(attribute.name);
            }
        }
    }
    for (const style of doc.querySelectorAll('style')) {
        if (DANGEROUS_STYLE.test(style.textContent || '')) style.remove();
    }
    return doc;
}

export function sanitizeRemoteHtml(html, { baseUrl } = {}) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    sanitizeTree(doc, baseUrl);
    const csp = doc.createElement('meta');
    csp.setAttribute('http-equiv', 'Content-Security-Policy');
    csp.setAttribute(
        'content',
        "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline' https: http:; font-src https: http: data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    );
    doc.head.prepend(csp);
    return `<!doctype html>${doc.documentElement.outerHTML}`;
}

export function sanitizeRemoteFragment(html, { baseUrl } = {}) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
    sanitizeTree(doc, baseUrl);
    return doc.body.innerHTML;
}
