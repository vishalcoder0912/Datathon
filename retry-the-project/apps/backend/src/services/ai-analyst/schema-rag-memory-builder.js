import { createHash } from "node:crypto";
import { buildSchemaProfile } from "./schema-fingerprint.js";
import { templatePlanForStorage } from "./dashboard-plan-engine.js";

function hashText(text = "") {
  return createHash("sha1").update(String(text)).digest("hex").slice(0, 12);
}

function safeTopValues(values = []) {
  if (!Array.isArray(values)) return [];

  return values.slice(0, 10).map((item) => {
    if (item && typeof item === "object") {
      return {
        value: item.value ?? item.label ?? item.name ?? String(item),
        count: Number.isFinite(Number(item.count)) ? Number(item.count) : undefined,
      };
    }

    return { value: item };
  });
}

function memoryColumns(profile) {
  return (profile.columns || []).map((column) => ({
    name: column.name,
    normalizedName: column.normalizedName,
    title: column.title,
    type: column.type,
    role: column.role,
    description: column.description || "",
    missingPct: column.missingPct ?? 0,
    uniqueCount: column.uniqueCount ?? 0,
    topValuesCount: safeTopValues(column.topValues).length,
    hasStats: Boolean(column.stats),
  }));
}

function stripUnsafeKpi(kpi = {}) {
  const {
    value,
    values,
    data,
    rows,
    rawRows,
    sampleRows,
    calculatedValues,
    chartData,
    ...safe
  } = kpi || {};

  return safe;
}

function stripUnsafeChart(chart = {}) {
  const {
    data,
    rows,
    rawRows,
    sampleRows,
    calculatedValues,
    value,
    values,
    chartData,
    ...safe
  } = chart || {};

  return safe;
}

export function sanitizeDashboardPlanForRag(dashboardPlan = {}, profile) {
  const plan =
    dashboardPlan.dashboard ||
    dashboardPlan.dashboardPlan ||
    dashboardPlan.safePlan ||
    dashboardPlan;

  const templated = templatePlanForStorage(
    {
      kpis: Array.isArray(plan.kpis) ? plan.kpis.map(stripUnsafeKpi) : [],
      charts: Array.isArray(plan.charts) ? plan.charts.map(stripUnsafeChart) : [],
    },
    profile
  );

  return {
    kpis: templated.kpis || [],
    charts: templated.charts || [],
  };
}

export function schemaProfileToRagText(profile = {}) {
  const columns = (profile.columns || [])
    .map((column) => {
      return [
        column.name,
        column.type,
        column.role,
        column.description,
        `unique:${column.uniqueCount ?? 0}`,
        `missing:${column.missingPct ?? 0}`,
        `topValuesCount:${safeTopValues(column.topValues).length}`,
        column.stats ? "hasStats:true" : "",
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join("\n");

  return [
    `Domain: ${profile.domain || "unknown"}`,
    `Signature: ${profile.signature || ""}`,
    `Rows: ${profile.rowCount || 0}`,
    `Columns: ${profile.columnCount || profile.columns?.length || 0}`,
    "Schema:",
    columns,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSchemaRagMemoryEntry({
  dataset,
  schemaProfile,
  dashboardPlan,
  embedding = [],
  rating = "good",
  notes = "",
  source = "user-feedback",
} = {}) {
  const profile = schemaProfile || buildSchemaProfile(dataset || {});
  const schemaText = schemaProfileToRagText(profile);
  const safePlan = sanitizeDashboardPlanForRag(dashboardPlan || {}, profile);

  const id =
    dataset?.id ||
    `rag-${profile.domain || "dataset"}-${profile.signature || hashText(schemaText)}-${hashText(
      JSON.stringify(safePlan)
    )}`;

  return {
    id,
    name: dataset?.name || dataset?.fileName || profile.datasetName || id,
    domain: profile.domain || "unknown",
    source,
    rating,
    notes,
    schemaSignature: profile.signature || hashText(schemaText),
    schemaText,
    schemaProfile: {
      datasetName: profile.datasetName,
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      domain: profile.domain,
      signature: profile.signature,
      columns: memoryColumns(profile),
    },
    columns: memoryColumns(profile),
    dashboardPlan: safePlan,
    embedding: Array.isArray(embedding) ? embedding : [],
    examplesSeen: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function removeEmbeddingsForPublicResponse(entry = {}) {
  const { embedding, ...safe } = entry || {};
  return safe;
}
