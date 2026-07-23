/**
 * Schema RAG Memory Service
 * Stores schema profiles, dashboard plans, and user feedback as embeddings
 * Retrieves similar examples to improve AI responses
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { generateEmbedding, cosineSimilarity } from "./ollama-manager-service.js";

const MEMORY_DIR = process.env.SCHEMA_MEMORY_DIR || "./data/schema-memory";
const MEMORY_FILE = join(MEMORY_DIR, "rag-memory.json");
const MAX_MEMORY_ENTRIES = Number(process.env.RAG_MAX_ENTRIES || 500);

// ─── Memory Store ─────────────────────────────────────────────────

let memoryStore = [];

export async function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) {
      const raw = await readFile(MEMORY_FILE, "utf-8");
      memoryStore = JSON.parse(raw);
      console.log(`[rag-memory] Loaded ${memoryStore.length} memory entries`);
    }
  } catch (error) {
    console.warn("[rag-memory] Failed to load memory:", error.message);
    memoryStore = [];
  }
}

export async function saveMemory() {
  try {
    if (!existsSync(MEMORY_DIR)) {
      await mkdir(MEMORY_DIR, { recursive: true });
    }
    await writeFile(MEMORY_FILE, JSON.stringify(memoryStore, null, 2));
  } catch (error) {
    console.warn("[rag-memory] Failed to save memory:", error.message);
  }
}

// ─── Store Schema + Dashboard Plan ────────────────────────────────

export async function storeSchemaMemory({ schemaProfile, dashboardPlan, domain, feedback }) {
  const embeddingText = buildEmbeddingText(schemaProfile, dashboardPlan, domain);
  const embedding = await generateEmbedding(embeddingText);

  const entry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    domain: domain || detectDomain(schemaProfile),
    schemaProfile: sanitizeSchemaForStorage(schemaProfile),
    dashboardPlan: sanitizePlanForStorage(dashboardPlan),
    feedback: feedback || null,
    embedding,
    embeddingText,
  };

  memoryStore.push(entry);

  // Trim old entries if over limit
  if (memoryStore.length > MAX_MEMORY_ENTRIES) {
    memoryStore = memoryStore.slice(-MAX_MEMORY_ENTRIES);
  }

  await saveMemory();
  return entry;
}

// ─── Retrieve Similar Schema Memories ─────────────────────────────

export async function findSimilarSchemaMemories(schemaProfile, topK = 3) {
  if (memoryStore.length === 0) return [];

  const queryText = buildEmbeddingText(schemaProfile, null, null);
  const queryEmbedding = await generateEmbedding(queryText);

  const scored = memoryStore.map((entry) => ({
    ...entry,
    similarity: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter((entry) => entry.similarity > 0.6);
}

// ─── Store User Feedback ──────────────────────────────────────────

export async function storeFeedback({ memoryId, feedbackType, details }) {
  const entry = memoryStore.find((e) => e.id === memoryId);
  if (!entry) return null;

  entry.feedback = {
    type: feedbackType, // "good", "bad", "adjusted"
    details,
    timestamp: new Date().toISOString(),
  };

  await saveMemory();
  return entry;
}

// ─── Get Domain Statistics ────────────────────────────────────────

export function getDomainStats() {
  const domains = {};
  for (const entry of memoryStore) {
    const domain = entry.domain || "unknown";
    if (!domains[domain]) {
      domains[domain] = { count: 0, avgSimilarity: 0, feedbackCounts: { good: 0, bad: 0 } };
    }
    domains[domain].count++;
    if (entry.feedback?.type === "good") domains[domain].feedbackCounts.good++;
    if (entry.feedback?.type === "bad") domains[domain].feedbackCounts.bad++;
  }
  return domains;
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildEmbeddingText(schemaProfile, dashboardPlan, domain) {
  const parts = [];

  if (domain) parts.push(`Domain: ${domain}`);
  if (schemaProfile?.columns) {
    parts.push(`Columns: ${schemaProfile.columns.map((c) => `${c.name}(${c.role || c.type})`).join(", ")}`);
  }
  if (schemaProfile?.measures) parts.push(`Measures: ${schemaProfile.measures.join(", ")}`);
  if (schemaProfile?.dimensions) parts.push(`Dimensions: ${schemaProfile.dimensions.join(", ")}`);
  if (dashboardPlan?.charts) {
    parts.push(`Charts: ${dashboardPlan.charts.map((c) => `${c.type}:${c.title}`).join(", ")}`);
  }
  if (dashboardPlan?.kpis) {
    parts.push(`KPIs: ${dashboardPlan.kpis.map((k) => k.title).join(", ")}`);
  }

  return parts.join(" | ");
}

function detectDomain(schemaProfile) {
  const columnNames = (schemaProfile?.columns || []).map((c) => c.name?.toLowerCase() || "").join(" ");

  if (/salary|employee|department|hire|HR/i.test(columnNames)) return "hr";
  if (/revenue|sales|profit|customer|order/i.test(columnNames)) return "sales";
  if (/price|product|inventory|stock|quantity/i.test(columnNames)) return "retail";
  if (/temperature|humidity|weather|wind/i.test(columnNames)) return "weather";
  if (/score|rating|review|feedback/i.test(columnNames)) return "feedback";

  return "generic";
}

function sanitizeSchemaForStorage(schema) {
  if (!schema) return null;
  return {
    datasetName: schema.datasetName,
    rowCount: schema.rowCount,
    columnCount: schema.columnCount,
    columns: (schema.columns || []).map((c) => ({
      name: c.name,
      type: c.type,
      role: c.role,
    })),
    measures: schema.measures || [],
    dimensions: schema.dimensions || [],
    targets: schema.targets || [],
  };
}

function sanitizePlanForStorage(plan) {
  if (!plan) return null;
  return {
    domain: plan.domain,
    dashboardTitle: plan.dashboardTitle,
    kpis: (plan.kpis || []).map((k) => ({
      title: k.title,
      metric: k.metric,
      aggregation: k.aggregation,
    })),
    charts: (plan.charts || []).map((c) => ({
      title: c.title,
      type: c.type,
      xKey: c.xKey,
      yKey: c.yKey,
      aggregation: c.aggregation,
    })),
  };
}

// ─── Initialize on Import ─────────────────────────────────────────

loadMemory().catch(() => {});

export default {
  storeSchemaMemory,
  findSimilarSchemaMemories,
  storeFeedback,
  getDomainStats,
  loadMemory,
  saveMemory,
};
