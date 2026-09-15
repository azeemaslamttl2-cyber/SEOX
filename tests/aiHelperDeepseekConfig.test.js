import test from "node:test";
import assert from "node:assert/strict";
import { callDeepSeekContent } from "../src/lib/deepseekContent.js";

test("callDeepSeekContent rejects when no DeepSeek configuration is available", async () => {
  await assert.rejects(
    () => callDeepSeekContent({ action: "contentAssistantChat", prompt: "hello" }),
    /DeepSeek API is not configured/i
  );
});

test("callDeepSeekContent uses the provided configured API key", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer configured-key");
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "configured" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        model: "deepseek-chat",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const result = await callDeepSeekContent({
      action: "contentAssistantChat",
      prompt: "hello",
      apiKey: "configured-key",
    });
    assert.equal(result.text, "configured");
    assert.equal(result.model, "deepseek-chat");
  } finally {
    global.fetch = originalFetch;
  }
});
