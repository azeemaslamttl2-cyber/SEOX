export async function callDeepSeekAPI(prompt, action = "semanticsxTool") {
  const response = await fetch("/api/deepseek", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, action }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `DeepSeek request failed (${response.status})`);
  }

  return data.text || "";
}

export const callGeminiAPI = callDeepSeekAPI;
