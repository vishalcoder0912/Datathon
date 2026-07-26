import { serviceUrls } from "../../config/serviceUrls.js";
import { getModelForTask } from "../../config/model-router.js";

const OLLAMA_BASE_URL = serviceUrls.ollama;

export async function callOllamaJson({
  model,
  messages,
  schema,
  temperature = 0.05,
  numCtx = 4096,
  numPredict = 1200,
  timeoutMs = Number(process.env.DASHBOARD_LLM_TIMEOUT_MS || 45000),
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: "60s",
      format: schema,
      options: {
        temperature,
        num_ctx: numCtx,
        num_predict: numPredict,
      },
      messages,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.message?.content || "{}";

  try {
    return JSON.parse(content);
  } catch {
    return {
      action: "ANSWER",
      message: "AI returned invalid JSON.",
      schemaOnly: true,
    };
  }
}

export async function createEmbedding(text) {
  const model = getModelForTask("embedding");

  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload.embedding || [];
}
