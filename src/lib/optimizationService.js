/**
 * Shared Content Optimization business logic
 * (/content/optimization and POST /api/content/optimization).
 *
 * The page computes analyzeContentOptimization(content) locally on every render
 * and offers an optional "Ask AI" button that calls DeepSeek for advice. Both
 * are reproduced here; the AI step is opt-in via includeAdvice.
 */
import { analyzeContentOptimization } from "./contentTools.js";
import { generateOptimizationAdviceDeepSeek } from "./deepseekContent.js";
import { normalizeOptionalBoolean, normalizeRequiredText, safeAiReason } from "./contentInput.js";

export const MAX_CONTENT_LENGTH = 500_000;

export function normalizeOptimizationInput({ content, text, includeAdvice } = {}) {
  const source = content !== undefined && content !== null ? content : text;
  return {
    content: normalizeRequiredText(source, { field: "content", max: MAX_CONTENT_LENGTH }),
    includeAdvice: normalizeOptionalBoolean(includeAdvice, "includeAdvice"),
  };
}

export async function analyzeContentForOptimization(options = {}) {
  const { content, includeAdvice } = normalizeOptimizationInput(options);

  const analysis = analyzeContentOptimization(content);

  // Same derived stats the page displays alongside the score.
  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const result = {
    score: analysis.score,
    checklist: analysis.checklist,
    entities: analysis.entities,
    nlp: analysis.nlp,
    words: analysis.words,
    wordCount,
    readingTime,
    characters: content.length,
    advice: { requested: includeAdvice, applied: false, reason: "", text: "" },
  };

  if (!includeAdvice) return result;

  try {
    result.advice.text = await generateOptimizationAdviceDeepSeek(content, {
      apiKey: options.apiKey,
    });
    result.advice.applied = Boolean(result.advice.text);
    if (!result.advice.applied) result.advice.reason = "DeepSeek returned no advice.";
  } catch (error) {
    result.advice.reason = safeAiReason(error, "DeepSeek could not review this content.");
  }

  return result;
}
