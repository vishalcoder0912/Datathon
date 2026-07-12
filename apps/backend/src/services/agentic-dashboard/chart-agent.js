import crypto from "node:crypto";

function roleOf(column = {}) {
  return column.semanticRole || column.role;
}

function isNumber(column = {}) {
  return ["number", "integer", "float", "decimal", "currency"].includes(column.type) ||
    ["money_metric", "continuous_metric", "count_metric", "score_metric", "rate_metric"].includes(roleOf(column)) ||
    String(roleOf(column) || "").includes("metric");
}

function isDate(column = {}) {
  return column.type === "date" || roleOf(column) === "date_dimension" || /date|time|month|year|created|updated/i.test(column.name);
}

function isCategory(column = {}) {
  return ["category", "string", "text"].includes(column.type) ||
    ["category_dimension", "dimension", "target", "numeric_category"].includes(roleOf(column));
}

function isGeo(column = {}) {
  return ["geo_country", "geo_state", "geo_city", "geo_region", "geo_latitude", "geo_longitude", "location"].includes(roleOf(column));
}

function chart(type, title, xKey, yKey, aggregation, intent, confidence = 0.85) {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    xKey,
    yKey,
    aggregation,
    intent,
    confidence,
  };
}

export function runChartAgent({ schemaProfile, semanticProfile }) {
  const cols = semanticProfile?.columns || schemaProfile.columns || [];
  const metrics = cols.filter(isNumber);
  const categories = cols.filter(isCategory);
  const dates = cols.filter(isDate);
  const geo = cols.filter(isGeo);

  const charts = [];

  if (dates[0] && metrics[0]) {
    charts.push(chart("line", `${metrics[0].title || metrics[0].name} Trend`, dates[0].name, metrics[0].name, "sum", "trend", 0.92));
  }

  if (categories[0] && metrics[0]) {
    charts.push(chart("bar", `${metrics[0].title || metrics[0].name} by ${categories[0].title || categories[0].name}`, categories[0].name, metrics[0].name, "sum", "ranking", 0.9));
  }

  if (categories[0]) {
    charts.push(chart("donut", `${categories[0].title || categories[0].name} Distribution`, categories[0].name, "__count__", "count", "distribution", 0.86));
  }

  if (metrics.length >= 2) {
    charts.push(chart("scatter", `${metrics[1].title || metrics[1].name} vs ${metrics[0].title || metrics[0].name}`, metrics[1].name, metrics[0].name, "count", "correlation", 0.82));
  }

  if (geo[0] && metrics[0]) {
    charts.push(chart("map", `${metrics[0].title || metrics[0].name} by ${geo[0].title || geo[0].name}`, geo[0].name, metrics[0].name, "sum", "geo", 0.9));
  }

  if (!charts.length && cols.length) {
    charts.push(chart("table", "Dataset Overview", cols[0].name, "count", "count", "table", 0.75));
  }

  return charts.slice(0, 8);
}
