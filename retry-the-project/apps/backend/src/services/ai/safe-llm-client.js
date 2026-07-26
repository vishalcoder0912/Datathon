import { assertNoRawRowsInLLMPayload } from "./llm-payload-sanitizer.js";
import { aiManager } from "./ai-manager.js";

export async function callLLMSafely({ model, systemPrompt, userPayload, task }) {
  // Validate payload before sending to LLM
  assertNoRawRowsInLLMPayload(userPayload);

  const prompt = systemPrompt
    ? `${systemPrompt}\n\nPayload:\n${JSON.stringify(userPayload, null, 2)}`
    : JSON.stringify(userPayload, null, 2);

  console.log(`[Safe LLM Client] Routing call safely for task: "${task || "unnamed"}" with model: "${model || "default"}"`);

  const response = await aiManager.generateResponse(prompt, { preferredModel: model });

  if (!response.success) {
    throw new Error(`Safe LLM call failed: ${response.error || "Unknown error"}`);
  }

  return response.content;
}
