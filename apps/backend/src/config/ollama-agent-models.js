export const OLLAMA_HOST =
  process.env.OLLAMA_HOST ||
  process.env.OLLAMA_BASE_URL ||
  "http://localhost:11434";

export const OLLAMA_AGENT_MODELS = Object.freeze({
  manager: process.env.OLLAMA_MANAGER_MODEL || "qwen3:8b",
  schema: process.env.OLLAMA_SCHEMA_MODEL || "qwen3:8b",
  dashboardPlanner: process.env.OLLAMA_DASHBOARD_MODEL || "qwen3:8b",
  dashboardChat: process.env.OLLAMA_DASHBOARD_CHAT_MODEL || "qwen3:4b",
  generalChat: process.env.OLLAMA_GENERAL_CHAT_MODEL || "llama3.2:3b",
  embedding: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
  fallback: process.env.OLLAMA_FALLBACK_MODEL || "qwen3:latest",
});

export const OLLAMA_OPTIONS = Object.freeze({
  temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.2),
  num_ctx: Number(process.env.OLLAMA_NUM_CTX || 4096),
  num_predict: Number(process.env.OLLAMA_NUM_PREDICT || 700),
  keep_alive: process.env.OLLAMA_KEEP_ALIVE || "24h",
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 4000),
});

export function getOllamaModelForAgent(agentRole) {
  return OLLAMA_AGENT_MODELS[agentRole] || OLLAMA_AGENT_MODELS.fallback;
}
