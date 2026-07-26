import { buildSchemaProfile, humanize, normalizeColumnName, safeNumber } from "../ai-analyst/schema-fingerprint.js";

export const METRIC_ROLES = new Set(["money_metric", "score_metric", "continuous_metric", "count_metric", "rate_metric"]);
export const DIMENSION_ROLES = new Set(["location", "category", "target", "numeric_category"]);

export function buildChatSchema(dataset = {}) {
  const profile = buildSchemaProfile(dataset);
  return {
    datasetId: dataset.id || dataset.datasetId || "dataset",
    datasetName: profile.datasetName,
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    columns: profile.columns.map((column) => ({
      name: column.name,
      normalizedName: column.normalizedName,
      title: column.title,
      type: column.type,
      role: column.role,
      stats: column.stats,
      topValues: column.topValues || [],
    })),
  };
}

export function schemaForAi(schema = {}) {
  return {
    datasetId: schema.datasetId,
    datasetName: schema.datasetName,
    rowCount: schema.rowCount,
    columns: (schema.columns || []).map((column) => ({
      name: column.name,
      type: column.type,
      role: METRIC_ROLES.has(column.role) ? "metric" : DIMENSION_ROLES.has(column.role) ? "dimension" : column.role,
      semanticType: column.role === "location" ? "geo" : column.role === "money_metric" ? "currency" : undefined,
    })),
  };
}

export function findColumn(schema, text, roles = []) {
  const normalized = normalizeColumnName(text);
  const tokens = new Set(normalized.split("_").filter(Boolean));
  const candidates = schema.columns || [];
  const scored = candidates.map((column) => {
    const name = column.normalizedName || normalizeColumnName(column.name);
    const nameTokens = name.split("_").filter(Boolean);
    let score = 0;
    if (normalized === name) score += 100;
    if (tokens.has(name)) score += 80;
    if (nameTokens.length && nameTokens.every((token) => tokens.has(token))) score += 60;
    if (nameTokens.some((token) => tokens.has(token))) score += 20;
    if (roles.length) score += roles.includes(column.role) ? 150 : -120;
    return { column, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored[0]?.column || null;
}

export function primaryMetric(schema) {
  const cols = schema.columns || [];
  return cols.find((column) => column.role === "money_metric") ||
    cols.find((column) => METRIC_ROLES.has(column.role)) ||
    cols.find((column) => column.type === "number");
}

export function primaryDimension(schema) {
  const cols = schema.columns || [];
  return cols.find((column) => /country|region|state|city/i.test(column.name) && DIMENSION_ROLES.has(column.role)) ||
    cols.find((column) => DIMENSION_ROLES.has(column.role));
}

export function metricColumn(schema, text) {
  return findColumn(schema, text, [...METRIC_ROLES]) || primaryMetric(schema);
}

export function dimensionColumn(schema, text) {
  return findColumn(schema, text, [...DIMENSION_ROLES]) || primaryDimension(schema);
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const VALUE_ALIASES = new Map([
  ["usa", ["usa", "us", "united states", "united states of america", "america"]],
  ["uk", ["uk", "u k", "united kingdom", "great britain", "britain", "england"]],
]);

export function findDimensionValue(schema, query, preferredColumn) {
  const text = normalizeValue(query);
  const columns = preferredColumn
    ? [preferredColumn]
    : (schema.columns || []).filter((column) => DIMENSION_ROLES.has(column.role));

  for (const column of columns) {
    for (const item of column.topValues || []) {
      const value = String(item.value);
      const normalized = normalizeValue(value);
      const aliases = new Set([normalized, normalized.replace(/\s+/g, "")]);
      for (const alias of VALUE_ALIASES.get(normalized) || []) {
        aliases.add(normalizeValue(alias));
        aliases.add(normalizeValue(alias).replace(/\s+/g, ""));
      }
      if ([...aliases].some((alias) => alias && new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(text))) {
        return { column, value };
      }
    }
  }
  return null;
}

export function aggregationLabel(aggregation = "avg") {
  if (aggregation === "avg") return "Average";
  if (aggregation === "sum") return "Total";
  if (aggregation === "median") return "Median";
  if (aggregation === "max") return "Max";
  if (aggregation === "min") return "Min";
  return "Count";
}

export function formatValue(value, metric) {
  const number = safeNumber(value);
  if (number === null) return String(value ?? "");
  if (metric?.role === "money_metric") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number);
  }
  return Number.isInteger(number) ? number.toLocaleString() : number.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function titleForColumn(columnOrName) {
  return columnOrName?.title || humanize(columnOrName?.name || columnOrName || "");
}
