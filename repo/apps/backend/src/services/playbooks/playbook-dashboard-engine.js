import { randomUUID } from "node:crypto";
import {
  buildSchema,
  cleanRows,
  findColumn,
  matchPlaybook,
  safeNumber,
} from "./playbook-matcher.js";
import {
  createColumnSignature,
  findSimilarPlaybook,
  saveAnalyticsMemory,
} from "../analytics-memory-service.js";

function humanize(value = "") {
  return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetric(name, value) {
  const normalized = String(name || "").toLowerCase();

  if (/salary|revenue|sales|amount|price|cost|profit|income/.test(normalized)) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  if (/rate|percent|margin|ratio|quality/.test(normalized)) {
    return `${Number(value).toFixed(1)}%`;
  }

  return Number(value.toFixed ? value.toFixed(2) : value).toLocaleString();
}

function aggregate(values = [], type = "count") {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");

  if (type === "count") return present.length;

  const numbers = present.map(safeNumber).filter((value) => value !== null);

  if (type === "missing_count") return values.length - present.length;
  if (!numbers.length) return 0;
  if (type === "sum") return numbers.reduce((left, right) => left + right, 0);
  if (type === "avg") return numbers.reduce((left, right) => left + right, 0) / numbers.length;
  if (type === "min") return Math.min(...numbers);
  if (type === "max") return Math.max(...numbers);

  if (type === "median") {
    const sorted = [...numbers].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return present.length;
}

function groupBy(rows, xKey, yKey, aggregation = "count", limit = 10) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(yKey ? row[yKey] : label);
  }

  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [aggregation === "count" ? "count" : yKey]: aggregate(values, aggregation),
    }))
    .sort((left, right) => {
      const leftValue = Number(Object.values(left).at(-1));
      const rightValue = Number(Object.values(right).at(-1));
      return rightValue - leftValue;
    })
    .slice(0, limit);
}

function histogram(rows, key, bins = 8) {
  const values = rows.map((row) => safeNumber(row[key])).filter((value) => value !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: String(min), count: values.length }];
  }

  const size = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, index) => ({
    start: min + index * size,
    end: index === bins - 1 ? max : min + (index + 1) * size,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / size), bins - 1);
    buckets[index].count += 1;
  }

  return buckets.map((bucket) => ({
    range: `${Math.round(bucket.start).toLocaleString()}-${Math.round(bucket.end).toLocaleString()}`,
    count: bucket.count,
  }));
}

function scatter(rows, xKey, yKey, limit = 200) {
  return rows
    .map((row) => ({ [xKey]: safeNumber(row[xKey]), [yKey]: safeNumber(row[yKey]) }))
    .filter((row) => row[xKey] !== null && row[yKey] !== null)
    .slice(0, limit);
}

function calculateQualityScore(schema) {
  const totalCells = schema.rowCount * Math.max(schema.columnCount, 1);
  const missingCells = schema.columns.reduce((sum, column) => sum + column.nullCount, 0);

  if (!totalCells) return 0;

  return Math.max(0, Math.min(100, ((totalCells - missingCells) / totalCells) * 100));
}

function buildKpi(rows, schema, template) {
  if (template.aggregation === "count") {
    return { id: randomUUID(), title: template.title, value: rows.length.toLocaleString(), metric: "*", aggregation: "count" };
  }

  if (template.aggregation === "quality_score") {
    return { id: randomUUID(), title: template.title, value: `${calculateQualityScore(schema).toFixed(1)}%`, metric: "*", aggregation: "quality_score" };
  }

  if (template.aggregation === "missing_count") {
    const missing = schema.columns.reduce((sum, column) => sum + column.nullCount, 0);
    return { id: randomUUID(), title: template.title, value: missing.toLocaleString(), metric: "*", aggregation: "missing_count" };
  }

  if (template.aggregation === "basket_size") {
    const transaction = findColumn(schema, { aliases: ["transaction", "transaction_id", "invoice", "order_id"] });
    if (!transaction) return null;

    const transactions = new Map();
    for (const row of rows) {
      const id = String(row[transaction.name] ?? "");
      if (!id) continue;
      transactions.set(id, (transactions.get(id) || 0) + 1);
    }

    const sizes = [...transactions.values()];
    const avg = sizes.length ? sizes.reduce((left, right) => left + right, 0) / sizes.length : 0;

    return { id: randomUUID(), title: template.title, value: Number(avg.toFixed(2)).toLocaleString(), metric: transaction.name, aggregation: "basket_size" };
  }

  if (template.aggregation === "rule_count") {
    const support = findColumn(schema, { aliases: ["support"] });
    const confidence = findColumn(schema, { aliases: ["confidence"] });
    const lift = findColumn(schema, { aliases: ["lift"] });

    if (!support && !confidence && !lift) return null;

    const count = rows.filter((row) => {
      const supportValue = support ? safeNumber(row[support.name]) : 1;
      const confidenceValue = confidence ? safeNumber(row[confidence.name]) : 1;
      const liftValue = lift ? safeNumber(row[lift.name]) : 1;
      return (supportValue ?? 0) > 0 && (confidenceValue ?? 0) > 0 && (liftValue ?? 0) >= 1;
    }).length;

    return { id: randomUUID(), title: template.title, value: count.toLocaleString(), aggregation: "rule_count" };
  }

  if (template.aggregation === "sentiment_count") {
    const sentiment = findColumn(schema, { aliases: ["sentiment", "polarity"] });
    if (!sentiment) return null;

    const target = String(template.value || "").toLowerCase();
    const count = rows.filter((row) => String(row[sentiment.name] || "").toLowerCase().includes(target)).length;

    return { id: randomUUID(), title: template.title, value: count.toLocaleString(), metric: sentiment.name, aggregation: "sentiment_count" };
  }

  if (template.aggregation === "unique_count") {
    const dimension = findColumn(schema, {
      aliases: template.dimensionAliases,
      role: template.dimensionRole || "category",
    });

    if (!dimension) return null;

    const unique = new Set(rows.map((row) => String(row[dimension.name] ?? "")).filter(Boolean));
    return { id: randomUUID(), title: template.title, value: unique.size.toLocaleString(), metric: dimension.name, aggregation: "unique_count" };
  }

  const metric = findColumn(schema, { aliases: template.metricAliases, role: "metric" });
  if (!metric) return null;

  const value = aggregate(rows.map((row) => row[metric.name]), template.aggregation);

  return {
    id: randomUUID(),
    title: template.title || `${humanize(template.aggregation)} ${humanize(metric.name)}`,
    value: formatMetric(metric.name, value),
    metric: metric.name,
    aggregation: template.aggregation,
  };
}

function buildChart(rows, schema, template) {
  const xColumn = findColumn(schema, { aliases: template.xAliases, role: template.xRole });
  const yColumn = findColumn(schema, { aliases: template.yAliases, role: template.yRole });

  if (template.type === "histogram") {
    const metric = yColumn || xColumn || findColumn(schema, { role: "metric" });
    if (!metric) return null;

    return {
      id: randomUUID(),
      title: template.title || `${humanize(metric.name)} Distribution`,
      type: "histogram",
      xKey: "range",
      yKey: "count",
      aggregation: "count",
      data: histogram(rows, metric.name, template.limit || 8),
    };
  }

  if (template.type === "scatter") {
    if (!xColumn || !yColumn) return null;

    return {
      id: randomUUID(),
      title: template.title,
      type: "scatter",
      xKey: xColumn.name,
      yKey: yColumn.name,
      aggregation: "raw",
      data: scatter(rows, xColumn.name, yColumn.name, template.limit || 200),
    };
  }

  if (!xColumn) return null;

  const aggregation = template.aggregation || "count";
  const yKey = aggregation === "count" ? null : yColumn?.name;

  if (aggregation !== "count" && !yKey) return null;

  return {
    id: randomUUID(),
    title: template.title,
    type: template.type || "bar",
    xKey: xColumn.name,
    yKey: aggregation === "count" ? "count" : yKey,
    aggregation,
    data: groupBy(rows, xColumn.name, yKey, aggregation, template.limit || 10),
  };
}

function buildLearnedChart(rows, schema, template) {
  const xColumn = schema.columns.find((column) => column.name === template.xKey);
  const yColumn = schema.columns.find((column) => column.name === template.yKey);

  if (template.type === "histogram") {
    const metric = yColumn || xColumn;
    if (!metric) return null;

    return { ...template, id: randomUUID(), xKey: "range", yKey: "count", data: histogram(rows, metric.name, 8), learned: true };
  }

  if (!xColumn) return null;
  if (template.aggregation !== "count" && !yColumn) return null;

  return {
    ...template,
    id: randomUUID(),
    data: groupBy(rows, xColumn.name, yColumn?.name, template.aggregation || "count", 10),
    learned: true,
  };
}

export async function buildDataAnalyticsProjectsDashboard(dataset = {}) {
  const schema = buildSchema(dataset);
  const rows = cleanRows(dataset.rows || []);
  const matchedPlaybook = matchPlaybook(schema);
  const columnSignature = createColumnSignature(schema.columns);
  const rememberedPlaybook = findSimilarPlaybook({ domain: matchedPlaybook.domain, columnSignature });

  const kpis = matchedPlaybook.kpis.map((template) => buildKpi(rows, schema, template)).filter(Boolean);
  let charts = matchedPlaybook.charts
    .map((template) => buildChart(rows, schema, template))
    .filter((chart) => chart && chart.data?.length);

  if (rememberedPlaybook?.chartTemplates?.length) {
    const learnedCharts = rememberedPlaybook.chartTemplates
      .map((template) => buildLearnedChart(rows, schema, template))
      .filter((chart) => chart && chart.data?.length);

    charts = [...learnedCharts, ...charts].slice(0, 10);
  }

  saveAnalyticsMemory({
    domain: matchedPlaybook.domain,
    columnSignature,
    kpiTemplates: kpis.map((kpi) => ({ title: kpi.title, metric: kpi.metric, aggregation: kpi.aggregation })),
    chartTemplates: charts.map((chart) => ({
      title: chart.title,
      type: chart.type,
      xKey: chart.xKey,
      yKey: chart.yKey,
      aggregation: chart.aggregation,
    })),
  });

  return {
    dataType: matchedPlaybook.domain,
    dataTypeLabel: matchedPlaybook.label,
    chartRecommendations: charts.slice(0, 10),
    kpis: kpis.slice(0, 8),
    insights: [
      {
        type: "summary",
        title: "Playbook Selected",
        message: `${matchedPlaybook.label} playbook selected from DataAnalyticsProjects-style analytics patterns.`,
      },
      {
        type: "privacy",
        title: "Schema-only AI Mode",
        message: "Dashboard values were calculated locally. Raw rows were not sent to the LLM.",
      },
    ],
    aiInsights: { schemaPacket: schema.schemaOnlyPacket },
    memory: {
      usedPreviousPattern: Boolean(rememberedPlaybook),
      similarity: rememberedPlaybook?.similarity || 0,
      domain: matchedPlaybook.domain,
      columnSignature,
    },
    privacy: {
      schemaOnly: true,
      rawRowsSentToAI: false,
    },
  };
}
