/**
 * Ollama Manager Service
 * Multi-model orchestration: Manager AI, Dashboard AI, Chat AI, Embeddings
 * Models: qwen3:8b (manager), qwen3:4b (dashboard), llama3.2:3b (chat), nomic-embed-text (embeddings)
 */

import { retrieveLearningMemory } from "../ai-analyst/self-learning-memory.js";

const OLLAMA_HOST = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const MODELS = {
  manager: process.env.OLLAMA_MANAGER_MODEL || "qwen3:8b",
  dashboard: process.env.OLLAMA_DASHBOARD_MODEL || "qwen3:4b",
  chat: process.env.OLLAMA_CHAT_MODEL || "llama3.2:3b",
  embedding: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
};

const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 4000);
const MAX_TOKENS = Number(process.env.OLLAMA_MAX_TOKENS || 900);
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 8192);

// ─── Timeout Helper ───────────────────────────────────────────────

function timeoutSignal(ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// ─── Core Ollama Chat ─────────────────────────────────────────────

export async function ollamaChat({ model, messages, format, temperature = 0.2 }) {
  const timer = timeoutSignal();

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timer.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format,
        options: {
          temperature,
          num_predict: MAX_TOKENS,
          num_ctx: NUM_CTX,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return data.message?.content || "";
  } finally {
    timer.clear();
  }
}

// ─── JSON Safe Parser ─────────────────────────────────────────────

export function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {}
    }
    return fallback;
  }
}

// ─── Embedding Generation ─────────────────────────────────────────

export async function generateEmbedding(text) {
  const timer = timeoutSignal();

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timer.signal,
      body: JSON.stringify({
        model: MODELS.embedding,
        prompt: text,
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return data.embedding || [];
  } finally {
    timer.clear();
  }
}

// ─── Cosine Similarity ────────────────────────────────────────────

export function cosineSimilarity(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Manager AI: Schema → Dashboard Plan ──────────────────────────

export async function generateDashboardFromSchema(schemaProfile) {
  const jsonSchema = {
    type: "object",
    properties: {
      domain: { type: "string" },
      dashboardTitle: { type: "string" },
      kpis: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            metric: { type: "string" },
            aggregation: { type: "string", enum: ["sum", "avg", "count", "min", "max"] },
            reason: { type: "string" },
          },
          required: ["title", "metric", "aggregation", "reason"],
        },
      },
      charts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["bar", "line", "area", "pie", "scatter", "histogram"] },
            xKey: { type: "string" },
            yKey: { type: "string" },
            aggregation: { type: "string", enum: ["sum", "avg", "count", "min", "max"] },
            reason: { type: "string" },
          },
          required: ["title", "type", "xKey", "yKey", "aggregation", "reason"],
        },
      },
      insights: {
        type: "array",
        items: { type: "string" },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["domain", "dashboardTitle", "kpis", "charts", "insights", "warnings"],
  };

  const messages = [
    {
      role: "system",
      content: `You are InsightFlow Manager AI. You create real data analytics dashboards from schema metadata only.

RULES:
- NEVER invent columns that don't exist in the schema
- Choose KPI and chart ONLY from available schema columns
- Detect the domain (sales, HR, finance, etc.) from column names
- Generate 4-6 KPIs and 5-7 charts
- Each chart must have a clear reason
- Return valid JSON only, no markdown`,
    },
    {
      role: "user",
      content: `Create a dashboard plan for this dataset schema:\n${JSON.stringify(schemaProfile, null, 2)}`,
    },
  ];

  const text = await ollamaChat({
    model: MODELS.manager,
    messages,
    format: jsonSchema,
    temperature: 0.1,
  });

  return safeJsonParse(text, {
    domain: "generic",
    dashboardTitle: "Auto Dashboard",
    kpis: [],
    charts: [],
    insights: [],
    warnings: ["AI response fallback used"],
  });
}

// ─── Dashboard AI: Handle Chart Commands ──────────────────────────

export async function handleDashboardCommand({ message, schemaProfile, currentDashboard }) {
  const jsonSchema = {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "add_chart",
          "remove_chart",
          "update_chart",
          "add_kpi",
          "remove_kpi",
          "filter",
          "explain",
          "general_answer",
        ],
      },
      answer: { type: "string" },
      action: {
        type: "object",
        properties: {
          targetTitle: { type: "string" },
          chart: {
            type: "object",
            properties: {
              title: { type: "string" },
              type: { type: "string" },
              xKey: { type: "string" },
              yKey: { type: "string" },
              aggregation: { type: "string" },
            },
          },
          kpi: {
            type: "object",
            properties: {
              title: { type: "string" },
              metric: { type: "string" },
              aggregation: { type: "string" },
            },
          },
          filter: { type: "object" },
        },
      },
      reason: { type: "string" },
    },
    required: ["intent", "answer", "action", "reason"],
  };

  const messages = [
    {
      role: "system",
      content: `You are InsightFlow Dashboard Chatbox AI. You manipulate dashboard charts and KPIs.

RULES:
- If user asks to add/remove/update chart, set intent accordingly
- If user asks data/dashboard question, answer using schema context
- If user asks general question (not about data), answer normally but briefly
- Only use column names that exist in the schema
- Return valid JSON only`,
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          userMessage: message,
          availableColumns: schemaProfile?.columns?.map(c => c.name) || [],
          currentCharts: currentDashboard?.charts?.map(c => c.title) || [],
          currentKpis: currentDashboard?.kpis?.map(k => k.title) || [],
        },
        null,
        2
      ),
    },
  ];

  const text = await ollamaChat({
    model: MODELS.dashboard,
    messages,
    format: jsonSchema,
    temperature: 0.2,
  });

  return safeJsonParse(text, {
    intent: "general_answer",
    answer: "I understood your request, but I could not safely create a dashboard action.",
    action: {},
    reason: "Fallback response",
  });
}

// ─── General Chat AI ──────────────────────────────────────────────

export async function generalChat({ message, schemaProfile }) {
  const cols = schemaProfile?.columns || [];
  const memories = retrieveLearningMemory({
    userQuestion: message,
    schemaColumns: cols.map((c) => c.name || c.normalizedName).filter(Boolean),
    domain: schemaProfile?.domain || "generic",
  });

  const messages = [
    {
      role: "system",
      content: `You are InsightFlow AI chatbot. You help users understand their data.

RULES:
- Answer data questions using the schema context provided
- If the question is not about data, answer normally and helpfully
- Be concise and helpful
- If you don't know, say so honestly

Use these learned corrections before answering:
${JSON.stringify(memories, null, 2)}

If a correction rule matches the user question, follow it.
Do not repeat previous mistakes.`,
    },
    {
      role: "user",
      content: `Schema context:\n${JSON.stringify(schemaProfile || {}, null, 2)}\n\nQuestion: ${message}`,
    },
  ];

  return await ollamaChat({
    model: MODELS.chat,
    messages,
    temperature: 0.3,
  });
}

// ─── Ollama Status ────────────────────────────────────────────────

export async function getOllamaManagerStatus() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);

    return {
      running: true,
      host: OLLAMA_HOST,
      models,
      configured: {
        manager: MODELS.manager,
        dashboard: MODELS.dashboard,
        chat: MODELS.chat,
        embedding: MODELS.embedding,
      },
      available: {
        manager: models.some((m) => m.startsWith(MODELS.manager)),
        dashboard: models.some((m) => m.startsWith(MODELS.dashboard)),
        chat: models.some((m) => m.startsWith(MODELS.chat)),
        embedding: models.some((m) => m.startsWith(MODELS.embedding)),
      },
    };
  } catch {
    return {
      running: false,
      host: OLLAMA_HOST,
      models: [],
      configured: MODELS,
      available: { manager: false, dashboard: false, chat: false, embedding: false },
    };
  }
}

export default {
  MODELS,
  ollamaChat,
  safeJsonParse,
  generateEmbedding,
  cosineSimilarity,
  generateDashboardFromSchema,
  handleDashboardCommand,
  generalChat,
  getOllamaManagerStatus,
};
