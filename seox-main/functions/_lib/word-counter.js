const MAX_TEXT_LENGTH = 2_000_000;

export function validateWordCounterInput(input = {}) {
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

export function countWords(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.length;
  const sentences = trimmed ? (trimmed.match(/[.!?]+/g) || []).length : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0;
  const reading = Math.max(0, Math.ceil(words / 200));

  return { words, characters, sentences, paragraphs, reading };
}

export function calculateWordCounter(input) {
  const { text } = validateWordCounterInput(input);
  return { text, ...countWords(text) };
}

export { MAX_TEXT_LENGTH };
