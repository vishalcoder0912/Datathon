import { createHash } from "node:crypto";
import { OLLAMA_AGENT_MODELS } from "../../config/ollama-agent-models.js";

const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const DEFAULT_EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL || OLLAMA_AGENT_MODELS.embedding;

const DEFAULT_VECTOR_SIZE = Number(process.env.RAG_FALLBACK_VECTOR_SIZE || 384);

function timeoutSignal(ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function normalizeVector(vector = []) {
  const values = Array.isArray(vector) ? vector.map(Number).filter(Number.isFinite) : [];
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

  if (!values.length || magnitude === 0) return [];

  return values.map((value) => value / magnitude);
}

export function cosineSimilarity(a = [], b = []) {
  const left = normalizeVector(a);
  const right = normalizeVector(b);
  const length = Math.min(left.length, right.length);

  if (!length) return 0;

  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }

  return dot;
}

export function deterministicTextEmbedding(text = "", dimensions = DEFAULT_VECTOR_SIZE) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenize(text);

  if (!tokens.length) return vector;

  tokens.forEach((token, index) => {
    const digest = createHash("sha256")
      .update(`${token}:${index}`)
      .digest();

    const bucket = digest.readUInt16BE(0) % dimensions;
    const sign = digest[2] % 2 === 0 ? 1 : -1;
    const weight = 1 + Math.log(1 + token.length);

    vector[bucket] += sign * weight;
  });

  return normalizeVector(vector);
}

async function callOllamaEmbedApi(text, model) {
  const { signal, clear } = timeoutSignal();

  try {
    const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama /api/embed HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (Array.isArray(payload.embeddings?.[0])) {
      return payload.embeddings[0];
    }

    if (Array.isArray(payload.embedding)) {
      return payload.embedding;
    }

    throw new Error("Ollama /api/embed returned no embedding.");
  } finally {
    clear();
  }
}

async function callOllamaEmbeddingsApi(text, model) {
  const { signal, clear } = timeoutSignal();

  try {
    const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama /api/embeddings HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (Array.isArray(payload.embedding)) {
      return payload.embedding;
    }

    throw new Error("Ollama /api/embeddings returned no embedding.");
  } finally {
    clear();
  }
}

export async function embedText(text = "", options = {}) {
  const model = options.model || DEFAULT_EMBEDDING_MODEL;
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return {
      embedding: deterministicTextEmbedding("empty-schema"),
      provider: "local-deterministic",
      model: "deterministic-hash",
      fallback: true,
    };
  }

  const shouldUseLocalEmbedding =
    options.useOllama === false ||
    process.env.DISABLE_OLLAMA_EMBEDDINGS === "1" ||
    (process.env.NODE_ENV === "test" && process.env.TEST_REAL_OLLAMA !== "1");

  if (shouldUseLocalEmbedding) {
    return {
      embedding: deterministicTextEmbedding(cleanText),
      provider: "local-deterministic",
      model: "deterministic-hash",
      fallback: true,
    };
  }

  try {
    let embedding;

    try {
      embedding = await callOllamaEmbedApi(cleanText, model);
    } catch {
      embedding = await callOllamaEmbeddingsApi(cleanText, model);
    }

    return {
      embedding: normalizeVector(embedding),
      provider: "ollama",
      model,
      fallback: false,
    };
  } catch (error) {
    if (options.allowFallback === false) {
      throw error;
    }

    return {
      embedding: deterministicTextEmbedding(cleanText),
      provider: "local-deterministic",
      model: "deterministic-hash",
      fallback: true,
      error: error.message,
    };
  }
}
