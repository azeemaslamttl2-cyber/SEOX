import {
  askDeepSeekContent,
  generateMetaDescriptionsDeepSeek,
  generateTitleIdeasDeepSeek,
} from './deepseekContent.js';

export const AI_HELPER_ACTIONS = ['chat', 'title-ideas', 'meta-descriptions'];

export async function processAiHelperRequest({
  action,
  keyword = '',
  content = '',
  message = '',
  context = '',
  apiKey,
} = {}) {
  const normalizedAction = String(action || '').trim();

  if (!normalizedAction) {
    const error = new Error('Action is required.');
    error.status = 400;
    throw error;
  }

  if (!AI_HELPER_ACTIONS.includes(normalizedAction)) {
    const error = new Error(`Unsupported action: ${normalizedAction}`);
    error.status = 400;
    throw error;
  }

  if (normalizedAction === 'chat') {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      const error = new Error('message is required for chat action.');
      error.status = 400;
      throw error;
    }

    const result = await askDeepSeekContent({
      keyword,
      content,
      context: context || 'AI content helper API request.',
      message: cleanMessage,
      apiKey,
    });

    return {
      action: normalizedAction,
      keyword,
      content,
      message: cleanMessage,
      result,
    };
  }

  if (normalizedAction === 'title-ideas') {
    const result = await generateTitleIdeasDeepSeek({ keyword, content, apiKey });
    return {
      action: normalizedAction,
      keyword,
      content,
      result,
    };
  }

  const result = await generateMetaDescriptionsDeepSeek({ keyword, content, apiKey });
  return {
    action: normalizedAction,
    keyword,
    content,
    result,
  };
}
