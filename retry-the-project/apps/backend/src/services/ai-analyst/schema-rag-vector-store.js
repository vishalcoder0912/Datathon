import { createHash } from "node:crypto";
import { vectorDbConfig } from "../../config/vector-db.js";
import { embedSchemaMemoryText } from "../vector/embedding-client.js";
import {
  ensureQdrantCollection,
  getQdrantClient,
  getQdrantCollectionInfo,
} from "../vector/qdrant-client.js";

function hashId(value = "") {
  return createHash("sha1").update(String(value)).digest("hex");
}

function deterministicUuid(value = "") {
  const hash = hashId(value).padEnd(32, "0").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(
    17,
    20
  )}-${hash.slice(20, 32)}`;
}

function pointIdForEntry(entry = {}) {
  return deterministicUuid(entry.id || `${entry.domain || "unknown"}:${entry.schemaSignature || ""}`);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeColumns(columns = []) {
  return safeArray(columns).map((column) => {
    if (typeof column === "string") return { name: column };

    return {
      name: column.name,
      normalizedName: column.normalizedName,
      title: column.title,
      type: column.type,
      role: column.role,
      description: column.description || "",
      missingPct: column.missingPct ?? 0,
      uniqueCount: column.uniqueCount ?? 0,
      topValuesCount: Number(column.topValuesCount || 0),
      hasStats: Boolean(column.hasStats),
    };
  });
}

function stripUnsafeDashboardPlan(plan = {}) {
  return {
    kpis: safeArray(plan.kpis).map((kpi) => {
      const { value, values, data, rows, rawRows, sampleRows, calculatedValues, chartData, ...safe } = kpi || {};
      return safe;
    }),
    charts: safeArray(plan.charts).map((chart) => {
      const { value, values, data, rows, rawRows, sampleRows, calculatedValues, chartData, ...safe } = chart || {};
      return safe;
    }),
  };
}

function kpiPatterns(plan = {}) {
  return safeArray(plan.kpis).map((kpi) => ({
    title: kpi.title,
    metric: kpi.metric,
    aggregation: kpi.aggregation,
    format: kpi.format,
  }));
}

function chartPatterns(plan = {}) {
  return safeArray(plan.charts).map((chart) => ({
    title: chart.title,
    type: chart.type,
    xKey: chart.xKey,
    yKey: chart.yKey,
    aggregation: chart.aggregation,
  }));
}

export function buildMemoryText(entry = {}) {
  if (entry.memoryText) return String(entry.memoryText);
  if (entry.schemaText) return String(entry.schemaText);

  const columns = safeArray(entry.columns || entry.schemaProfile?.columns)
    .map((column) => {
      if (typeof column === "string") return column;
      return [
        column.name,
        column.normalizedName,
        column.type,
        column.role,
        column.description,
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join("\n");

  const plan = entry.dashboardPlan || {};
  const kpis = safeArray(plan.kpis)
    .map((kpi) => [kpi.title, kpi.metric, kpi.aggregation].filter(Boolean).join(" "))
    .join("\n");
  const charts = safeArray(plan.charts)
    .map((chart) =>
      [chart.title, chart.type, chart.xKey, chart.yKey, chart.aggregation].filter(Boolean).join(" ")
    )
    .join("\n");

  return [
    `Domain: ${entry.domain || entry.schemaProfile?.domain || "unknown"}`,
    `Dataset: ${entry.datasetName || entry.name || entry.schemaProfile?.datasetName || ""}`,
    `Signature: ${entry.schemaSignature || entry.schemaProfile?.signature || ""}`,
    "Schema:",
    columns,
    "Dashboard KPIs:",
    kpis,
    "Dashboard Charts:",
    charts,
  ]
    .filter(Boolean)
    .join("\n");
}

function payloadForEntry(entry = {}, embeddingMeta = {}) {
  const now = new Date().toISOString();
  const memoryText = buildMemoryText(entry);
  const safePlan = stripUnsafeDashboardPlan(entry.dashboardPlan || {});

  return {
    id: entry.id || pointIdForEntry(entry),
    type: "schema_memory",
    domain: entry.domain || entry.schemaProfile?.domain || "unknown",
    datasetName: entry.datasetName || entry.name || entry.schemaProfile?.datasetName || "",
    schemaSignature: entry.schemaSignature || entry.schemaProfile?.signature || "",
    columns: safeColumns(entry.columns || entry.schemaProfile?.columns),
    dashboardPlan: safePlan,
    kpiPatterns: kpiPatterns(safePlan),
    chartPatterns: chartPatterns(safePlan),
    memoryText,
    embeddingModel: embeddingMeta.model || vectorDbConfig.embedding.model,
    examplesSeen: Number(entry.examplesSeen || 1),
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };
}

function toMatch(result = {}) {
  const payload = result.payload || {};
  return {
    entry: {
      ...payload,
      name: payload.datasetName || payload.id,
      schemaText: payload.memoryText,
    },
    score: Number(result.score || 0),
    vectorScore: Number(result.score || 0),
    textScore: 0,
    domainBoost: 0,
    signatureBoost: 0,
  };
}

export async function upsertSchemaRagVectorMemory(entry = {}) {
  const memoryText = buildMemoryText(entry);
  const embeddingResult = await embedSchemaMemoryText(memoryText, {
    allowFallback: false,
  });
  const collection = vectorDbConfig.qdrant.schemaCollection;

  await ensureQdrantCollection(collection, embeddingResult.dimension);

  const payload = payloadForEntry(entry, embeddingResult);
  const pointId = pointIdForEntry(payload);

  await getQdrantClient().upsert(collection, {
    wait: true,
    points: [
      {
        id: pointId,
        vector: embeddingResult.embedding,
        payload,
      },
    ],
  });

  return {
    ...payload,
    pointId,
    provider: "qdrant",
    collection,
  };
}

export async function searchSchemaRagVectorMemory(queryEntry = {}, options = {}) {
  const limit = Number(options.limit || 5);
  const minScore = Number(options.minScore ?? options.threshold ?? 0.55);
  const memoryText = buildMemoryText(queryEntry);
  const embeddingResult = await embedSchemaMemoryText(memoryText, {
    allowFallback: false,
  });
  const collection = vectorDbConfig.qdrant.schemaCollection;

  await ensureQdrantCollection(collection, embeddingResult.dimension);

  const results = await getQdrantClient().search(collection, {
    vector: embeddingResult.embedding,
    limit,
    with_payload: true,
    score_threshold: minScore,
  });

  return {
    used: results.length > 0,
    threshold: minScore,
    query: {
      domain: queryEntry.domain || queryEntry.schemaProfile?.domain,
      signature: queryEntry.schemaSignature || queryEntry.schemaProfile?.signature,
      embeddingProvider: embeddingResult.provider,
      embeddingModel: embeddingResult.model,
      embeddingFallback: embeddingResult.fallback,
      embeddingError: embeddingResult.error,
    },
    matches: results.map(toMatch),
    mode: "qdrant",
  };
}

export async function getSchemaRagVectorStats() {
  const collection = vectorDbConfig.qdrant.schemaCollection;
  const info = await getQdrantCollectionInfo(collection);

  return {
    mode: "qdrant",
    stats: {
      provider: vectorDbConfig.provider,
      collection,
      vectorsCount: info.vectors_count ?? info.vectorsCount ?? 0,
      pointsCount: info.points_count ?? info.pointsCount ?? 0,
      embeddingModel: vectorDbConfig.embedding.model,
      updatedAt: new Date().toISOString(),
    },
  };
}

export default {
  buildMemoryText,
  upsertSchemaRagVectorMemory,
  searchSchemaRagVectorMemory,
  getSchemaRagVectorStats,
};
