const OPERATIONS = new Set([
  'dedupe',
  'brackets',
  'empty',
  'keep',
  'upper',
  'lower',
  'title',
  'single',
  'replace',
  'prefix',
  'suffix',
]);

const MAX_TEXT_LENGTH = 2_000_000;
const MAX_OPTION_LENGTH = 10_000;

function stringOption(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value !== 'string') {
    const error = new Error('Text editor options must be strings.');
    error.status = 400;
    throw error;
  }
  if (value.length > MAX_OPTION_LENGTH) {
    const error = new Error(`Text editor options must be ${MAX_OPTION_LENGTH} characters or fewer.`);
    error.status = 400;
    throw error;
  }
  return value;
}

export function validateTextEditorInput(input = {}) {
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

  const operation = String(input.operation || input.op || '').trim().toLowerCase();
  if (!OPERATIONS.has(operation)) {
    const error = new Error(`operation must be one of: ${[...OPERATIONS].join(', ')}.`);
    error.status = 400;
    throw error;
  }

  return {
    text: input.text,
    operation,
    filter: stringOption(input.filter),
    replaceWith: stringOption(input.replaceWith, ','),
    prefix: stringOption(input.prefix),
    suffix: stringOption(input.suffix),
  };
}

function titleCaseLine(line) {
  return line.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

export function transformTextEditor(input) {
  const normalized = validateTextEditorInput(input);
  const { text, operation, filter, replaceWith, prefix, suffix } = normalized;
  const lines = text.split('\n');
  let result;

  switch (operation) {
    case 'dedupe':
      result = [...new Set(lines)].join('\n');
      break;
    case 'brackets':
      result = lines.map((line) => line.replace(/[\[\](){}]/g, '')).join('\n');
      break;
    case 'empty':
      result = lines.filter((line) => line.trim()).join('\n');
      break;
    case 'keep':
      result = lines.filter((line) => line.includes(filter)).join('\n');
      break;
    case 'upper':
      result = lines.map((line) => line.toUpperCase()).join('\n');
      break;
    case 'lower':
      result = lines.map((line) => line.toLowerCase()).join('\n');
      break;
    case 'title':
      result = lines.map(titleCaseLine).join('\n');
      break;
    case 'single':
      result = lines.join(' ');
      break;
    case 'replace':
      result = text.replace(/\n/g, replaceWith);
      break;
    case 'prefix':
      result = lines.map((line) => prefix + line).join('\n');
      break;
    case 'suffix':
      result = lines.map((line) => line + suffix).join('\n');
      break;
    default:
      throw new Error('Unsupported text editor operation.');
  }

  return {
    ...normalized,
    result,
    inputLineCount: lines.length,
    outputLineCount: result.split('\n').length,
    inputCharacterCount: text.length,
    outputCharacterCount: result.length,
  };
}

export { MAX_TEXT_LENGTH, OPERATIONS };
