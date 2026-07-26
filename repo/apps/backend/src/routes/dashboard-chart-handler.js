import { randomUUID } from "node:crypto";
import { sendSuccess, sendError } from "../utils/response-utils.js";
import { HTTP_STATUS } from "../config/constants.js";
import { getCurrentDataset, getDatasetById } from "../database/dataset-repository.js";
import { buildSchemaContext, buildRagDocuments } from "../services/ai-analyst/schema-context-builder.js";
import { buildSchemaProfile } from "../services/ai-analyst/schema-fingerprint.js";
import { parseCustomChartQuery } from "../services/agentic-dashboard/custom-chart-query-parser.js";
import { retrieveSchemaRagMemories } from "../services/ai-analyst/schema-rag-retriever.js";

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function findColumnByName(columns, name) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(name);
  return columns.find(
    (c) =>
      norm(c.name) === target ||
      norm(c.displayName) === target ||
      norm(c.name).includes(target) ||
      target.includes(norm(c.name))
  );
}

function computeChartConfidence(query, schemaContext, matchedColumn) {
  let score = 0.5;
  if (matchedColumn) score += 0.25;
  if (schemaContext?.columns?.length) score += 0.1;
  if (query.length > 5) score += 0.05;
  const chartTypes = ["bar", "line", "pie", "scatter", "area", "histogram", "donut", "map"];
  if (chartTypes.some((t) => query.toLowerCase().includes(t))) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

function buildChartSpec(type, column, schemaContext, query) {
  const isMetric = column?.role === "metric";
  const isDimension = column?.role === "dimension" || column?.role === "location";
  const isDate = column?.role === "date";

  const numericCols = schemaContext.metrics || [];
  const dimensionCols = schemaContext.dimensions || [];

  const spec = { id: randomUUID(), type: type || "bar", aggregation: "sum" };

  if (isMetric) {
    spec.yKey = column.name;
    spec.title = `${column.displayName} by Category`;
    if (dimensionCols.length) {
      spec.xKey = dimensionCols[0].name;
      spec.title = `${column.displayName} by ${dimensionCols[0].displayName}`;
    }
  } else if (isDate) {
    spec.xKey = column.name;
    spec.type = "line";
    spec.title = `${column.displayName} Trend`;
    if (numericCols.length) {
      spec.yKey = numericCols[0].name;
      spec.title = `${numericCols[0].displayName} over ${column.displayName}`;
    } else {
      spec.yKey = "__row_count__";
      spec.aggregation = "count";
      spec.title = `Records over ${column.displayName}`;
    }
  } else if (isDimension) {
    spec.xKey = column.name;
    spec.yKey = "__row_count__";
    spec.aggregation = "count";
    spec.title = `${column.displayName} Distribution`;

    if (query.toLowerCase().includes("pie")) {
      spec.type = "pie";
      spec.title = `${column.displayName} Breakdown`;
    }
    if (query.toLowerCase().includes("bar")) {
      spec.type = "bar";
    }
    if (query.toLowerCase().includes("line") || query.toLowerCase().includes("trend")) {
      spec.type = "line";
    }

    if (numericCols.length && (query.toLowerCase().includes("average") || query.toLowerCase().includes("avg") || query.toLowerCase().includes("mean") || query.toLowerCase().includes("total") || query.toLowerCase().includes("sum") || query.toLowerCase().includes("compare"))) {
      spec.yKey = numericCols[0].name;
      spec.aggregation = query.toLowerCase().includes("avg") || query.toLowerCase().includes("average") || query.toLowerCase().includes("mean") ? "avg" : "sum";
      spec.title = `${numericCols[0].displayName} by ${column.displayName}`;
      spec.type = spec.type === "pie" ? "bar" : spec.type;
    }
  } else {
    spec.xKey = column?.name || dimensionCols[0]?.name || "category";
    spec.yKey = numericCols[0]?.name || "__row_count__";
    spec.aggregation = spec.yKey === "__row_count__" ? "count" : "sum";
    spec.title = `Chart - ${column?.displayName || spec.xKey}`;
  }

  spec.chartType = spec.type;
  return spec;
}

function getColumnStats(column, schemaProfile) {
  if (!column || !schemaProfile) return null;
  const name = column.name || column.column;
  const numericSummary = schemaProfile.numericSummary?.[name];
  const categories = schemaProfile.categoryMap?.[name];

  return {
    uniqueValues: column.uniqueValues ?? categories?.length ?? 0,
    sampleValues: column.sampleValues?.slice(0, 5) || categories?.slice(0, 5) || [],
    ...(numericSummary ? { min: numericSummary.min, max: numericSummary.max, avg: numericSummary.avg, median: numericSummary.median } : {}),
  };
}

export async function handleChartQueryRequest(request, response, pathname) {
  if (request.method !== "POST" || pathname !== "/api/dashboard/chart-query") {
    return false;
  }

  try {
    const body = await readJsonBody(request);
    const query = String(body.query || "").trim();
    const datasetId = body.datasetId || body.dataset?.id;
    const existingCharts = Array.isArray(body.existingCharts) ? body.existingCharts : [];

    if (!query) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, "Query is required", "INVALID_INPUT");
      return true;
    }

    const dataset = datasetId ? getDatasetById(datasetId) : getCurrentDataset();
    if (!dataset) {
      sendError(response, HTTP_STATUS.NOT_FOUND, "No dataset found. Import a dataset first.", "DATASET_NOT_FOUND");
      return true;
    }

    const schemaContext = buildSchemaContext(dataset);
    if (!schemaContext) {
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to build schema context", "SCHEMA_ERROR");
      return true;
    }

    const schemaProfile = buildSchemaProfile(dataset);
    const ragDocs = buildRagDocuments(schemaContext);
    const ragMemories = await retrieveSchemaRagMemories(schemaProfile, { limit: 3, threshold: 0.4 });

    const deterministicAction = parseCustomChartQuery(query, schemaProfile);

    let matchedColumn = null;
    if (deterministicAction?.xKey) {
      matchedColumn = findColumnByName(schemaContext.columns, deterministicAction.xKey);
    }
    if (!matchedColumn && deterministicAction?.yKey) {
      matchedColumn = findColumnByName(schemaContext.columns, deterministicAction.yKey);
    }
    if (!matchedColumn && deterministicAction?.dimension) {
      matchedColumn = findColumnByName(schemaContext.columns, deterministicAction.dimension);
    }
    if (!matchedColumn && deterministicAction?.measure) {
      matchedColumn = findColumnByName(schemaContext.columns, deterministicAction.measure);
    }
    if (!matchedColumn) {
      matchedColumn = findColumnByName(schemaContext.columns, query);
    }
    if (!matchedColumn && schemaContext.columns.length) {
      for (const col of schemaContext.columns) {
        const check = findColumnByName(schemaContext.columns, col.name);
        if (check) { matchedColumn = check; break; }
      }
    }

    let chartSpec;
    if (deterministicAction && deterministicAction.action === "create_chart") {
      chartSpec = {
        id: randomUUID(),
        type: deterministicAction.chart_type || "bar",
        chartType: deterministicAction.chart_type || "bar",
        xKey: deterministicAction.xKey,
        yKey: deterministicAction.yKey,
        aggregation: deterministicAction.aggregation || "sum",
        title: deterministicAction.title
      };
    } else {
      const chartType = (deterministicAction && (deterministicAction.chartType || deterministicAction.chart_type)) || "bar";
      chartSpec = buildChartSpec(chartType, matchedColumn, schemaContext, query);
    }
    const confidence = deterministicAction
      ? 0.9
      : computeChartConfidence(query, schemaContext, matchedColumn);
    const columnStats = getColumnStats(matchedColumn, schemaProfile);

    const ragContext = {
      matchedViaRag: !!deterministicAction,
      ragMemoryCount: ragMemories.length,
      instructionsUsed: schemaContext.aiInstructions?.slice(0, 3),
    };

    sendSuccess(response, {
      chart: chartSpec,
      confidence,
      columnStats,
      ragContext,
      schemaSummary: {
        datasetName: schemaContext.dataset.name,
        rowCount: schemaContext.dataset.rowCount,
        totalColumns: schemaContext.columns.length,
        metrics: schemaContext.metrics.map((m) => m.name),
        dimensions: schemaContext.dimensions.map((d) => d.name),
      },
      removedChartId: null,
      message: confidence > 0.7
        ? `Found "${matchedColumn?.displayName || chartSpec.xKey}" column. Creating ${chartSpec.type} chart.`
        : "Interpreted your request based on available schema data.",
    });
    return true;
  } catch (error) {
    console.error("[dashboard-chart-handler] Chart query error:", error);
    sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to process chart query", "CHART_QUERY_ERROR");
    return true;
  }
}

export async function handleRemoveChartRequest(request, response, pathname) {
  if (request.method !== "POST" || pathname !== "/api/dashboard/remove-chart") {
    return false;
  }

  try {
    const body = await readJsonBody(request);
    const chartId = body.chartId || body.id;

    if (!chartId) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, "chartId is required", "INVALID_INPUT");
      return true;
    }

    sendSuccess(response, {
      removedChartId: chartId,
      message: "Chart removed successfully",
    });
    return true;
  } catch (error) {
    console.error("[dashboard-chart-handler] Remove chart error:", error);
    sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to remove chart", "REMOVE_CHART_ERROR");
    return true;
  }
}

export default {
  handleChartQueryRequest,
  handleRemoveChartRequest,
};
