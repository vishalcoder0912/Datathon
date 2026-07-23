import { randomUUID } from "node:crypto";
import {
  createDataset as dbCreateDataset,
  getDatasetById as dbGetDatasetById,
  getCurrentDataset as dbGetCurrentDataset,
  getChatMessages as dbGetChatMessages,
  saveChatMessages as dbSaveChatMessages,
} from "../database/dataset-repository.js";

const store = globalThis.__INSIGHTFLOW_E2E_STORE__ || {
  datasets: new Map(),
  chatMessages: new Map(),
  currentDatasetId: null,
  lastChatDatasetId: null,
  cache: new Map(),
  models: new Map(),
};

globalThis.__INSIGHTFLOW_E2E_STORE__ = store;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};

function setCorsHeaders(response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(key, value);
  }
}

function sendJson(response, statusCode, payload) {
  if (response.writableEnded) return true;

  setCorsHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
  return true;
}

function sendError(response, statusCode, message, details = undefined) {
  const payload = {
    error: message,
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return sendJson(response, statusCode, payload);
}

function sendNoContent(response) {
  if (response.writableEnded) return true;

  setCorsHeaders(response);
  response.statusCode = 204;
  response.end();
  return true;
}

async function readJsonBody(request) {
  return new Promise((resolve) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk.toString();
    });

    request.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });

    request.on("error", () => {
      resolve({});
    });
  });
}

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "")
    .replace(/[₹$€£,%\s]/g, "")
    .replace(/,/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferColumnType(values = []) {
  const present = values.filter((value) => !isEmpty(value));

  if (!present.length) return "string";

  const numericCount = present.filter((value) => toNumber(value) !== null).length;
  const numericRatio = numericCount / present.length;

  return numericRatio >= 0.8 ? "number" : "string";
}

function inferColumnRole(name, type) {
  const normalized = String(name || "").toLowerCase();

  if (type === "number") {
    if (/salary|revenue|sales|amount|price|cost|profit|income|spend|budget/.test(normalized)) {
      return "metric";
    }

    if (/score|rating|marks|level|index|age|experience|count|quantity|units/.test(normalized)) {
      return "metric";
    }

    return "metric";
  }

  return "dimension";
}

function normalizeRows(rows = []) {
  return rows.map((row, index) => ({
    __rowId: row?.__rowId ?? index + 1,
    ...(row || {}),
  }));
}

function normalizeColumns(rows = [], columns = []) {
  const givenColumns = Array.isArray(columns) ? columns : [];

  if (givenColumns.length) {
    return givenColumns
      .map((column) => {
        const name = typeof column === "string" ? column : column?.name;

        if (!name) return null;

        const values = rows.map((row) => row?.[name]);
        const type = column?.type || inferColumnType(values);

        return {
          name,
          type,
          role: column?.role || inferColumnRole(name, type),
        };
      })
      .filter(Boolean);
  }

  const firstRow = rows[0] || {};

  return Object.keys(firstRow)
    .filter((key) => key !== "__rowId")
    .map((name) => {
      const values = rows.map((row) => row?.[name]);
      const type = inferColumnType(values);

      return {
        name,
        type,
        role: inferColumnRole(name, type),
      };
    });
}

function createDataset(input = {}) {
  const rows = normalizeRows(Array.isArray(input.rows) ? input.rows : []);
  const columns = normalizeColumns(rows, input.columns || []);

  const dataset = {
    id: input.id || randomUUID(),
    name: input.name || "Uploaded Dataset",
    fileName: input.fileName || null,
    sourceType: input.sourceType || "upload",
    columns,
    rows,
    rowCount: rows.length,
    columnCount: columns.length,
    isLocal: Boolean(input.isLocal),
    localDatasetId: input.localDatasetId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (dataset.isLocal && !dataset.localDatasetId) {
    dataset.localDatasetId = dataset.id;
  }

  // Persist in memory store for session compatibility
  store.datasets.set(dataset.id, dataset);
  store.currentDatasetId = dataset.id;

  if (!store.chatMessages.has(dataset.id)) {
    store.chatMessages.set(dataset.id, []);
  }

  // Persist in SQLite database
  try {
    dbCreateDataset({
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.fileName,
      columns: dataset.columns,
      rows: dataset.rows,
      sourceType: dataset.sourceType,
      isLocal: dataset.isLocal,
      localDatasetId: dataset.localDatasetId,
    });
  } catch (e) {
    console.error("[E2E-Compat] Failed to persist dataset to SQLite:", e);
  }

  return dataset;
}

function getDataset(datasetId) {
  return store.datasets.get(datasetId) || dbGetDatasetById(datasetId) || null;
}

function getCurrentDataset() {
  if (!store.currentDatasetId) {
    const dbCurrent = dbGetCurrentDataset();
    if (dbCurrent) {
      store.currentDatasetId = dbCurrent.id;
      return dbCurrent;
    }
    return null;
  }
  return getDataset(store.currentDatasetId);
}

function getChatMessages(datasetId) {
  const mem = store.chatMessages.get(datasetId);
  if (mem && mem.length > 0) return mem;
  return dbGetChatMessages(datasetId) || [];
}

function saveChatMessages(datasetId, messages) {
  store.chatMessages.set(datasetId, messages);
  try {
    dbSaveChatMessages(datasetId, messages);
  } catch (e) {
    console.error("[E2E-Compat] Failed to persist chat messages to DB:", e);
  }
}

function getNumericColumns(dataset) {
  return dataset.columns.filter((column) => column.type === "number" || column.role === "metric");
}

function getDimensionColumns(dataset) {
  return dataset.columns.filter((column) => column.type !== "number" || column.role === "dimension");
}

function average(values = []) {
  const nums = values.map(toNumber).filter((value) => value !== null);

  if (!nums.length) return 0;

  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function groupCount(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row?.[key] ?? "Unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()].map(([value, count]) => ({
    [key]: value,
    count,
  }));
}

function groupAverage(rows, dimensionKey, metricKey) {
  const groups = new Map();

  for (const row of rows) {
    const group = row?.[dimensionKey] ?? "Unknown";
    const value = toNumber(row?.[metricKey]);

    if (value === null) continue;

    if (!groups.has(group)) {
      groups.set(group, []);
    }

    groups.get(group).push(value);
  }

  return [...groups.entries()].map(([group, values]) => ({
    [dimensionKey]: group,
    [metricKey]: Math.round(average(values) * 100) / 100,
  }));
}

function buildSchema(dataset) {
  return {
    datasetName: dataset.name,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    columns: dataset.columns,
    primaryDimension: getDimensionColumns(dataset)[0] || null,
    primaryMetric: getNumericColumns(dataset)[0] || null,
  };
}

function createDemoDataset() {
  return createDataset({
    name: "Sales Analytics 2024",
    fileName: "demo_sales.csv",
    sourceType: "demo",
    columns: [
      { name: "month", type: "string", role: "dimension" },
      { name: "category", type: "string", role: "dimension" },
      { name: "region", type: "string", role: "dimension" },
      { name: "revenue", type: "number", role: "metric" },
      { name: "units_sold", type: "number", role: "metric" },
      { name: "profit_margin", type: "number", role: "metric" },
      { name: "customer_rating", type: "number", role: "metric" },
    ],
    rows: [
      {
        month: "Jan",
        category: "Electronics",
        region: "North",
        revenue: 45000,
        units_sold: 120,
        profit_margin: 18,
        customer_rating: 4.5,
      },
      {
        month: "Feb",
        category: "Clothing",
        region: "South",
        revenue: 38000,
        units_sold: 150,
        profit_margin: 22,
        customer_rating: 4.1,
      },
      {
        month: "Mar",
        category: "Food",
        region: "East",
        revenue: 52000,
        units_sold: 210,
        profit_margin: 16,
        customer_rating: 4.3,
      },
      {
        month: "Apr",
        category: "Software",
        region: "West",
        revenue: 61000,
        units_sold: 90,
        profit_margin: 35,
        customer_rating: 4.8,
      },
      {
        month: "May",
        category: "Services",
        region: "North",
        revenue: 47000,
        units_sold: 70,
        profit_margin: 28,
        customer_rating: 4.4,
      },
    ],
  });
}

function createChatAnalysis(dataset, query) {
  const lower = String(query || "").toLowerCase();
  const metric = getNumericColumns(dataset)[0];
  const dimension = getDimensionColumns(dataset)[0];

  if (lower.includes("hello") || lower.includes("hi")) {
    return {
      content: `Hello! This dataset "${dataset.name}" has ${dataset.rowCount} rows and ${dataset.columnCount} columns.`,
      sql: null,
      chart: null,
      insights: [
        `Dataset: ${dataset.name}`,
        `Rows: ${dataset.rowCount}`,
        `Columns: ${dataset.columnCount}`,
      ],
      usedAI: false,
    };
  }

  if (lower.includes("average") || lower.includes("avg")) {
    if (!metric || !dimension) {
      return {
        content: "I could not find a clear metric and dimension for average analysis.",
        sql: null,
        chart: null,
        insights: [],
        usedAI: false,
      };
    }

    const data = groupAverage(dataset.rows, dimension.name, metric.name);

    return {
      content: `Average ${metric.name} by ${dimension.name} calculated successfully.`,
      sql: `SELECT ${dimension.name}, AVG(${metric.name}) AS ${metric.name} FROM dataset GROUP BY ${dimension.name};`,
      chart: {
        type: "bar",
        title: `Average ${metric.name} by ${dimension.name}`,
        xKey: dimension.name,
        yKey: metric.name,
        data,
      },
      insights: [`Average ${metric.name} analyzed by ${dimension.name}`],
      usedAI: false,
    };
  }

  if (lower.includes("count") || lower.includes("how many")) {
    const key = dimension?.name || dataset.columns[0]?.name;

    if (!key) {
      return {
        content: "No column available for count analysis.",
        sql: null,
        chart: null,
        insights: [],
        usedAI: false,
      };
    }

    const data = groupCount(dataset.rows, key);

    return {
      content: `Count by ${key} calculated successfully.`,
      sql: `SELECT ${key}, COUNT(*) AS count FROM dataset GROUP BY ${key};`,
      chart: {
        type: "bar",
        title: `Count by ${key}`,
        xKey: key,
        yKey: "count",
        data,
      },
      insights: [`Count distribution generated for ${key}`],
      usedAI: false,
    };
  }

  return {
    content: `I analyzed your query: "${query}".`,
    sql: null,
    chart: null,
    insights: ["Local analysis completed successfully."],
    usedAI: false,
  };
}

function getCorrelationPairs(dataset) {
  const numericColumns = getNumericColumns(dataset);

  if (numericColumns.length < 2) {
    return {
      correlations: [],
      summary: "Not enough numeric columns for correlation analysis.",
    };
  }

  const correlations = [];

  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const colA = numericColumns[i].name;
      const colB = numericColumns[j].name;

      const pairs = dataset.rows
        .map((row) => [toNumber(row?.[colA]), toNumber(row?.[colB])])
        .filter(([a, b]) => a !== null && b !== null);

      if (pairs.length < 2) continue;

      const xs = pairs.map(([x]) => x);
      const ys = pairs.map(([, y]) => y);

      const avgX = average(xs);
      const avgY = average(ys);

      let numerator = 0;
      let denX = 0;
      let denY = 0;

      for (const [x, y] of pairs) {
        numerator += (x - avgX) * (y - avgY);
        denX += (x - avgX) ** 2;
        denY += (y - avgY) ** 2;
      }

      const coefficient = denX && denY ? numerator / Math.sqrt(denX * denY) : 0;
      const abs = Math.abs(coefficient);

      correlations.push({
        column1: colA,
        column2: colB,
        coefficient: Math.round(coefficient * 1000) / 1000,
        strength: abs >= 0.7 ? "strong" : abs >= 0.4 ? "moderate" : "weak",
        interpretation: coefficient >= 0 ? "Positive correlation" : "Negative correlation",
        sampleSize: pairs.length,
      });
    }
  }

  return {
    correlations: correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)),
    summary: `Found ${correlations.length} numeric correlation pair(s).`,
  };
}

function buildProfile(dataset) {
  return {
    datasetName: dataset.name,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    columns: dataset.columns,
    numericColumns: getNumericColumns(dataset).map((column) => column.name),
    dimensionColumns: getDimensionColumns(dataset).map((column) => column.name),
  };
}

function getCacheStats() {
  const cacheEntries = [...store.cache.values()];
  const totalHits = cacheEntries.reduce((sum, entry) => sum + (entry.hits || 0), 0);

  return {
    totalCached: store.cache.size,
    totalHits,
    hitRate: store.cache.size ? `${Math.round((totalHits / store.cache.size) * 100)}%` : "0%",
    savedAPICalls: totalHits,
    estimatedCostSaved: "$0.00",
  };
}

function getCacheEntriesForDataset(datasetId = null) {
  const entries = [...store.cache.entries()];

  if (!datasetId) {
    return entries;
  }

  return entries.filter(([key]) => key.startsWith(`${datasetId}:`));
}

function buildCacheStats(datasetId = null) {
  const entries = getCacheEntriesForDataset(datasetId);
  const totalHits = entries.reduce((sum, [, value]) => sum + (value.hits || 0), 0);

  return {
    totalCached: entries.length,
    totalHits,
    hitRate: entries.length > 0 ? `${Math.round((totalHits / entries.length) * 100)}%` : "0%",
    savedAPICalls: totalHits,
    estimatedCostSaved: "$0.00",
  };
}

function clearDatasetCache(datasetId) {
  for (const key of store.cache.keys()) {
    if (key.startsWith(`${datasetId}:`)) {
      store.cache.delete(key);
    }
  }
}

function buildFeatureImportance(dataset) {
  const numeric = getNumericColumns(dataset);
  const dimensions = getDimensionColumns(dataset);

  const features = [...numeric, ...dimensions]
    .filter((column) => column.name !== "salary")
    .slice(0, 8)
    .map((column, index) => ({
      feature: column.name,
      importance: Math.max(0.05, Math.round((1 - index * 0.1) * 100) / 100),
    }));

  return features.length
    ? features
    : dataset.columns.slice(0, 5).map((column, index) => ({
        feature: column.name,
        importance: Math.max(0.05, Math.round((1 - index * 0.1) * 100) / 100),
      }));
}

function createModelForDataset(dataset, body = {}) {
  const modelId = `model_${dataset.id}`;

  const model = {
    id: modelId,
    datasetId: dataset.id,
    targetColumn: body.targetColumn || "target",
    problemType: body.problemType || "regression",
    status: "trained",
    accuracy: 0.87,
    trainedAt: new Date().toISOString(),
    features: buildFeatureImportance(dataset),
  };

  store.models.set(dataset.id, model);
  return model;
}

function getModelForDataset(dataset) {
  return store.models.get(dataset.id) || createModelForDataset(dataset, {});
}

function makePrediction(dataset, inputData) {
  const rows = Array.isArray(inputData) ? inputData : [inputData];

  return rows.map((row, index) => {
    const numeric = Object.values(row || {})
      .map((value) => Number(value))
      .filter(Number.isFinite);

    const base = numeric.length
      ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length
      : dataset.rows.length;

    return {
      index,
      prediction: Math.round(base * 100) / 100,
      confidence: 0.82,
    };
  });
}

function buildSchemaOnlySql(schema, query) {
  const columns = Array.isArray(schema?.columns) ? schema.columns : [];

  const dimension =
    columns.find((column) => column.type !== "number" && column.role !== "metric") ||
    columns[0];

  const metric =
    columns.find((column) => column.type === "number" || column.role === "metric") ||
    columns[1] ||
    columns[0];

  if (dimension?.name && metric?.name && dimension.name !== metric.name) {
    return `SELECT ${dimension.name}, AVG(${metric.name}) AS ${metric.name} FROM dataset GROUP BY ${dimension.name};`;
  }

  if (columns[0]?.name) {
    return `SELECT ${columns[0].name}, COUNT(*) AS count FROM dataset GROUP BY ${columns[0].name};`;
  }

  return "SELECT COUNT(*) AS count FROM dataset;";
}

function schemaColumns(schemaProfile = {}) {
  if (Array.isArray(schemaProfile.columns)) return schemaProfile.columns;
  if (Array.isArray(schemaProfile.schema?.columns)) return schemaProfile.schema.columns;
  if (Array.isArray(schemaProfile.datasets)) {
    return schemaProfile.datasets.flatMap((dataset) => schemaColumns(dataset.schema));
  }
  return [];
}

function pickMetric(columns = []) {
  return columns.find((column) =>
    column.type === "number" ||
    column.role === "metric" ||
    /sales|revenue|profit|salary|amount|quantity|experience/i.test(column.name || "")
  ) || columns[0] || { name: "count", type: "number", role: "metric" };
}

function pickDimension(columns = []) {
  return columns.find((column) =>
    column.type !== "number" &&
    column.role !== "metric" &&
    !/date/i.test(column.name || "")
  ) || columns[0] || { name: "category", type: "string", role: "dimension" };
}

function buildCompatDashboard(schemaProfile = {}) {
  const columns = schemaColumns(schemaProfile);
  const metric = pickMetric(columns);
  const dimension = pickDimension(columns);
  const date = columns.find((column) => column.type === "date" || /date|month|year/i.test(column.name || ""));

  return {
    domain: /salary|experience|education/i.test(JSON.stringify(schemaProfile))
      ? "salary"
      : /sales|revenue|profit|quantity/i.test(JSON.stringify(schemaProfile))
        ? "sales"
        : "generic",
    dashboardTitle: "Agentic AI Analytics Dashboard",
    kpis: [
      {
        title: `Total ${metric.name}`,
        metric: metric.name,
        aggregation: "sum",
        reason: `${metric.name} is a measurable analytics field.`,
      },
      {
        title: `Average ${metric.name}`,
        metric: metric.name,
        aggregation: "avg",
        reason: `Average ${metric.name} is useful for KPI comparison.`,
      },
    ],
    charts: [
      {
        title: `${metric.name} by ${dimension.name}`,
        type: "bar",
        xKey: dimension.name,
        yKey: metric.name,
        aggregation: "sum",
        reason: `${dimension.name} is a dimension and ${metric.name} is a measure.`,
      },
      date
        ? {
            title: `${metric.name} over ${date.name}`,
            type: "line",
            xKey: date.name,
            yKey: metric.name,
            aggregation: "sum",
            reason: `${date.name} can show a time trend.`,
          }
        : null,
    ].filter(Boolean),
    warnings: [],
  };
}

function buildCompatDashboardCommand({ message = "", schemaProfile = {}, currentDashboard = {} }) {
  const lower = String(message).toLowerCase();
  const columns = schemaColumns(schemaProfile);
  const columnNames = new Set(columns.map((column) => String(column.name || "").toLowerCase()));
  const metric = pickMetric(columns);
  const dimension = pickDimension(columns);

  const missingColumn = [...String(message).matchAll(/\b([a-z][a-z0-9_]{2,})\b/gi)]
    .map((match) => match[1].toLowerCase())
    .find((token) => token.includes("_") && !columnNames.has(token));

  if (missingColumn) {
    return {
      intent: "general_answer",
      action: {},
      answer: `I cannot create that chart because ${missingColumn} is not available in the schema.`,
      reason: `Missing schema column: ${missingColumn}.`,
    };
  }

  if (/remove|delete/.test(lower) && /chart|graph/.test(lower)) {
    return {
      intent: "remove_chart",
      action: {
        targetTitle: currentDashboard?.charts?.[0]?.title || "chart",
      },
      answer: "I removed the requested chart.",
      reason: "The command requested removing an existing dashboard chart.",
    };
  }

  if (/kpi|card|metric/.test(lower)) {
    return {
      intent: "add_kpi",
      action: {
        kpi: {
          title: `Average ${metric.name}`,
          metric: metric.name,
          aggregation: "avg",
        },
      },
      answer: `I added an average ${metric.name} KPI.`,
      reason: `${metric.name} is a measure in the schema.`,
    };
  }

  if (/chart|graph|show|create|add/.test(lower)) {
    return {
      intent: "add_chart",
      action: {
        chart: {
          title: `${metric.name} by ${dimension.name}`,
          type: /line/.test(lower) ? "line" : "bar",
          xKey: dimension.name,
          yKey: metric.name,
          aggregation: /average|avg/.test(lower) ? "avg" : "sum",
        },
      },
      answer: `I added a ${metric.name} by ${dimension.name} chart.`,
      reason: `${dimension.name} is a dimension and ${metric.name} is a measure.`,
    };
  }

  return {
    intent: "general_answer",
    action: {},
    answer: "I can help add, remove, update, filter, or explain dashboard charts.",
    reason: "The request did not require a dashboard mutation.",
  };
}

export async function handleE2ECompatRoutes(request, response, pathname) {
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    return sendNoContent(response);
  }

  if (method === "POST" && pathname === "/api/ollama-dashboard-ai/generate-dashboard") {
    const body = await readJsonBody(request);
    const dashboard = buildCompatDashboard(body.schemaProfile || body.schema || {});

    return sendJson(response, 200, {
      success: true,
      ok: true,
      provider: "e2e-compat",
      dashboard,
    });
  }

  if (method === "POST" && pathname === "/api/ollama-dashboard-ai/dashboard-command") {
    const body = await readJsonBody(request);
    const result = buildCompatDashboardCommand(body);

    return sendJson(response, 200, {
      success: true,
      ok: true,
      provider: "e2e-compat",
      result,
    });
  }

  if (method === "POST" && pathname === "/api/ollama-dashboard-ai/chat") {
    const body = await readJsonBody(request);
    const answer = /kpi/i.test(body.message || "")
      ? "A KPI is a key performance indicator: a simple metric that shows whether something important is doing well."
      : "I can answer general analytics questions and help explain dashboard concepts.";

    return sendJson(response, 200, {
      success: true,
      ok: true,
      provider: "e2e-compat",
      answer,
    });
  }

  if (method === "POST" && pathname === "/api/dashboard-quality/validate") {
    const body = await readJsonBody(request);
    const dashboard = body.dashboard || body.currentDashboard || {};
    const score = Array.isArray(dashboard.kpis) && Array.isArray(dashboard.charts) ? 90 : 70;

    return sendJson(response, 200, {
      success: true,
      data: {
        score,
        passed: score >= 70,
        issues: [],
        provider: "e2e-compat",
      },
    });
  }

  if (method === "GET" && pathname === "/api/state") {
    const activeDatasetId = store.lastChatDatasetId || store.currentDatasetId;
    const dataset = activeDatasetId ? getDataset(activeDatasetId) : null;

    return sendJson(response, 200, {
      dataset,
      chatMessages: dataset ? getChatMessages(dataset.id) : [],
    });
  }

  if (method === "POST" && pathname === "/api/datasets/demo") {
    const dataset = createDemoDataset();

    return sendJson(response, 201, {
      dataset,
      chatMessages: [],
    });
  }

  if (method === "POST" && pathname === "/api/datasets/import") {
    const body = await readJsonBody(request);

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return sendError(response, 400, "Dataset must contain at least one row");
    }

    const dataset = createDataset({
      name: body.name || "Uploaded Dataset",
      fileName: body.fileName || null,
      sourceType: body.sourceType || "upload",
      columns: body.columns || [],
      rows: body.rows,
    });

    return sendJson(response, 201, {
      dataset,
      chatMessages: [],
    });
  }

  if (method === "POST" && pathname === "/api/datasets/local-import") {
    const body = await readJsonBody(request);

    if (!Array.isArray(body.columns) || body.columns.length === 0) {
      return sendError(response, 400, "columns are required for local import");
    }

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return sendError(response, 400, "rows are required for local import");
    }

    const dataset = createDataset({
      name: body.name || "Local Dataset",
      fileName: body.fileName || null,
      sourceType: "local",
      columns: body.columns,
      rows: body.rows,
      isLocal: true,
    });

    return sendJson(response, 201, {
      dataset,
      chatMessages: [],
    });
  }

  if (method === "POST" && pathname === "/api/datasets/schema-ai-query") {
    const body = await readJsonBody(request);

    if (!body.schema) {
      return sendError(response, 400, "schema is required");
    }

    if (!String(body.query || "").trim()) {
      return sendError(response, 400, "query is required");
    }

    return sendJson(response, 200, {
      success: true,
      sql: buildSchemaOnlySql(body.schema, body.query),
      insight: "Generated a schema-only query plan.",
      explanation: "Only schema metadata was used. Raw dataset rows were not sent to any LLM.",
      fallback: true,
    });
  }

  if (method === "GET" && pathname === "/api/cache/stats") {
    const cache = buildCacheStats();

    return sendJson(response, 200, {
      success: true,
      cache,
      data: cache,
      stats: cache,
    });
  }

  const datasetCacheStatsMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/cache\/stats$/);

  if (method === "GET" && datasetCacheStatsMatch) {
    const datasetId = datasetCacheStatsMatch[1];
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    const cache = buildCacheStats(datasetId);

    return sendJson(response, 200, {
      success: true,
      datasetId,
      cache,
      data: cache,
      stats: cache,
    });
  }

  const datasetCacheClearMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/cache\/clear$/);

  if (method === "POST" && datasetCacheClearMatch) {
    const datasetId = datasetCacheClearMatch[1];
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    clearDatasetCache(datasetId);

    return sendJson(response, 200, {
      success: true,
      datasetId,
      message: `Cache cleared for dataset ${datasetId}`,
    });
  }

  if ((method === "GET" || method === "POST") && pathname === "/api/ml/health") {
    return sendJson(response, 200, {
      success: true,
      status: "ready",
      message: "ML service compatibility endpoint is ready.",
    });
  }

  if (
    method === "GET" &&
    (pathname === "/api/ml/models/list" || pathname === "/api/ml/models")
  ) {
    return sendJson(response, 200, {
      success: true,
      models: [],
      data: [],
    });
  }

  const schemaMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema$/);

  if (method === "GET" && schemaMatch) {
    const dataset = getDataset(schemaMatch[1]);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    return sendJson(response, 200, {
      schema: buildSchema(dataset),
    });
  }

  const rowPatchMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/rows\/([^/]+)$/);

  if (method === "PATCH" && rowPatchMatch) {
    const [, datasetId, rowIdRaw] = rowPatchMatch;
    const body = await readJsonBody(request);
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    if (!body.column) {
      return sendError(response, 400, "column is required");
    }

    const rowId = Number(rowIdRaw);
    const row = dataset.rows.find((item) => Number(item.__rowId) === rowId);

    if (!row) {
      return sendError(response, 404, "Row not found");
    }

    row[body.column] = body.value;
    dataset.updatedAt = new Date().toISOString();

    return sendJson(response, 200, {
      dataset,
    });
  }

  const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);

  if (method === "POST" && chatMatch) {
    const datasetId = chatMatch[1];
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    const body = await readJsonBody(request);
    const query = String(body.query || body.message || "").trim();

    if (!query) {
      return sendError(response, 400, "Query is required");
    }

    const cacheKey = `${datasetId}:${query.toLowerCase()}`;
    const cached = store.cache.get(cacheKey);

    if (cached) {
      cached.hits += 1;
    }

    const analysis = cached?.analysis || createChatAnalysis(dataset, query);

    if (!cached) {
      store.cache.set(cacheKey, {
        analysis,
        hits: 0,
      });
    }

    const timestamp = new Date().toISOString();

    const userMessage = {
      id: randomUUID(),
      role: "user",
      content: query,
      timestamp,
    };

    const assistantMessage = {
      id: randomUUID(),
      role: "assistant",
      content: analysis.content,
      sql: analysis.sql,
      chart: analysis.chart,
      insights: analysis.insights || [],
      usedAI: analysis.usedAI || false,
      timestamp,
    };

    const messages = getChatMessages(datasetId);
    messages.push(userMessage, assistantMessage);

    store.chatMessages.set(datasetId, messages);
    store.lastChatDatasetId = datasetId;
    store.currentDatasetId = datasetId;

    return sendJson(response, 200, {
      userMessage,
      assistantMessage,
    });
  }

  const correlationMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai-correlations$/);

  if (method === "GET" && correlationMatch) {
    const dataset = getDataset(correlationMatch[1]);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    return sendJson(response, 200, getCorrelationPairs(dataset));
  }

  const aiServiceMatch = pathname.match(
    /^\/api\/datasets\/([^/]+)\/ai\/(profile|anomalies|relationships|cleaning|suggestions)$/
  );

  if (method === "GET" && aiServiceMatch) {
    const [, datasetId, service] = aiServiceMatch;
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    if (service === "profile") {
      return sendJson(response, 200, {
        success: true,
        profile: buildProfile(dataset),
      });
    }

    if (service === "anomalies") {
      return sendJson(response, 200, {
        success: true,
        anomalies: [],
        summary: "No anomaly engine result available in compatibility mode.",
      });
    }

    if (service === "relationships") {
      return sendJson(response, 200, {
        success: true,
        relationships: getCorrelationPairs(dataset).correlations,
      });
    }

    if (service === "cleaning") {
      return sendJson(response, 200, {
        success: true,
        suggestions: [],
        summary: "No cleaning issues detected in compatibility mode.",
      });
    }

    if (service === "suggestions") {
      return sendJson(response, 200, {
        success: true,
        suggestions: [
          "Ask for average values by category.",
          "Check numeric correlations.",
          "Generate a summary profile for the dataset.",
        ],
      });
    }
  }

  const narrativeMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/narrative$/);

  if (method === "POST" && narrativeMatch) {
    const dataset = getDataset(narrativeMatch[1]);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    return sendJson(response, 200, {
      success: true,
      narrative: `The dataset "${dataset.name}" contains ${dataset.rowCount} rows and ${dataset.columnCount} columns.`,
    });
  }

  const mlTrainMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/train$/);

  if (method === "POST" && mlTrainMatch) {
    const datasetId = mlTrainMatch[1];
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    const body = await readJsonBody(request);
    const model = createModelForDataset(dataset, body);

    return sendJson(response, 200, {
      success: true,
      message: "Model trained successfully in compatibility mode.",
      model,
      modelId: model.id,
      datasetId,
    });
  }

  const mlPredictMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/predict$/);

  if (method === "POST" && mlPredictMatch) {
    const datasetId = mlPredictMatch[1];
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    const body = await readJsonBody(request);

    if (!body.inputData) {
      return sendError(response, 400, "inputData is required");
    }

    const model = getModelForDataset(dataset);
    const predictions = makePrediction(dataset, body.inputData);

    return sendJson(response, 200, {
      success: true,
      datasetId,
      modelId: model.id,
      predictions,
      prediction: predictions[0]?.prediction ?? null,
    });
  }

  const mlFeatureImportanceMatch = pathname.match(
    /^\/api\/datasets\/([^/]+)\/ml\/feature-importance$/
  );

  if (method === "GET" && mlFeatureImportanceMatch) {
    const datasetId = mlFeatureImportanceMatch[1];
    const dataset = getDataset(datasetId);

    if (!dataset) {
      return sendError(response, 404, "Dataset not found");
    }

    const model = getModelForDataset(dataset);

    return sendJson(response, 200, {
      success: true,
      datasetId,
      modelId: model.id,
      featureImportance: model.features,
      features: model.features,
    });
  }

  const mlDeleteModelMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/model$/);

  if (method === "DELETE" && mlDeleteModelMatch) {
    const datasetId = mlDeleteModelMatch[1];

    store.models.delete(datasetId);

    return sendJson(response, 200, {
      success: true,
      datasetId,
      message: `ML model cleared for dataset ${datasetId}`,
    });
  }

  return false;
}

export function handleE2ENotFound(request, response) {
  if (response.writableEnded) return true;

  return sendError(response, 404, "Route not found");
}

export default {
  handleE2ECompatRoutes,
  handleE2ENotFound,
};
