import { vectorDbConfig } from "../../config/vector-db.js";
import { deterministicTextEmbedding, normalizeVector } from "../ai-analyst/schema-rag-embeddings.js";

let cachedDimension = null;

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function extractEmbedding(payload = {}) {
  if (Array.isArray(payload.embeddings?.[0])) return payload.embeddings[0];
  if (Array.isArray(payload.embedding)) return payload.embedding;
  return null;
}

export async function embedWithOllama(text = "", options = {}) {
  const model = options.model || vectorDbConfig.embedding.model;
  const baseUrl = options.baseUrl || vectorDbConfig.embedding.ollamaBaseUrl;
  const input = String(text || "").trim() || "empty schema memory";
  const { signal, clear } = timeoutSignal(options.timeoutMs || vectorDbConfig.embedding.timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama /api/embed HTTP ${response.status}`);
    }

    const payload = await response.json();
    const embedding = normalizeVector(extractEmbedding(payload));

    if (!embedding.length) {
      throw new Error("Ollama /api/embed returned no embedding vector.");
    }

    cachedDimension = embedding.length;

    return {
      embedding,
      dimension: embedding.length,
      provider: "ollama",
      model,
      fallback: false,
    };
  } finally {
    clear();
  }
}

export async function embedSchemaMemoryText(text = "", options = {}) {
  try {
    return await embedWithOllama(text, options);
  } catch (error) {
    if (options.allowFallback === false) throw error;

    const embedding = deterministicTextEmbedding(text || "empty schema memory");
    cachedDimension = embedding.length;

    return {
      embedding,
      dimension: embedding.length,
      provider: "local-deterministic",
      model: "deterministic-hash",
      fallback: true,
      error: error.message,
    };
  }
}

export async function detectEmbeddingDimension(options = {}) {
  if (cachedDimension && !options.force) return cachedDimension;

  const result = await embedSchemaMemoryText("dimension probe for schema rag", options);
  cachedDimension = result.dimension;
  return cachedDimension;
}

export function getCachedEmbeddingDimension() {
  return cachedDimension;
}
