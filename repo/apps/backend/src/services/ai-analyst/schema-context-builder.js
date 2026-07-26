import { createWriteStream } from "node:fs";
import { buildSchemaProfile, humanize, safeNumber, isDateLike } from "./schema-fingerprint.js";

const ROLE_KEYWORDS = {
  metric: ["salary", "price", "cost", "revenue", "amount", "count", "score", "rate", "age", "experience", "years", "value", "number", "percentage", "ratio", "balance", "profit", "loss", "income", "expense", "budget", "quantity", "size", "weight", "height", "distance", "duration", "volume", "area", "temperature", "gpa", "marks", "grade"],
  dimension: ["name", "category", "type", "group", "class", "label", "status", "gender", "country", "city", "state", "region", "department", "team", "role", "level", "rank", "color", "brand", "product", "segment", "industry", "sector", "education", "degree", "language", "framework", "platform", "os", "browser", "device", "channel", "source", "medium", "campaign"],
  date: ["date", "year", "month", "day", "quarter", "week", "timestamp", "time", "created_at", "updated_at", "birth_date", "start_date", "end_date", "deadline"],
  location: ["country", "city", "state", "region", "address", "zip", "postal", "latitude", "longitude", "coordinates", "location", "place", "area", "zone", "district", "province"],
  id: ["id", "code", "key", "uuid", "hash", "token", "identifier", "reference"],
};

function inferRole(name, type, sampleValues = []) {
  const lower = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const numCount = sampleValues.filter((v) => safeNumber(v) !== null).length;
  const dateCount = sampleValues.filter(isDateLike).length;

  if (dateCount / Math.max(sampleValues.length, 1) > 0.5) return "date";
  if (ROLE_KEYWORDS.id.some((k) => lower.includes(k) || lower === k)) return "id";
  if (ROLE_KEYWORDS.location.some((k) => lower.includes(k) || lower === k)) return "location";
  if (ROLE_KEYWORDS.date.some((k) => lower.includes(k) || lower === k)) return "date";
  if (ROLE_KEYWORDS.metric.some((k) => lower.includes(k) || lower === k)) return "metric";
  if (type === "number" || numCount / Math.max(sampleValues.length, 1) > 0.6) return "metric";
  if (ROLE_KEYWORDS.dimension.some((k) => lower.includes(k) || lower === k)) return "dimension";

  if (type === "string" || numCount / Math.max(sampleValues.length, 1) < 0.3) return "dimension";
  return "dimension";
}

function buildColumnContext(column, profile) {
  const name = column.name || column.column || "";
  const rawType = column.type || column.inferredType || "string";
  const sampleValues = column.sampleValues || [];
  const role = column.role || inferRole(name, rawType, sampleValues);
  const uniqueValues = column.uniqueValues ?? sampleValues.length;
  const numericSummary = profile?.numericSummary?.[name] || {};

  return {
    name,
    displayName: humanize(name),
    type: rawType,
    role,
    uniqueValues,
    sampleValues: sampleValues.slice(0, 10),
    missingCount: column.missingCount || 0,
    stats: role === "metric" ? {
      min: numericSummary.min,
      max: numericSummary.max,
      avg: numericSummary.avg,
      median: numericSummary.median,
      sum: numericSummary.sum,
    } : undefined,
  };
}

export function buildSchemaContext(dataset) {
  const profile = buildSchemaProfile(dataset);
  if (!profile?.columns?.length) return null;

  const columns = profile.columns;
  const columnContexts = columns.map((col) => buildColumnContext(col, profile));

  const metrics = columnContexts.filter((c) => c.role === "metric" || c.role === "date");
  const dimensions = columnContexts.filter((c) => c.role === "dimension" || c.role === "location");
  const ids = columnContexts.filter((c) => c.role === "id");

  return {
    dataset: {
      id: dataset.id || profile.datasetId,
      name: dataset.name || profile.datasetName || "Unknown",
      rowCount: profile.rowCount || 0,
    },
    columns: columnContexts,
    metrics: metrics.slice(0, 20),
    dimensions: dimensions.filter((d) => !ids.some((id) => id.name === d.name)).slice(0, 30),
    ids: ids.slice(0, 10),
    aiInstructions: [
      "METRICS: Use on Y-axis, for KPIs, aggregations (sum, avg, count, min, max)",
      "DIMENSIONS: Use on X-axis, for grouping, filtering, segmentation",
      "DATES: Use for time-based trends, filtering by date range",
      "LOCATIONS: Use for geographic maps, regional analysis",
      "NEVER use ID-type columns in chart axes or aggregations",
      "PREFER bar charts for categorical comparisons, line for trends, pie for proportions",
      "USE count aggregation when no specific metric is requested for a dimension",
    ],
    trainingData: {
      schemaSize: columns.length,
      metricCount: metrics.length,
      dimensionCount: dimensions.length,
      dateColumns: columnContexts.filter((c) => c.role === "date").map((c) => c.name),
      locationColumns: columnContexts.filter((c) => c.role === "location").map((c) => c.name),
    },
  };
}

export function buildRagDocuments(schemaContext) {
  if (!schemaContext?.columns) return [];

  const documents = [];

  for (const col of schemaContext.columns) {
    const doc = {
      id: `col_${col.name}`,
      text: [
        `Column: ${col.displayName} (${col.name})`,
        `Type: ${col.type}`,
        `Role: ${col.role}`,
        col.uniqueValues != null ? "Unique values: " + col.uniqueValues : "",
        col.sampleValues?.length ? `Sample values: ${col.sampleValues.slice(0, 5).join(", ")}` : "",
        col.stats ? `Stats: min=${col.stats.min}, max=${col.stats.max}, avg=${col.stats.avg}` : "",
      ].filter(Boolean).join(". "),
      metadata: {
        columnName: col.name,
        role: col.role,
        type: col.type,
        uniqueValues: col.uniqueValues,
      },
    };
    documents.push(doc);
  }

  if (schemaContext.aiInstructions?.length) {
    documents.push({
      id: "ai_instructions",
      text: schemaContext.aiInstructions.join(". "),
      metadata: { type: "instructions" },
    });
  }

  documents.push({
    id: "schema_summary",
    text: `Dataset "${schemaContext.dataset.name}" has ${schemaContext.columns.length} columns: ${schemaContext.metrics.length} metrics, ${schemaContext.dimensions.length} dimensions, ${schemaContext.columns.filter((c) => c.role === "date").length} date columns.`,
    metadata: { type: "summary" },
  });

  return documents;
}

export function buildTrainingExample(schemaContext, kpis, charts) {
  return {
    schema_context: {
      datasetName: schemaContext.dataset.name,
      rowCount: schemaContext.dataset.rowCount,
      columns: schemaContext.columns.map((c) => ({
        name: c.name,
        type: c.type,
        role: c.role,
        uniqueValues: c.uniqueValues,
        stats: c.stats,
      })),
      metrics: schemaContext.metrics.map((m) => m.name),
      dimensions: schemaContext.dimensions.map((d) => d.name),
      dateColumns: schemaContext.columns.filter((c) => c.role === "date").map((c) => c.name),
    },
    expected_kpis: (kpis || []).map((kpi) => ({
      label: kpi.label || kpi.title || "KPI",
      value: kpi.value ?? 0,
      metric: kpi.metric || kpi.measure || "",
      aggregation: kpi.aggregation || kpi.agg || "sum",
    })),
    expected_charts: (charts || []).map((chart) => ({
      type: chart.type || "bar",
      title: chart.title || "",
      xKey: chart.xKey || chart.x || chart.dimension || "",
      yKey: chart.yKey || chart.y || chart.metric || "",
      aggregation: chart.aggregation || chart.agg || "sum",
    })),
  };
}

export async function exportTrainingJsonl(schemaContexts, outputPath) {
  const stream = createWriteStream(outputPath, { flags: "a" });

  for (const ctx of schemaContexts) {
    const example = buildTrainingExample(ctx, [], []);
    stream.write(JSON.stringify(example) + "\n");
  }

  stream.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

export default {
  buildSchemaContext,
  buildRagDocuments,
  buildTrainingExample,
  exportTrainingJsonl,
};
