const MAX_TEXT_LENGTH = 2_000_000;

export function validateDomainSeparatorInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Request body must be a JSON object.');
    error.status = 400;
    throw error;
  }

  if (typeof input.text !== 'string' || input.text.length > MAX_TEXT_LENGTH) {
    const error = new Error(`text is required and must be ${MAX_TEXT_LENGTH} characters or fewer.`);
    error.status = 400;
    throw error;
  }

  return { text: input.text };
}

export function separateDomains(input) {
  const { text } = validateDomainSeparatorInput(input);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const domains = lines.map((line) => {
    try {
      return new URL(line.startsWith('http') ? line : `https://${line}`).hostname.replace(/^www\./, '');
    } catch {
      return line;
    }
  });
  const result = [...new Set(domains)];

  return {
    input: text,
    lines,
    domains,
    result,
    inputLineCount: lines.length,
    uniqueDomainCount: result.length,
    inputCharacterCount: text.length,
  };
}

export { MAX_TEXT_LENGTH };
