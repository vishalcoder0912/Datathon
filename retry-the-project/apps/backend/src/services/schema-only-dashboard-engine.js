import { randomUUID } from "node:crypto";
import { buildAnalyticsPlaybook } from "./analytics-playbook-engine.js";
import { serviceUrls } from "../config/serviceUrls.js";
import { getModelForTask } from "../config/model-router.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){8,}/;
const TOKEN_PATTERN = /^[A-Za-z0-9_\-]{24,}$/;
const PII_COLUMN_PATTERN = /\b(email|e-mail|phone|mobile|address|name|full_name|first_name|last_name|id|uuid|token|secret|password|api[_-]?key|credential)\b/i;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function groupBy(rows, xKey, yKey, aggregation = "sum", limit = 10) {
  const map = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown");
    const value = aggregation === "count" ? 1 : safeNumber(row[yKey]);

    if (aggregation !== "count" && value === null) continue;

    const stat = map.get(label) || { sum: 0, count: 0 };
    stat.sum += value;
    stat.count += 1;
    map.set(label, stat);
  }

  return [...map.entries()]
    .map(([label, stat]) => ({
      [xKey]: label,
      [aggregation === "count" ? "count" : yKey]:
        aggregation === "avg" ? Number((stat.sum / stat.count).toFixed(2)) : stat.sum,
    }))
    .sort((a, b) => {
      const key = aggregation === "count" ? "count" : yKey;
      return Number(b[key]) - Number(a[key]);
    })
    .slice(0, limit);
}

function detectColumns(rows = []) {
  const first = rows[0] || {};

  return Object.keys(first).map((name) => {
    const values = rows.map((r) => r[name]).filter(Boolean);
    const numeric = values.filter((v) => safeNumber(v) !== null).length;

    return {
      name,
      type: values.length && numeric / values.length > 0.75 ? "number" : "string",
      role: values.length && numeric / values.length > 0.75 ? "metric" : "dimension",
    };
  });
}

function isMeaningful(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function detectPiiRisk(name, values = []) {
  const reasons = [];

  if (PII_COLUMN_PATTERN.test(name || "")) {
    reasons.push("column_name");
  }

  const hasRiskyValue = values
    .filter(isMeaningful)
    .slice(0, 100)
    .some((value) => {
      const text = String(value).trim();
      return EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text) || TOKEN_PATTERN.test(text);
    });

  if (hasRiskyValue) {
    reasons.push("value_pattern");
  }

  return { risky: reasons.length > 0, reasons };
}

function inferColumnRole(name, type, values = []) {
  if (/date|time|month|year|created|updated/i.test(name || "")) return "date";
  if (/^(__)?rowid$|(^|_)id$/i.test(name || "")) return "id";

  const meaningful = values.filter(isMeaningful);
  const numericCount = meaningful.filter((value) => safeNumber(value) !== null).length;

  if (type === "number" || (meaningful.length && numericCount / meaningful.length > 0.75)) {
    return "metric";
  }

  if (/description|comment|notes?|message|text/i.test(name || "")) return "text";

  return "dimension";
}

function numericStats(values = []) {
  const numbers = values.map(safeNumber).filter((value) => value !== null);
  if (!numbers.length) return null;

  const sum = numbers.reduce((total, value) => total + value, 0);
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    mean: Number((sum / numbers.length).toFixed(2)),
  };
}

function topValues(values = [], piiRisk) {
  if (piiRisk.risky) return [];

  const counts = new Map();
  for (const value of values) {
    if (!isMeaningful(value)) continue;
    const text = String(value).trim();
    if (text.length > 60) continue;
    if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text) || TOKEN_PATTERN.test(text)) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([value, count]) => ({ value, count }));
}

export function buildSafeSchemaPacket(dataset) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const datasetColumns = Array.isArray(dataset?.columns) && dataset.columns.length
    ? dataset.columns
    : Object.keys(rows[0] || {}).map((name) => ({ name, type: "string" }));

  return {
    datasetId: dataset?.id,
    name: dataset?.name || "Unnamed Dataset",
    rowCount: dataset?.rowCount || rows.length,
    columnCount: datasetColumns.length,
    columns: datasetColumns.map((column) => {
      const values = rows.map((row) => row[column.name]);
      const piiRisk = detectPiiRisk(column.name, values);
      const role = inferColumnRole(column.name, column.type, values);
      const allowedForAI = !piiRisk.risky && role !== "id" && role !== "text";

      return {
        name: column.name,
        type: role === "metric" ? "number" : role === "date" ? "date" : column.type || "string",
        role,
        nullCount: values.filter((value) => !isMeaningful(value)).length,
        uniqueCount: new Set(values.filter(isMeaningful).map((value) => String(value).trim())).size,
        numericStats: role === "metric" ? numericStats(values) : null,
        topValues: topValues(values, piiRisk),
        piiRisk,
        allowedForAI,
      };
    }),
  };
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function callSchemaOnlyLLMPlanner(schemaPacket, query) {
  const model = getModelForTask("dashboard_planner");
  const baseUrl = serviceUrls.ollama;
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "user",
          content: [
            "You are a schema-only dashboard planner. Return JSON only. Never generate chart data arrays.",
            `User query: ${query}`,
            `Safe schema packet: ${JSON.stringify(schemaPacket)}`,
          ].join("\n"),
        },
      ],
      options: { temperature: 0, num_predict: 700 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Schema planner returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  const plan = safeJsonParse(payload?.message?.content);
  if (!plan) {
    throw new Error("Schema planner returned invalid JSON");
  }

  return { plan, provider: "llm", model };
}

function findColumn(columns, query, role) {
  const lower = query.toLowerCase();

  return (
    columns.find((c) => (!role || c.role === role) && lower.includes(c.name.toLowerCase())) ||
    columns.find((c) => !role || c.role === role)
  );
}

function findSchemaColumn(schema, key, role) {
  const columns = Array.isArray(schema?.columns) ? schema.columns : [];
  const normalized = String(key || "").toLowerCase();
  return columns.find((column) => {
    if (role && column.role !== role) return false;
    return String(column.name).toLowerCase() === normalized;
  });
}

export function validateChartPlan(schema, plan) {
  const chart = plan?.chart || plan;
  const allowedTypes = new Set(["bar", "line", "area", "pie", "scatter", "histogram"]);
  const allowedAggregations = new Set(["sum", "avg", "count", "min", "max"]);

  if (!chart || !allowedTypes.has(chart.type)) {
    return { ok: false, reason: `Unsupported chart type "${chart?.type}".` };
  }

  if (chart.type === "scatter") {
    const xMetric = findSchemaColumn(schema, chart.xKey, "metric");
    const yMetric = findSchemaColumn(schema, chart.yKey, "metric");
    if (!xMetric || !yMetric || xMetric.allowedForAI === false || yMetric.allowedForAI === false) {
      return { ok: false, reason: "Scatter chart needs two allowed numeric columns." };
    }
    return { ok: true };
  }

  if (chart.type === "histogram") {
    const metric = findSchemaColumn(schema, chart.xKey, "metric");
    if (!metric || metric.allowedForAI === false) {
      return { ok: false, reason: "Histogram needs one allowed numeric column." };
    }
    return { ok: true };
  }

  const xColumn = findSchemaColumn(schema, chart.xKey);
  if (!xColumn) return { ok: false, reason: `Column "${chart.xKey}" does not exist.` };
  if (xColumn.allowedForAI === false) return { ok: false, reason: `Column "${chart.xKey}" is not allowed.` };
  if (!["dimension", "date"].includes(xColumn.role)) {
    return { ok: false, reason: `${chart.type} chart needs a category or date column.` };
  }

  if (!allowedAggregations.has(chart.aggregation)) {
    return { ok: false, reason: `Unsupported aggregation "${chart.aggregation}".` };
  }

  if (chart.aggregation !== "count") {
    const yColumn = findSchemaColumn(schema, chart.yKey, "metric");
    if (!yColumn) return { ok: false, reason: `Column "${chart.yKey}" does not exist or is not numeric.` };
    if (yColumn.allowedForAI === false) return { ok: false, reason: `Column "${chart.yKey}" is not allowed.` };
  }

  return { ok: true };
}

export function executeChartPlan(dataset, plan) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];

  if (plan.type === "histogram") {
    const values = rows.map((row) => safeNumber(row[plan.xKey])).filter((value) => value !== null);
    if (!values.length) {
      return { id: randomUUID(), type: "bar", title: plan.title, xKey: "range", yKey: "count", data: [] };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketCount = Math.max(5, Math.min(plan.limit || 10, 20));
    const step = (max - min) / bucketCount || 1;
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = min + index * step;
      const end = index === bucketCount - 1 ? max : start + step;
      return { range: `${Number(start.toFixed(2))} - ${Number(end.toFixed(2))}`, count: 0 };
    });

    values.forEach((value) => {
      buckets[Math.min(Math.floor((value - min) / step), bucketCount - 1)].count += 1;
    });

    return { id: randomUUID(), type: "bar", title: plan.title, xKey: "range", yKey: "count", data: buckets };
  }

  if (plan.type === "scatter") {
    return {
      id: randomUUID(),
      type: "scatter",
      title: plan.title,
      xKey: plan.xKey,
      yKey: plan.yKey,
      data: rows
        .map((row) => ({ [plan.xKey]: safeNumber(row[plan.xKey]), [plan.yKey]: safeNumber(row[plan.yKey]) }))
        .filter((row) => row[plan.xKey] !== null && row[plan.yKey] !== null)
        .slice(0, plan.limit || 300),
    };
  }

  return {
    id: randomUUID(),
    type: plan.type,
    title: plan.title,
    xKey: plan.xKey,
    yKey: plan.aggregation === "count" ? "count" : plan.yKey,
    data: groupBy(rows, plan.xKey, plan.yKey, plan.aggregation, plan.limit || 10),
  };
}

export function buildInitialDashboardFromSchema(dataset, context = {}) {
  return buildAnalyticsPlaybook({
    dataset,
    metadataFiles: context.metadataFiles || [],
    testFiles: context.testFiles || [],
  });
}

export function planDashboardCommand(dataset, query) {
  const rows = dataset.rows || [];
  const columns = detectColumns(rows);
  const lower = query.toLowerCase();

  if (lower.includes("remove") || lower.includes("delete")) {
    return {
      action: "DELETE_CHART",
      message: "Removed the latest chart.",
      provider: "local",
      schemaOnly: true,
    };
  }

  if (lower.includes("clear") && lower.includes("filter")) {
    return {
      action: "CLEAR_FILTERS",
      message: "Cleared all filters.",
      provider: "local",
      schemaOnly: true,
    };
  }

  if (lower.includes("filter")) {
    const match = query.match(/filter\s+(.+?)\s*=\s*(.+)/i);

    if (match) {
      const col = findColumn(columns, match[1]);

      return {
        action: "FILTER",
        filters: col ? { [col.name]: match[2].trim() } : {},
        message: col ? `Applied filter on ${col.name}.` : "Could not find filter column.",
        provider: "local",
        schemaOnly: true,
      };
    }
  }

  if (lower.includes("kpi") || lower.includes("summary")) {
    const analysis = buildAnalyticsPlaybook({ dataset });

    return {
      action: "GENERATE_KPI",
      kpis: analysis.kpis,
      message: "Generated meaningful KPI summary.",
      provider: "local",
      schemaOnly: true,
    };
  }

  const metric = findColumn(columns, query, "metric");
  const dimension = findColumn(columns, query, "dimension");

  if (!metric || !dimension) {
    return {
      action: "ANSWER",
      message: "I could not find a valid metric and dimension for this chart.",
      provider: "local",
      schemaOnly: true,
    };
  }

  let type = "bar";
  if (lower.includes("pie")) type = "pie";
  if (lower.includes("line") || lower.includes("trend")) type = "line";

  const aggregation =
    lower.includes("average") || lower.includes("avg") ? "avg" :
    lower.includes("count") ? "count" :
    "sum";

  const yKey = aggregation === "count" ? "count" : metric.name;

  return {
    action: lower.includes("change") || lower.includes("modify") ? "MODIFY_CHART" : "GENERATE_CHART",
    chart: {
      id: randomUUID(),
      type,
      title: `${aggregation === "avg" ? "Average" : aggregation === "count" ? "Count" : "Total"} ${metric.name} by ${dimension.name}`,
      xKey: dimension.name,
      yKey,
      data: groupBy(rows, dimension.name, metric.name, aggregation, 10),
    },
    message: `Generated ${type} chart.`,
    provider: "local",
    schemaOnly: true,
  };
}
