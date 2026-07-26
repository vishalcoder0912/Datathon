import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MEMORY_FILE = path.resolve(
  process.env.ANALYTICS_BRAIN_MEMORY_FILE || path.join("data", "analytics-brain-memory.json"),
);
const VALUE_LIMIT = 12;

function ensureMemoryFile() {
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });

  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify([], null, 2));
  }
}

function readMemory() {
  ensureMemoryFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMemory(memory) {
  ensureMemoryFile();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanize(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "")
    .replace(/[$₹,%\s]/g, "")
    .replace(/,/g, "");

  if (!cleaned || (cleaned.includes("-") && !/^-?\d+(\.\d+)?$/.test(cleaned))) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateLike(value) {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  if (!/\d{4}|\d{1,2}[/-]\d{1,2}/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function inferType(values = []) {
  const present = values.filter((value) => !isMissing(value)).slice(0, 100);
  if (!present.length) return "string";

  const numericCount = present.filter((value) => safeNumber(value) !== null).length;
  const dateCount = present.filter(isDateLike).length;

  if (numericCount / present.length >= 0.8) return "number";
  if (dateCount / present.length >= 0.8) return "date";
  return "string";
}

function cleanRows(rows = []) {
  return rows.filter((row) => {
    const keys = Object.keys(row || {}).map(normalizeName);
    const source = String(row?._sourceFile || row?.source || row?.fileName || "").toLowerCase();
    const looksLikeDictionary =
      (keys.includes("column") || keys.includes("column_name") || keys.includes("field")) &&
      (keys.includes("type") || keys.includes("data_type")) &&
      (keys.includes("description") || keys.includes("definition") || keys.includes("meaning"));

    return !source.includes("dictionary") && !looksLikeDictionary;
  });
}

function inferColumns(inputColumns = [], rows = []) {
  const names =
    inputColumns.length > 0
      ? inputColumns.map((column) => column.name || column)
      : Object.keys(rows[0] || {});

  return names
    .filter(Boolean)
    .map((name) => {
      const values = rows.map((row) => row[name]);
      const declaredType = inputColumns.find((column) => (column.name || column) === name)?.type;
      const type = declaredType || inferType(values);
      const presentValues = values.filter((value) => !isMissing(value));
      const uniqueValues = [...new Set(presentValues.map(String))];

      return {
        name,
        normalizedName: normalizeName(name),
        type,
        missingCount: values.length - presentValues.length,
        uniqueCount: uniqueValues.length,
        topValues: type === "string" ? uniqueValues.slice(0, VALUE_LIMIT) : [],
      };
    });
}

function columnSignature(columns = []) {
  return columns
    .map((column) => column.normalizedName || normalizeName(column.name))
    .sort()
    .join("|");
}

function similarity(a = "", b = "") {
  const setA = new Set(a.split("|").filter(Boolean));
  const setB = new Set(b.split("|").filter(Boolean));

  if (!setA.size || !setB.size) return 0;

  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;

  return intersection / union;
}

function findColumn(schema, aliases = [], preferredTypes = []) {
  const normalizedAliases = aliases.map(normalizeName);

  const scored = schema.columns
    .map((column) => {
      const name = column.normalizedName;
      let score = 0;
      let aliasMatched = false;

      for (const alias of normalizedAliases) {
        if (name === alias) {
          score += 10;
          aliasMatched = true;
        } else if (name.includes(alias)) {
          score += 6;
          aliasMatched = true;
        } else if (alias.includes(name)) {
          score += 3;
          aliasMatched = true;
        }
      }

      if (aliasMatched && preferredTypes.includes(column.type)) score += 2;
      return { column, score, aliasMatched };
    })
    .filter((item) => item.aliasMatched && item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.column || null;
}

function detectDomain(schema) {
  const names = schema.columns.map((column) => column.normalizedName).join(" ");

  if (/salary|experience|education|company_size|framework|language/.test(names)) return "salary_hr_jobs";
  if (/revenue|sales|profit|amount|order|product|customer|quantity|units/.test(names)) return "sales";
  if (/student|class|grade|marks|score|attendance|subject|teacher/.test(names)) return "education";
  if (/transaction|invoice|basket|item|support|confidence|lift/.test(names)) return "market_basket";
  if (/review|comment|feedback|sentiment|rating|text/.test(names)) return "sentiment";
  if (/date|month|year|time|period|forecast/.test(names) && schema.columns.some((column) => column.type === "number")) return "time_series";
  if (/user|movie|item|rating|recommendation/.test(names)) return "recommender";
  if (/price|cost|expense|income|balance|payment|tax|roi/.test(names)) return "finance";

  return "generic";
}

function buildSafeSchemaPacket(dataset, rows, columns) {
  return {
    datasetId: dataset.id || null,
    name: dataset.name || dataset.fileName || "Uploaded Dataset",
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    columnSignature: columnSignature(columns),
    privacy: {
      schemaOnly: true,
      rawRowsSentToAI: false,
    },
  };
}

function aggregate(values = [], aggregation = "count") {
  const present = values.filter((value) => !isMissing(value));
  const numbers = values.map(safeNumber).filter((number) => number !== null);

  if (aggregation === "count") return present.length;
  if (aggregation === "distinct_count") return new Set(present.map(String)).size;
  if (!numbers.length) return 0;

  if (aggregation === "sum") return numbers.reduce((a, b) => a + b, 0);
  if (aggregation === "avg") return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);

  if (aggregation === "median") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return 0;
}

function formatValue(metric, value) {
  const metricName = normalizeName(metric || "");

  if (/salary|revenue|sales|profit|amount|price|cost|income|expense/.test(metricName)) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  if (/rate|percent|margin|ratio/.test(metricName)) {
    return `${Number(value).toFixed(2)}%`;
  }

  if (typeof value === "number") {
    return Number(value.toFixed(2)).toLocaleString();
  }

  return String(value);
}

function groupByAggregate(rows, xKey, yKey, aggregation = "count", limit = 10) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row[yKey]);
  }

  const valueKey = aggregation === "count" ? "count" : yKey;

  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [valueKey]: aggregate(values, aggregation),
    }))
    .sort((a, b) => Number(Object.values(b).at(-1)) - Number(Object.values(a).at(-1)))
    .slice(0, limit);
}

function buildHistogram(rows, key, bins = 8) {
  const values = rows.map((row) => safeNumber(row[key])).filter((value) => value !== null);
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: String(min), count: values.length }];
  }

  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, index) => {
    const start = min + index * step;
    const end = index === bins - 1 ? max : start + step;
    return {
      range: `${Math.round(start).toLocaleString()}-${Math.round(end).toLocaleString()}`,
      count: 0,
    };
  });

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), bins - 1);
    buckets[index].count += 1;
  }

  return buckets;
}

function buildExperienceBuckets(rows, experienceKey, metricKey) {
  const buckets = [
    { label: "0-2", min: 0, max: 2, values: [] },
    { label: "2-5", min: 2, max: 5, values: [] },
    { label: "5-10", min: 5, max: 10, values: [] },
    { label: "10-15", min: 10, max: 15, values: [] },
    { label: "15+", min: 15, max: Infinity, values: [] },
  ];

  for (const row of rows) {
    const experience = safeNumber(row[experienceKey]);
    if (experience === null) continue;

    const bucket = buckets.find((item) => experience >= item.min && experience < item.max);
    if (bucket) bucket.values.push(row[metricKey]);
  }

  return buckets.map((bucket) => ({
    [experienceKey]: bucket.label,
    [metricKey]: aggregate(bucket.values, "avg"),
  }));
}

function countSplitValues(rows, key, limit = 10) {
  const counts = new Map();

  for (const row of rows) {
    String(row[key] ?? "")
      .split(/[,;/|]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ [key]: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

const PLAYBOOKS = {
  salary_hr_jobs: {
    label: "Salary & Jobs Analytics",
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Average Salary", metric: ["salary", "salary_usd", "income"], aggregation: "avg" },
      { title: "Median Salary", metric: ["salary", "salary_usd", "income"], aggregation: "median" },
      { title: "Highest Salary", metric: ["salary", "salary_usd", "income"], aggregation: "max" },
    ],
    charts: [
      { type: "bar", title: "Average Salary by Country", x: ["country"], y: ["salary", "salary_usd"], aggregation: "avg" },
      { type: "histogram", title: "Salary Distribution", x: ["salary", "salary_usd"], y: ["salary", "salary_usd"], aggregation: "count" },
      { type: "bar", title: "Average Salary by Experience", x: ["experience", "years_experience"], y: ["salary", "salary_usd"], aggregation: "avg", bucket: "experience" },
      { type: "pie", title: "Education Levels", x: ["education", "degree"], y: ["count"], aggregation: "count" },
      { type: "bar", title: "Top Programming Languages", x: ["languages", "language"], y: ["count"], aggregation: "count", splitValues: true },
    ],
  },
  sales: {
    label: "Sales Analytics",
    kpis: [
      { title: "Total Orders", aggregation: "count" },
      { title: "Total Revenue", metric: ["revenue", "sales", "amount"], aggregation: "sum" },
      { title: "Average Order Value", metric: ["revenue", "sales", "amount"], aggregation: "avg" },
      { title: "Highest Sale", metric: ["revenue", "sales", "amount"], aggregation: "max" },
    ],
    charts: [
      { type: "bar", title: "Revenue by Product", x: ["product", "item", "category"], y: ["revenue", "sales", "amount"], aggregation: "sum" },
      { type: "bar", title: "Revenue by Region", x: ["region", "country", "state", "city"], y: ["revenue", "sales", "amount"], aggregation: "sum" },
      { type: "line", title: "Revenue Trend", x: ["date", "month", "year"], y: ["revenue", "sales", "amount"], aggregation: "sum" },
      { type: "pie", title: "Orders by Channel", x: ["channel", "source"], y: ["count"], aggregation: "count" },
    ],
  },
  education: {
    label: "Education Analytics",
    kpis: [
      { title: "Total Students", aggregation: "count" },
      { title: "Average Score", metric: ["score", "marks", "grade"], aggregation: "avg" },
      { title: "Highest Score", metric: ["score", "marks", "grade"], aggregation: "max" },
      { title: "Average Attendance", metric: ["attendance"], aggregation: "avg" },
    ],
    charts: [
      { type: "bar", title: "Average Score by Class", x: ["class", "grade_level"], y: ["score", "marks"], aggregation: "avg" },
      { type: "bar", title: "Average Score by Subject", x: ["subject"], y: ["score", "marks"], aggregation: "avg" },
      { type: "pie", title: "Students by Class", x: ["class", "grade_level"], y: ["count"], aggregation: "count" },
    ],
  },
  market_basket: {
    label: "Market Basket Analytics",
    kpis: [
      { title: "Total Transactions", metric: ["transaction", "invoice", "order_id"], aggregation: "distinct_count" },
      { title: "Total Items", metric: ["item", "product"], aggregation: "count" },
    ],
    charts: [
      { type: "bar", title: "Top Items", x: ["item", "product"], y: ["count"], aggregation: "count" },
      { type: "bar", title: "Transactions by Customer", x: ["customer", "customer_id"], y: ["count"], aggregation: "count" },
    ],
  },
  sentiment: {
    label: "Sentiment Analytics",
    kpis: [
      { title: "Total Reviews", aggregation: "count" },
      { title: "Average Rating", metric: ["rating", "score"], aggregation: "avg" },
    ],
    charts: [
      { type: "pie", title: "Sentiment Distribution", x: ["sentiment", "polarity"], y: ["count"], aggregation: "count" },
      { type: "histogram", title: "Rating Distribution", x: ["rating", "score"], y: ["rating", "score"], aggregation: "count" },
    ],
  },
  time_series: {
    label: "Time Series Analytics",
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Average Value", metric: ["value", "rate", "sales", "revenue", "amount"], aggregation: "avg" },
      { title: "Peak Value", metric: ["value", "rate", "sales", "revenue", "amount"], aggregation: "max" },
    ],
    charts: [
      { type: "line", title: "Trend Over Time", x: ["date", "month", "year", "time"], y: ["value", "rate", "sales", "revenue", "amount"], aggregation: "avg" },
      { type: "histogram", title: "Value Distribution", x: ["value", "rate", "sales", "revenue", "amount"], y: ["value", "rate", "sales", "revenue", "amount"], aggregation: "count" },
    ],
  },
  recommender: {
    label: "Recommendation Analytics",
    kpis: [
      { title: "Total Interactions", aggregation: "count" },
      { title: "Average Rating", metric: ["rating", "score"], aggregation: "avg" },
    ],
    charts: [
      { type: "bar", title: "Top Rated Items", x: ["movie", "item", "product"], y: ["rating", "score"], aggregation: "avg" },
      { type: "bar", title: "Interactions by User", x: ["user", "user_id", "customer"], y: ["count"], aggregation: "count" },
    ],
  },
  finance: {
    label: "Finance Analytics",
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Total Amount", metric: ["amount", "price", "cost", "expense", "income", "balance"], aggregation: "sum" },
      { title: "Average Amount", metric: ["amount", "price", "cost", "expense", "income", "balance"], aggregation: "avg" },
    ],
    charts: [
      { type: "bar", title: "Amount by Category", x: ["category", "type", "account"], y: ["amount", "price", "cost", "expense", "income"], aggregation: "sum" },
      { type: "line", title: "Amount Over Time", x: ["date", "month", "year"], y: ["amount", "price", "cost", "expense", "income"], aggregation: "sum" },
    ],
  },
  generic: {
    label: "General Data Analytics",
    kpis: [{ title: "Total Records", aggregation: "count" }],
    charts: [
      { type: "bar", title: "Top Categories", x: ["category", "type", "name"], y: ["count"], aggregation: "count" },
      { type: "histogram", title: "Metric Distribution", x: ["value", "amount", "score"], y: ["value", "amount", "score"], aggregation: "count" },
    ],
  },
};

function resolveMetric(schema, aliases) {
  if (!aliases) return null;
  return findColumn(schema, Array.isArray(aliases) ? aliases : [aliases], ["number"]);
}

function resolveDimension(schema, aliases) {
  if (!aliases) return null;
  return findColumn(schema, Array.isArray(aliases) ? aliases : [aliases], ["string", "date"]);
}

function buildKpi(rows, schema, template) {
  if (template.aggregation === "count" && !template.metric) {
    return {
      id: randomUUID(),
      title: template.title || "Total Records",
      value: rows.length.toLocaleString(),
      aggregation: "count",
      metric: "*",
      icon: "rows",
    };
  }

  const preferredTypes = template.aggregation === "distinct_count" || template.aggregation === "count" ? ["string", "number"] : ["number"];
  const metric = template.metric ? findColumn(schema, Array.isArray(template.metric) ? template.metric : [template.metric], preferredTypes) : null;
  if (!metric) return null;

  const value = aggregate(rows.map((row) => row[metric.name]), template.aggregation);

  return {
    id: randomUUID(),
    title: template.title || `${humanize(template.aggregation)} ${humanize(metric.name)}`,
    value: formatValue(metric.name, value),
    metric: metric.name,
    aggregation: template.aggregation,
    icon: "chart",
  };
}

function buildChart(rows, schema, template) {
  const xColumn = resolveDimension(schema, template.x);
  const yColumn = template.aggregation === "count" ? null : resolveMetric(schema, template.y);

  if (!xColumn && template.type !== "histogram") return null;
  if (template.aggregation !== "count" && !yColumn) return null;

  if (template.type === "histogram") {
    const metric = resolveMetric(schema, template.x || template.y);
    if (!metric) return null;

    return {
      id: randomUUID(),
      type: "histogram",
      title: template.title || `${humanize(metric.name)} Distribution`,
      xKey: "range",
      yKey: "count",
      aggregation: "count",
      data: buildHistogram(rows, metric.name, 8),
    };
  }

  if (template.bucket === "experience" && xColumn && yColumn) {
    return {
      id: randomUUID(),
      type: "bar",
      title: template.title,
      xKey: xColumn.name,
      yKey: yColumn.name,
      aggregation: "avg",
      data: buildExperienceBuckets(rows, xColumn.name, yColumn.name),
    };
  }

  if (template.splitValues && xColumn) {
    return {
      id: randomUUID(),
      type: template.type || "bar",
      title: template.title,
      xKey: xColumn.name,
      yKey: "count",
      aggregation: "count",
      data: countSplitValues(rows, xColumn.name, template.limit || 10),
    };
  }

  return {
    id: randomUUID(),
    type: template.type || "bar",
    title: template.title,
    xKey: xColumn.name,
    yKey: template.aggregation === "count" ? "count" : yColumn.name,
    aggregation: template.aggregation || "count",
    data: groupByAggregate(
      rows,
      xColumn.name,
      yColumn?.name || xColumn.name,
      template.aggregation || "count",
      template.limit || 10,
    ),
  };
}

function findSimilarMemory(domain, signature) {
  const best = readMemory()
    .filter((entry) => entry.domain === domain)
    .map((entry) => ({
      ...entry,
      similarity: similarity(entry.columnSignature, signature),
    }))
    .sort((a, b) => b.similarity - a.similarity)[0];

  if (!best || best.similarity < 0.65) return null;
  return best;
}

function savePattern({ domain, schema, kpis, charts }) {
  const memory = readMemory();
  const signature = schema.columnSignature;
  const existing = memory.find((entry) => entry.domain === domain && entry.columnSignature === signature);

  const item = {
    id: existing?.id || randomUUID(),
    domain,
    columnSignature: signature,
    schemaColumns: schema.columns.map((column) => ({ name: column.name, type: column.type })),
    kpiTemplates: kpis.map((kpi) => ({
      title: kpi.title,
      metric: kpi.metric,
      aggregation: kpi.aggregation,
    })),
    chartTemplates: charts.map((chart) => ({
      title: chart.title,
      type: chart.type,
      xKey: chart.xKey,
      yKey: chart.yKey,
      aggregation: chart.aggregation,
    })),
    feedback: existing?.feedback || [],
    usageCount: existing ? existing.usageCount + 1 : 1,
    createdAt: existing?.createdAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };

  const next = existing
    ? memory.map((entry) => (entry.id === existing.id ? item : entry))
    : [...memory, item];

  writeMemory(next);
  return item;
}

function buildInsights(rows, schema, domain, kpis, charts) {
  const numericColumns = schema.columns.filter((column) => column.type === "number");
  const categoricalColumns = schema.columns.filter((column) => column.type === "string");

  const insights = [
    {
      type: "summary",
      title: "Dataset Overview",
      message: `Detected ${PLAYBOOKS[domain]?.label || "General Analytics"} with ${rows.length.toLocaleString()} rows and ${schema.columns.length} columns.`,
    },
  ];

  if (numericColumns.length) {
    const firstMetric = numericColumns[0];
    const values = rows.map((row) => row[firstMetric.name]);
    insights.push({
      type: "metric",
      title: `${humanize(firstMetric.name)} Range`,
      message: `${humanize(firstMetric.name)} ranges from ${formatValue(firstMetric.name, aggregate(values, "min"))} to ${formatValue(firstMetric.name, aggregate(values, "max"))}.`,
    });
  }

  if (categoricalColumns.length) {
    const firstDimension = categoricalColumns[0];
    const values = rows.map((row) => row[firstDimension.name]).filter((value) => !isMissing(value));
    const unique = new Set(values.map(String)).size;
    insights.push({
      type: "dimension",
      title: `${humanize(firstDimension.name)} Coverage`,
      message: `${humanize(firstDimension.name)} contains ${unique.toLocaleString()} unique values.`,
    });
  }

  insights.push({
    type: "dashboard",
    title: "Dashboard Generated",
    message: `Generated ${kpis.length} KPI cards and ${charts.length} charts using schema-safe analytics rules.`,
  });

  return insights;
}

export async function analyzeDatasetWithAnalyticsBrain(dataset = {}) {
  const rows = cleanRows(dataset.rows || []);
  const columns = inferColumns(dataset.columns || [], rows);
  const schema = buildSafeSchemaPacket(dataset, rows, columns);
  const domain = detectDomain(schema);
  const basePlaybook = PLAYBOOKS[domain] || PLAYBOOKS.generic;
  const remembered = findSimilarMemory(domain, schema.columnSignature);

  const kpiTemplates = remembered?.kpiTemplates?.length ? remembered.kpiTemplates : basePlaybook.kpis;
  const chartTemplates = remembered?.chartTemplates?.length ? remembered.chartTemplates : basePlaybook.charts;

  const kpis = kpiTemplates
    .map((template) => {
      if (template.metric && typeof template.metric === "string") {
        return buildKpi(rows, schema, { ...template, metric: [template.metric] });
      }
      return buildKpi(rows, schema, template);
    })
    .filter(Boolean)
    .slice(0, 8);

  const charts = chartTemplates
    .map((template) => {
      if (template.xKey || template.yKey) {
        return buildChart(rows, schema, {
          type: template.type,
          title: template.title,
          x: [template.xKey],
          y: [template.yKey],
          aggregation: template.aggregation || "count",
        });
      }
      return buildChart(rows, schema, template);
    })
    .filter((chart) => chart && chart.data && chart.data.length)
    .slice(0, 12);

  const savedPattern = savePattern({ domain, schema, kpis, charts });

  return {
    success: true,
    schemaOnly: true,
    dataType: domain,
    dataTypeLabel: basePlaybook.label,
    rowCount: rows.length,
    columnCount: columns.length,
    kpis,
    chartRecommendations: charts,
    insights: buildInsights(rows, schema, domain, kpis, charts),
    memory: {
      usedPreviousPattern: Boolean(remembered),
      similarity: remembered?.similarity || 0,
      patternId: savedPattern.id,
      usageCount: savedPattern.usageCount,
      domain,
      columnSignature: schema.columnSignature,
    },
    privacy: {
      rawRowsSentToAI: false,
      schemaOnly: true,
    },
  };
}

export function saveAnalyticsBrainFeedback({ patternId, action, rating, note }) {
  const next = readMemory().map((entry) => {
    if (entry.id !== patternId) return entry;

    return {
      ...entry,
      feedback: [
        ...(entry.feedback || []),
        {
          id: randomUUID(),
          action,
          rating,
          note,
          createdAt: new Date().toISOString(),
        },
      ],
      lastUsedAt: new Date().toISOString(),
    };
  });

  writeMemory(next);
  return { success: true };
}

export function getAnalyticsBrainMemory() {
  return readMemory();
}
