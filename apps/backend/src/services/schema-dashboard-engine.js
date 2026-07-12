import { randomUUID } from "node:crypto";
import {
  buildSchemaPacketAsync,
  formatSchemaForPrompt,
  getDataQualityScore,
} from "./schema-packet-builder.js";
import { serviceUrls } from "../config/serviceUrls.js";

const CHART_TYPES = new Set([
  "bar",
  "line",
  "area",
  "pie",
  "scatter",
  "histogram",
]);

const AGGREGATIONS = new Set(["sum", "avg", "count", "min", "max"]);

function humanize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isNumericColumn(column) {
  return column?.type === "numeric" || column?.type === "number";
}

function isDateLikeColumn(column) {
  return (
    column?.type === "date" ||
    /date|time|month|year|day|created|updated/i.test(column?.name || "")
  );
}

function enrichSchemaPacket(schemaPacket) {
  const columns = (schemaPacket.columns || []).map((column) => {
    let role = "dimension";

    if (isNumericColumn(column)) {
      role = "metric";
    }

    if (isDateLikeColumn(column)) {
      role = "date";
    }

    return {
      ...column,
      role,
      chartType: isNumericColumn(column)
        ? "number"
        : isDateLikeColumn(column)
          ? "date"
          : "string",
    };
  });

  return {
    ...schemaPacket,
    columns,
    metricColumns: columns.filter((column) => column.role === "metric"),
    dimensionColumns: columns.filter((column) => column.role === "dimension"),
    dateColumns: columns.filter((column) => column.role === "date"),
  };
}

function findColumn(schema, requestedName, preferredRoles = []) {
  const columns = schema.columns || [];
  if (!requestedName) return null;

  const requested = normalizeKey(requestedName);

  const roleAllowed = (column) => {
    if (!preferredRoles.length) return true;
    return preferredRoles.includes(column.role);
  };

  return (
    columns.find((column) => roleAllowed(column) && normalizeKey(column.name) === requested) ||
    columns.find((column) => roleAllowed(column) && normalizeKey(column.name).includes(requested)) ||
    columns.find((column) => roleAllowed(column) && requested.includes(normalizeKey(column.name))) ||
    null
  );
}

function pickDefaultMetric(schema, query = "") {
  const lowerQuery = String(query).toLowerCase();
  const metrics = schema.metricColumns || [];

  return (
    metrics.find((column) => lowerQuery.includes(column.name.toLowerCase())) ||
    metrics.find((column) => /revenue|sales|salary|amount|profit|price|cost|total|value|score/i.test(column.name)) ||
    metrics[0] ||
    null
  );
}

function pickDefaultDimension(schema, query = "") {
  const lowerQuery = String(query).toLowerCase();
  const dimensions = [...(schema.dateColumns || []), ...(schema.dimensionColumns || [])];

  const byMatch = lowerQuery.match(/\bby\s+([a-z0-9_ -]+)/i);
  if (byMatch) {
    const matched = findColumn(schema, byMatch[1], ["dimension", "date"]);
    if (matched) return matched;
  }

  return (
    dimensions.find((column) => lowerQuery.includes(column.name.toLowerCase())) ||
    dimensions.find((column) => /country|region|city|category|product|department|education|status|type|name|date|month/i.test(column.name)) ||
    dimensions[0] ||
    null
  );
}

function detectLocalAction(query) {
  const q = String(query || "").toLowerCase();

  if ((q.includes("delete") || q.includes("remove")) && q.includes("chart")) {
    return "DELETE_CHART";
  }

  if ((q.includes("clear") || q.includes("reset")) && (q.includes("filter") || q.includes("all"))) {
    return "CLEAR_FILTERS";
  }

  if (q.includes("filter") || q.includes("show only") || q.includes("where")) {
    return "FILTER";
  }

  if (q.includes("modify") || q.includes("change") || q.includes("switch") || q.includes("convert")) {
    return "MODIFY_CHART";
  }

  if (
    q.includes("chart") ||
    q.includes("graph") ||
    q.includes("show") ||
    q.includes("create") ||
    q.includes("generate") ||
    q.includes("visualize") ||
    q.includes("plot")
  ) {
    return "GENERATE_CHART";
  }

  if (q.includes("kpi") || q.includes("metric") || q.includes("summary")) {
    return "GENERATE_KPI";
  }

  return "ANSWER";
}

function detectChartType(query, requestedType) {
  const q = String(query || "").toLowerCase();
  const type = String(requestedType || "").toLowerCase();

  if (CHART_TYPES.has(type)) return type;
  if (q.includes("scatter") || q.includes("correlation") || q.includes(" vs ") || q.includes("vs ")) return "scatter";
  if (q.includes("line") || q.includes("trend") || q.includes("over time")) return "line";
  if (q.includes("area")) return "area";
  if (q.includes("pie") || q.includes("share") || q.includes("percentage") || q.includes("distribution")) return "pie";
  if (q.includes("histogram")) return "histogram";

  return "bar";
}

function detectAggregation(query, requestedAggregation) {
  const q = String(query || "").toLowerCase();
  const agg = String(requestedAggregation || "").toLowerCase();

  if (AGGREGATIONS.has(agg)) return agg;
  if (q.includes("average") || q.includes("avg") || q.includes("mean")) return "avg";
  if (q.includes("count") || q.includes("how many") || q.includes("number of")) return "count";
  if (q.includes("minimum") || q.includes("lowest") || q.includes("min")) return "min";
  if (q.includes("maximum") || q.includes("highest") || q.includes("max")) return "max";

  return "sum";
}

function parseFilterFromQuery(query, schema) {
  const patterns = [
    /filter\s+by\s+([\w\s-]+)\s*[=:]\s*["']?([^"']+)["']?/i,
    /filter\s+([\w\s-]+)\s*[=:]\s*["']?([^"']+)["']?/i,
    /show\s+only\s+([\w\s-]+)\s*[=:]\s*["']?([^"']+)["']?/i,
    /where\s+([\w\s-]+)\s*[=:]\s*["']?([^"']+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = String(query || "").match(pattern);
    if (!match) continue;

    const column = findColumn(schema, match[1], ["dimension", "date", "metric"]);
    if (!column) continue;

    return {
      [column.name]: match[2].trim(),
    };
  }

  return null;
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

function buildPlannerPrompt(schemaPacket, query, mode = "command") {
  const schemaText = formatSchemaForPrompt(schemaPacket);

  return `
You are a dashboard planning LLM.

IMPORTANT RULES:
- You never generate chart data arrays.
- You only choose valid columns from the schema.
- Return JSON only.
- Use uploaded data schema only.
- If the requested chart is impossible, return action "ANSWER" and explain why.
- Backend code will calculate chart data.

MODE: ${mode}

USER_QUERY:
${query}

SCHEMA:
${schemaText}

Return this JSON shape:
{
  "action": "GENERATE_CHART" | "MODIFY_CHART" | "DELETE_CHART" | "FILTER" | "CLEAR_FILTERS" | "GENERATE_KPI" | "ANSWER",
  "message": "short useful message",
  "chart": {
    "type": "bar" | "line" | "area" | "pie" | "scatter" | "histogram",
    "xKey": "column name",
    "yKey": "column name",
    "aggregation": "sum" | "avg" | "count" | "min" | "max",
    "limit": 10,
    "title": "chart title"
  },
  "filters": {
    "column name": "value"
  },
  "kpis": [
    {
      "title": "KPI title",
      "metric": "column name",
      "aggregation": "sum" | "avg" | "count" | "min" | "max"
    }
  ]
}
`.trim();
}

async function callOllamaPlanner(schemaPacket, query, mode = "command") {
  const model = process.env.OLLAMA_CHAT_MODEL || "llama3.2";
  const baseUrl = serviceUrls.ollama;
  const timeoutMs = Number(process.env.DASHBOARD_AI_TIMEOUT_MS || 45000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "user",
            content: buildPlannerPrompt(schemaPacket, query, mode),
          },
        ],
        options: {
          temperature: 0,
          num_predict: 700,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const parsed = safeJsonParse(payload?.message?.content);

    if (!parsed) {
      throw new Error("LLM did not return valid JSON");
    }

    return {
      plan: parsed,
      provider: "ollama",
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAction(action, query) {
  const raw = String(action || "").toUpperCase();

  if (raw.includes("MODIFY") || raw.includes("CHANGE") || raw.includes("SWITCH")) return "MODIFY_CHART";
  if (raw.includes("DELETE") || raw.includes("REMOVE")) return "DELETE_CHART";
  if (raw.includes("CLEAR") && raw.includes("FILTER")) return "CLEAR_FILTERS";
  if (raw.includes("FILTER")) return "FILTER";
  if (raw.includes("KPI") || raw.includes("METRIC")) return "GENERATE_KPI";
  if (raw.includes("CHART") || raw.includes("VISUAL")) return "GENERATE_CHART";
  if (raw.includes("ANSWER")) return "ANSWER";

  return detectLocalAction(query);
}

function normalizeChartSpec(dataset, schema, query, rawChart = {}) {
  const type = detectChartType(query, rawChart.type);
  const aggregation = detectAggregation(query, rawChart.aggregation);

  let xColumn = findColumn(schema, rawChart.xKey, ["dimension", "date", "metric"]);
  let yColumn = findColumn(schema, rawChart.yKey, ["metric", "dimension", "date"]);

  if (type === "scatter") {
    const metrics = schema.metricColumns || [];
    const xMetric = findColumn(schema, rawChart.xKey, ["metric"]) || metrics[0];
    const yMetric =
      findColumn(schema, rawChart.yKey, ["metric"]) ||
      metrics.find((metric) => metric.name !== xMetric?.name);

    return {
      type,
      xKey: xMetric?.name || "",
      yKey: yMetric?.name || "",
      aggregation: "none",
      limit: Number(rawChart.limit || 300),
      title: rawChart.title || `${humanize(yMetric?.name)} vs ${humanize(xMetric?.name)}`,
    };
  }

  if (type === "histogram") {
    const metric = findColumn(schema, rawChart.xKey || rawChart.yKey, ["metric"]) || pickDefaultMetric(schema, query);

    return {
      type,
      xKey: metric?.name || "",
      yKey: "count",
      aggregation: "count",
      limit: Number(rawChart.limit || 12),
      title: rawChart.title || `Distribution of ${humanize(metric?.name)}`,
    };
  }

  if (!xColumn || xColumn.role === "metric") {
    xColumn = pickDefaultDimension(schema, query);
  }

  if ((!yColumn || yColumn.role !== "metric") && aggregation !== "count") {
    yColumn = pickDefaultMetric(schema, query);
  }

  const yKey = aggregation === "count" ? "count" : yColumn?.name || "";

  return {
    type,
    xKey: xColumn?.name || "",
    yKey,
    sourceMetric: yColumn?.name || "",
    aggregation,
    limit: Math.max(1, Math.min(Number(rawChart.limit || 10), 50)),
    title:
      rawChart.title ||
      `${aggregation === "avg" ? "Average" : aggregation === "count" ? "Count" : humanize(aggregation)} ${
        aggregation === "count" ? "Records" : humanize(yColumn?.name)
      } by ${humanize(xColumn?.name)}`,
  };
}

function validateChartSpec(schema, chart) {
  const x = findColumn(schema, chart.xKey);
  const y = chart.sourceMetric ? findColumn(schema, chart.sourceMetric) : findColumn(schema, chart.yKey);

  if (!CHART_TYPES.has(chart.type)) {
    return {
      ok: false,
      reason: `Unsupported chart type "${chart.type}".`,
    };
  }

  if (chart.type === "scatter") {
    const xMetric = findColumn(schema, chart.xKey, ["metric"]);
    const yMetric = findColumn(schema, chart.yKey, ["metric"]);

    if (!xMetric || !yMetric) {
      return {
        ok: false,
        reason: "Scatter chart needs two numeric columns.",
      };
    }

    return { ok: true };
  }

  if (chart.type === "histogram") {
    const metric = findColumn(schema, chart.xKey, ["metric"]);

    if (!metric) {
      return {
        ok: false,
        reason: "Histogram needs one numeric column.",
      };
    }

    return { ok: true };
  }

  if (!x) {
    return {
      ok: false,
      reason: `Column "${chart.xKey}" does not exist.`,
    };
  }

  if (chart.aggregation !== "count" && !y) {
    return {
      ok: false,
      reason: `Column "${chart.yKey}" does not exist.`,
    };
  }

  if (chart.aggregation !== "count" && y?.role !== "metric") {
    return {
      ok: false,
      reason: `"${chart.yKey}" is not numeric, so it cannot be used as a metric.`,
    };
  }

  if (["pie", "bar", "line", "area"].includes(chart.type) && x.role === "metric") {
    return {
      ok: false,
      reason: `${chart.type} chart needs a category/date column on X-axis.`,
    };
  }

  return { ok: true };
}

function applyFilters(rows, filters = {}) {
  const entries = Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (!entries.length) return rows;

  return rows.filter((row) => {
    return entries.every(([key, value]) => {
      return String(row[key] ?? "").toLowerCase() === String(value).toLowerCase();
    });
  });
}

function executeHistogram(dataset, chart, rows) {
  const values = rows
    .map((row) => Number(row[chart.xKey]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return {
      ...chart,
      yKey: "count",
      data: [],
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketCount = Math.max(5, Math.min(chart.limit || 12, 20));
  const step = (max - min) / bucketCount || 1;

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const start = min + index * step;
    const end = index === bucketCount - 1 ? max : start + step;

    return {
      range: `${Number(start.toFixed(2))} - ${Number(end.toFixed(2))}`,
      count: 0,
      start,
      end,
    };
  });

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), bucketCount - 1);
    buckets[index].count += 1;
  }

  return {
    id: randomUUID(),
    type: "bar",
    title: chart.title,
    xKey: "range",
    yKey: "count",
    data: buckets.map(({ range, count }) => ({ range, count })),
  };
}

function executeChartSpec(dataset, chart, filters = {}) {
  const rows = applyFilters(Array.isArray(dataset.rows) ? dataset.rows : [], filters);

  if (chart.type === "histogram") {
    return executeHistogram(dataset, chart, rows);
  }

  if (chart.type === "scatter") {
    const data = rows
      .map((row) => ({
        [chart.xKey]: Number(row[chart.xKey]),
        [chart.yKey]: Number(row[chart.yKey]),
      }))
      .filter((row) => Number.isFinite(row[chart.xKey]) && Number.isFinite(row[chart.yKey]))
      .slice(0, chart.limit || 300);

    return {
      id: randomUUID(),
      type: "scatter",
      title: chart.title,
      xKey: chart.xKey,
      yKey: chart.yKey,
      data,
    };
  }

  const valueKey = chart.aggregation === "count" ? "count" : chart.yKey;
  const metricKey = chart.sourceMetric || chart.yKey;
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[chart.xKey] ?? "Unknown").trim() || "Unknown";
    const rawValue = chart.aggregation === "count" ? 1 : Number(row[metricKey]);

    if (chart.aggregation !== "count" && !Number.isFinite(rawValue)) {
      continue;
    }

    const current = groups.get(label) || {
      sum: 0,
      count: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
    };

    current.sum += rawValue;
    current.count += 1;
    current.min = Math.min(current.min, rawValue);
    current.max = Math.max(current.max, rawValue);

    groups.set(label, current);
  }

  let data = [...groups.entries()].map(([label, group]) => {
    let value = group.sum;

    if (chart.aggregation === "avg") value = group.count > 0 ? group.sum / group.count : 0;
    if (chart.aggregation === "count") value = group.count;
    if (chart.aggregation === "min") value = group.min;
    if (chart.aggregation === "max") value = group.max;

    return {
      [chart.xKey]: label,
      [valueKey]: Number(value.toFixed(2)),
    };
  });

  if (chart.type === "line" || chart.type === "area") {
    data = data.sort((a, b) => String(a[chart.xKey]).localeCompare(String(b[chart.xKey])));
  } else {
    data = data.sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
  }

  data = data.slice(0, chart.limit || 10);

  return {
    id: randomUUID(),
    type: chart.type,
    title: chart.title,
    xKey: chart.xKey,
    yKey: valueKey,
    data,
  };
}

function computeMetric(dataset, metricName, aggregation = "sum") {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const values = rows
    .map((row) => Number(row[metricName]))
    .filter((value) => Number.isFinite(value));

  if (aggregation === "count") return rows.length;
  if (!values.length) return 0;
  if (aggregation === "avg") return values.reduce((a, b) => a + b, 0) / values.length;
  if (aggregation === "min") return Math.min(...values);
  if (aggregation === "max") return Math.max(...values);

  return values.reduce((a, b) => a + b, 0);
}

function buildKpis(dataset, schema, requestedKpis = []) {
  const kpis = [];
  const metric = schema.metricColumns?.[0];
  const dimension = schema.dimensionColumns?.[0];

  kpis.push({
    title: "Total Records",
    value: String(dataset.rowCount || dataset.rows?.length || 0),
    icon: "rows",
    status: "good",
  });

  if (metric) {
    const total = computeMetric(dataset, metric.name, "sum");
    const avg = computeMetric(dataset, metric.name, "avg");

    kpis.push({
      title: `Total ${humanize(metric.name)}`,
      value: Number(total.toFixed(2)).toLocaleString(),
      icon: "chart",
      status: "good",
    });

    kpis.push({
      title: `Avg ${humanize(metric.name)}`,
      value: Number(avg.toFixed(2)).toLocaleString(),
      icon: "chart",
      status: "good",
    });
  }

  if (dimension) {
    const counts = new Map();

    for (const row of dataset.rows || []) {
      const label = String(row[dimension.name] ?? "Unknown");
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

    if (top) {
      kpis.push({
        title: `Top ${humanize(dimension.name)}`,
        value: top[0],
        icon: "pie-chart",
        status: "good",
        insight: `${top[0]} appears in ${top[1]} records.`,
      });
    }
  }

  for (const requested of requestedKpis || []) {
    const requestedMetric = findColumn(schema, requested.metric, ["metric"]);
    if (!requestedMetric) continue;

    const aggregation = detectAggregation("", requested.aggregation);
    const value = computeMetric(dataset, requestedMetric.name, aggregation);

    kpis.push({
      title: requested.title || `${humanize(aggregation)} ${humanize(requestedMetric.name)}`,
      value: Number(value.toFixed(2)).toLocaleString(),
      icon: "chart",
      status: "good",
    });
  }

  return kpis.slice(0, 6);
}

function buildFallbackPlan(schema, query) {
  const action = detectLocalAction(query);
  const filters = parseFilterFromQuery(query, schema);

  if (action === "FILTER" && filters) {
    return {
      action: "FILTER",
      filters,
      message: `Applied filter: ${Object.entries(filters)[0][0]} = ${Object.entries(filters)[0][1]}.`,
    };
  }

  return {
    action,
    message: "Generated using schema-based local planner.",
    chart: {},
    filters,
    kpis: [],
  };
}

function buildInsightsFromKpis(kpis, schemaPacket, qualityScore) {
  const metrics = {
    totalRecords: schemaPacket.rowCount,
  };

  return [
    {
      type: "summary",
      title: "Dataset Summary",
      message: `Detected ${schemaPacket.rowCount.toLocaleString()} rows and ${schemaPacket.columnCount} columns.`,
      metrics,
    },
    {
      type: "data_quality",
      title: "Data Quality",
      message: `Schema quality score is ${qualityScore}/100.`,
      score: qualityScore,
    },
    ...kpis.slice(0, 3).map((kpi) => ({
      type: "kpi",
      title: kpi.title,
      message: `${kpi.title}: ${kpi.value}`,
      value: kpi.value,
    })),
  ];
}

export async function planAndExecuteDashboardCommand(dataset, query) {
  const rawSchemaPacket = await buildSchemaPacketAsync(dataset);
  const schema = enrichSchemaPacket(rawSchemaPacket);

  const localPlan = buildFallbackPlan(schema, query);

  if (localPlan.action === "DELETE_CHART" || localPlan.action === "CLEAR_FILTERS") {
    return {
      ...localPlan,
      provider: "local",
    };
  }

  let aiPlan = null;
  let provider = "local";
  let model;
  let aiError;

  try {
    const result = await callOllamaPlanner(schema, query, "command");
    aiPlan = result.plan;
    provider = result.provider;
    model = result.model;
  } catch (error) {
    aiError = error.message;
    aiPlan = localPlan;
  }

  const action = normalizeAction(aiPlan?.action, query);

  if (action === "FILTER") {
    const filters = aiPlan?.filters && Object.keys(aiPlan.filters).length
      ? aiPlan.filters
      : parseFilterFromQuery(query, schema);

    return {
      action: "FILTER",
      filters: filters || {},
      message: filters ? "Filter applied." : "I could not identify the filter column/value.",
      provider,
      model,
      aiError,
    };
  }

  if (action === "GENERATE_KPI") {
    const kpis = buildKpis(dataset, schema, aiPlan?.kpis || []);

    return {
      action: "GENERATE_KPI",
      kpis,
      message: "Generated KPI suggestions from schema.",
      provider,
      model,
      aiError,
    };
  }

  if (action !== "GENERATE_CHART" && action !== "MODIFY_CHART") {
    return {
      action: "ANSWER",
      message:
        aiPlan?.message ||
        "Ask me to create a chart, modify chart, delete chart, filter data, or generate KPIs.",
      provider,
      model,
      aiError,
    };
  }

  const chartSpec = normalizeChartSpec(dataset, schema, query, aiPlan?.chart || {});
  const validation = validateChartSpec(schema, chartSpec);

  if (!validation.ok) {
    return {
      action: "ANSWER",
      message: `That chart is not possible: ${validation.reason}`,
      provider,
      model,
      aiError,
    };
  }

  const chart = executeChartSpec(dataset, chartSpec, aiPlan?.filters || {});
  const kpis = buildKpis(dataset, schema, aiPlan?.kpis || []);

  return {
    action,
    chart,
    kpis,
    filters: aiPlan?.filters || undefined,
    message:
      aiPlan?.message ||
      `${action === "MODIFY_CHART" ? "Modified" : "Generated"} ${chart.type} chart: ${chart.title}.`,
    provider,
    model,
    aiError,
  };
}

export async function buildInitialDashboardAnalysis(dataset) {
  const rawSchemaPacket = await buildSchemaPacketAsync(dataset);
  const schema = enrichSchemaPacket(rawSchemaPacket);
  const qualityScore = getDataQualityScore(rawSchemaPacket);

  const chartRecommendations = [];

  const primaryMetric = pickDefaultMetric(schema);
  const primaryDimension = pickDefaultDimension(schema);
  const dateColumn = schema.dateColumns?.[0];

  if (primaryMetric && primaryDimension) {
    const barSpec = normalizeChartSpec(dataset, schema, "", {
      type: "bar",
      xKey: primaryDimension.name,
      yKey: primaryMetric.name,
      aggregation: "sum",
      title: `${humanize(primaryMetric.name)} by ${humanize(primaryDimension.name)}`,
      limit: 10,
    });

    chartRecommendations.push(executeChartSpec(dataset, barSpec));
  }

  if (primaryMetric && dateColumn) {
    const lineSpec = normalizeChartSpec(dataset, schema, "trend over time", {
      type: "line",
      xKey: dateColumn.name,
      yKey: primaryMetric.name,
      aggregation: "sum",
      title: `${humanize(primaryMetric.name)} Trend`,
      limit: 20,
    });

    chartRecommendations.push(executeChartSpec(dataset, lineSpec));
  }

  if (primaryDimension) {
    const pieSpec = normalizeChartSpec(dataset, schema, "distribution", {
      type: "pie",
      xKey: primaryDimension.name,
      aggregation: "count",
      title: `${humanize(primaryDimension.name)} Distribution`,
      limit: 8,
    });

    chartRecommendations.push(executeChartSpec(dataset, pieSpec));
  }

  const kpis = buildKpis(dataset, schema);

  return {
    dataType: "SCHEMA_DRIVEN",
    dataTypeLabel: "Schema Driven Dashboard",
    chartRecommendations: chartRecommendations.filter(Boolean),
    insights: buildInsightsFromKpis(kpis, rawSchemaPacket, qualityScore),
    aiInsights: {
      schemaPacket: {
        name: rawSchemaPacket.name,
        rowCount: rawSchemaPacket.rowCount,
        columnCount: rawSchemaPacket.columnCount,
        columns: schema.columns.map((column) => ({
          name: column.name,
          type: column.chartType,
          role: column.role,
          uniqueCount: column.uniqueCount,
          nullCount: column.nullCount,
        })),
      },
      kpis,
      qualityScore,
    },
  };
}