import fs from "node:fs";
import path from "node:path";
import { isQdrantEnabled, vectorDbConfig } from "../../config/vector-db.js";
import { embedText, cosineSimilarity } from "./schema-rag-embeddings.js";
import {
  searchSchemaRagVectorMemory,
  upsertSchemaRagVectorMemory,
  getSchemaRagVectorStats,
} from "./schema-rag-vector-store.js";

function resolveMemoryPath() {
  if (process.env.SCHEMA_RAG_MEMORY_PATH) {
    return path.resolve(process.env.SCHEMA_RAG_MEMORY_PATH);
  }

  const cwd = process.cwd();
  const monorepoPath = path.resolve(cwd, "apps", "backend", "data", "schema-rag-memory.json");
  const backendPath = path.resolve(cwd, "data", "schema-rag-memory.json");

  if (fs.existsSync(path.dirname(monorepoPath))) {
    return monorepoPath;
  }

  return backendPath;
}

const MEMORY_PATH = resolveMemoryPath();

function ensureDataFile() {
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });

  if (!fs.existsSync(MEMORY_PATH)) {
    fs.writeFileSync(MEMORY_PATH, "[]", "utf8");
  }
}

function stripForbiddenTopLevel(entry = {}) {
  const {
    rows,
    rawRows,
    sampleRows,
    datasetRows,
    fullRows,
    rowData,
    data,
    records,
    table,
    ...safe
  } = entry || {};

  return safe;
}

function stripUnsafeDashboardPlan(plan = {}) {
  return {
    kpis: Array.isArray(plan.kpis)
      ? plan.kpis.map((kpi) => {
          const { value, values, data, rows, rawRows, sampleRows, calculatedValues, ...safe } = kpi;
          return safe;
        })
      : [],
    charts: Array.isArray(plan.charts)
      ? plan.charts.map((chart) => {
          const { data, rows, rawRows, sampleRows, calculatedValues, value, values, ...safe } = chart;
          return safe;
        })
      : [],
  };
}

export function readSchemaRagMemory() {
  ensureDataFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed.map(stripForbiddenTopLevel) : [];
  } catch {
    return [];
  }
}

export function writeSchemaRagMemory(entries = []) {
  ensureDataFile();

  const safeEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...stripForbiddenTopLevel(entry),
    dashboardPlan: stripUnsafeDashboardPlan(entry.dashboardPlan || {}),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  }));

  fs.writeFileSync(MEMORY_PATH, JSON.stringify(safeEntries, null, 2), "utf8");

  return safeEntries;
}

export function upsertSchemaRagMemory(entry) {
  const memory = readSchemaRagMemory();
  const safeEntry = {
    ...stripForbiddenTopLevel(entry),
    dashboardPlan: stripUnsafeDashboardPlan(entry.dashboardPlan || {}),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = memory.findIndex(
    (item) =>
      item.id === safeEntry.id ||
      (item.schemaSignature &&
        item.schemaSignature === safeEntry.schemaSignature &&
        item.domain === safeEntry.domain)
  );

  if (existingIndex >= 0) {
    const previous = memory[existingIndex];

    memory[existingIndex] = {
      ...previous,
      ...safeEntry,
      createdAt: previous.createdAt || safeEntry.createdAt || new Date().toISOString(),
      examplesSeen: Number(previous.examplesSeen || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
  } else {
    memory.push({
      ...safeEntry,
      createdAt: safeEntry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  writeSchemaRagMemory(memory);

  return existingIndex >= 0 ? memory[existingIndex] : memory[memory.length - 1];
}

export function getSchemaRagStats() {
  const memory = readSchemaRagMemory();

  const domains = memory.reduce((acc, item) => {
    const domain = item.domain || "unknown";
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {});

  return {
    memoryPath: MEMORY_PATH,
    total: memory.length,
    domains,
    withEmbeddings: memory.filter((item) => Array.isArray(item.embedding) && item.embedding.length).length,
    updatedAt: new Date().toISOString(),
  };
}

export function clearSchemaRagMemoryForTests() {
  if (process.env.NODE_ENV !== "test" && process.env.ALLOW_RAG_CLEAR !== "1") {
    throw new Error("clearSchemaRagMemoryForTests is only allowed in test mode.");
  }

  writeSchemaRagMemory([]);
}

function tokenize(text = "") {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccardTextSimilarity(left = "", right = "") {
  const a = tokenize(left);
  const b = tokenize(right);

  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function normalizeCosine(value) {
  return Math.max(0, Math.min(1, (Number(value || 0) + 1) / 2));
}

function hasUsableDashboardPlan(entry = {}) {
  const plan = entry.dashboardPlan || {};
  return Array.isArray(plan.kpis) || Array.isArray(plan.charts);
}

function buildJsonFallbackStats(error) {
  return {
    mode: "json",
    stats: getSchemaRagStats(),
    provider: "json",
    fallback: true,
    vectorError: error?.message,
  };
}

async function retrieveSchemaRagMemoryJson(queryEntry = {}, options = {}) {
  const limit = Number(options.limit || 5);
  const threshold = Number(options.minScore ?? options.threshold ?? 0.55);
  const queryText = queryEntry.memoryText || queryEntry.schemaText || "";
  const embeddingResult = await embedText(queryText, {
    useOllama: options.useOllama,
    allowFallback: true,
  });

  const matches = readSchemaRagMemory()
    .filter(hasUsableDashboardPlan)
    .map((entry) => {
      const vectorScore = Array.isArray(entry.embedding) && entry.embedding.length
        ? normalizeCosine(cosineSimilarity(embeddingResult.embedding, entry.embedding))
        : 0;
      const textScore = jaccardTextSimilarity(queryText, entry.schemaText || entry.memoryText || "");
      const domainBoost = entry.domain && entry.domain === queryEntry.domain ? 0.08 : 0;
      const signatureBoost =
        entry.schemaSignature && entry.schemaSignature === queryEntry.schemaSignature ? 0.12 : 0;
      const score = Math.min(1, Math.max(vectorScore, textScore) + domainBoost + signatureBoost);

      return {
        entry,
        score,
        vectorScore,
        textScore,
        domainBoost,
        signatureBoost,
      };
    })
    .filter((match) => match.score >= threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return {
    used: matches.length > 0,
    threshold,
    query: {
      domain: queryEntry.domain,
      signature: queryEntry.schemaSignature,
      embeddingProvider: embeddingResult.provider,
      embeddingModel: embeddingResult.model,
      embeddingFallback: embeddingResult.fallback,
      embeddingError: embeddingResult.error,
    },
    matches,
    mode: "json",
  };
}

export async function upsertSchemaRagMemorySmart(entry) {
  if (isQdrantEnabled()) {
    try {
      return await upsertSchemaRagVectorMemory(entry);
    } catch (error) {
      if (!vectorDbConfig.fallbackJson) throw error;
      const saved = upsertSchemaRagMemory(entry);
      return {
        ...saved,
        provider: "json",
        fallback: true,
        vectorError: error.message,
      };
    }
  }

  return upsertSchemaRagMemory(entry);
}

export async function retrieveSchemaRagMemorySmart(queryEntry, options = {}) {
  if (isQdrantEnabled()) {
    try {
      return await searchSchemaRagVectorMemory(queryEntry, {
        ...options,
        minScore: options.minScore ?? options.threshold ?? 0.55,
      });
    } catch (error) {
      if (!vectorDbConfig.fallbackJson) throw error;
      const result = await retrieveSchemaRagMemoryJson(queryEntry, options);
      return {
        ...result,
        fallback: true,
        vectorError: error.message,
      };
    }
  }

  return retrieveSchemaRagMemoryJson(queryEntry, options);
}

export async function getSchemaRagStatsSmart() {
  if (isQdrantEnabled()) {
    try {
      return await getSchemaRagVectorStats();
    } catch (error) {
      if (!vectorDbConfig.fallbackJson) throw error;
      return buildJsonFallbackStats(error);
    }
  }

  return {
    mode: "json",
    stats: getSchemaRagStats(),
  };
}
