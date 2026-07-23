/**
 * Custom HTTP routes for the schema-only agentic analysis API.
 *
 * Public endpoints:
 * - POST /api/agentic/analyze
 * - GET  /api/agentic/workflows
 * - GET  /api/agentic/agents
 * - GET  /api/agentic/health
 * - GET  /api/agentic/metrics
 */

import { getDatasetById, getCurrentDataset } from "../database/dataset-repository.js";
import { generateUnifiedDashboard } from "../services/agentic-dashboard/unified-dashboard-orchestrator.js";
import { buildSchemaProfile, makeSchemaOnlyPacket } from "../services/ai-analyst/schema-fingerprint.js";
import { buildSchemaPacketAsync } from "../services/schema-packet-builder.js";
import { globalRegistry } from "../services/agentic/core/agent-registry.js";
import { listWorkflows, selectWorkflow } from "../config/workflows.js";
import { sendError, sendJson, sendSuccess } from "../utils/response-utils.js";
import { ERROR_CODES, HTTP_STATUS } from "../config/constants.js";

async function readJsonBody(request) {
  try {
    if (request.body && typeof request.body === "object" && !request.readable) return request.body;
    let raw = "";
    for await (const chunk of request) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeColumns(columns = []) {
  return (Array.isArray(columns) ? columns : [])
    .map((column) => {
      if (typeof column === "string") return { name: column, type: "string" };
      const name = column?.name || column?.key || column?.Column || column?.column;
      if (!name) return null;
      return {
        ...column,
        name: String(name),
        type: column.type || column.inferredType || "string",
      };
    })
    .filter(Boolean);
}

function datasetFromRuntimeContext(body = {}) {
  const ctx = body.runtimeContext || body.context || {};
  const schema = Array.isArray(ctx.schema)
    ? ctx.schema
    : Array.isArray(body.schema)
      ? body.schema
      : Array.isArray(body.columns)
        ? body.columns.map((column) => typeof column === "string" ? column : column.name || column.key).filter(Boolean)
        : [];

  if (!schema.length) return null;

  const columnProfiles = ctx.column_profiles || body.column_profiles || {};
  const columns = schema.map((name) => {
    const profile = columnProfiles[name] || {};
    return {
      name,
      type: profile.type === "numeric" ? "number"
        : profile.type === "date" ? "date"
          : profile.type === "boolean" ? "boolean"
            : "string",
      role: profile.type,
      sample: profile.sample_values || [],
    };
  });

  return {
    id: body.datasetId || body.id || "runtime-context",
    name: ctx.dataset_name || body.name || "Uploaded Dataset",
    columns,
    rows: Array.isArray(body.rows) ? body.rows : [],
    rowCount: Number(ctx.row_count || body.rowCount || body.rows?.length || 0),
    runtimeContext: ctx,
    recovered: true,
  };
}

async function loadDatasetForAgentic(body = {}) {
  if (body.dataset?.rows || body.dataset?.columns) {
    return {
      ...body.dataset,
      columns: normalizeColumns(body.dataset.columns || body.columns),
      rows: Array.isArray(body.dataset.rows) ? body.dataset.rows : [],
    };
  }

  if (Array.isArray(body.rows) || Array.isArray(body.columns)) {
    return {
      id: body.datasetId || body.id || "inline-dataset",
      name: body.name || "Uploaded Dataset",
      columns: normalizeColumns(body.columns),
      rows: Array.isArray(body.rows) ? body.rows : [],
    };
  }

  if (body.datasetId && body.datasetId !== "current") {
    const dataset = getDatasetById(body.datasetId);
    if (dataset) {
      return {
        ...dataset,
        columns: normalizeColumns(dataset.columns),
        rows: Array.isArray(dataset.rows) ? dataset.rows : [],
      };
    }
  }

  if (!body.datasetId || body.datasetId === "current") {
    const current = getCurrentDataset();
    if (current) {
      return {
        ...current,
        columns: normalizeColumns(current.columns),
        rows: Array.isArray(current.rows) ? current.rows : [],
      };
    }
  }

  return datasetFromRuntimeContext(body);
}

function chartAction(chart = {}) {
  return {
    action: "create_chart",
    chart_type: chart.type,
    title: chart.title,
    x: chart.xKey,
    y: chart.yKey,
    aggregation: chart.aggregation,
    reason: chart.reason || chart.intent || "Schema-safe dashboard chart.",
    chartSpec: chart,
  };
}

function kpiAction(kpi = {}) {
  return {
    action: "create_kpi",
    title: kpi.title,
    metric: kpi.metric,
    aggregation: kpi.aggregation,
    reason: kpi.description || "Schema-safe dashboard KPI.",
    kpiSpec: kpi,
  };
}

function buildDashboardActionEnvelope(dashboard = {}, message = "") {
  const actions = [
    ...(dashboard.kpis || []).map(kpiAction),
    ...(dashboard.charts || []).map(chartAction),
  ];

  return {
    response_type: "dashboard_action",
    natural_response: message || "I built a schema-safe dashboard plan. The app will calculate the real chart and KPI values locally.",
    actions,
    warnings: [],
    schema_safe: true,
  };
}

async function safeSchemaPacket(dataset) {
  if (!Array.isArray(dataset?.rows) || !dataset.rows.length) return null;
  try {
    return await buildSchemaPacketAsync(dataset);
  } catch {
    return null;
  }
}

export async function handleAgenticApiRoutes(request, response, pathname) {
  const { method } = request;

  if (method === "POST" && pathname === "/api/agentic/analyze") {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetForAgentic(body);

      if (!dataset || (!dataset.columns?.length && !dataset.rows?.length)) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "Dataset not found. Provide datasetId or schema/runtimeContext.", ERROR_CODES.NOT_FOUND);
        return true;
      }

      const goal = String(body.goal || body.query || body.user_query || "Build a schema-safe dashboard").trim();
      const options = body.options || {};
      const currentDashboard = body.currentDashboard || body.current_dashboard_state || body.runtimeContext?.current_dashboard_state || {};
      const profile = buildSchemaProfile(dataset);
      const schemaPacket = await safeSchemaPacket(dataset);
      const workflow = selectWorkflow(goal, options);

      const unified = await generateUnifiedDashboard(dataset, {
        useLlm: body.useLlm !== false,
        threshold: body.threshold,
        ragThreshold: body.ragThreshold,
        ragLimit: body.ragLimit,
        useRagEmbedding: body.useRagEmbedding !== false,
        requireOllamaValidation: body.requireOllamaValidation,
        useOllamaValidator: body.useOllamaValidator,
        maxCharts: body.maxCharts,
        maxKpis: body.maxKpis,
      });

      const dashboard = unified.dashboard || unified.dashboardPlan || {};
      const envelope = buildDashboardActionEnvelope(
        dashboard,
        unified.message || "I built a schema-safe dashboard from the uploaded dataset profile."
      );

      sendSuccess(
        response,
        {
          ok: unified.ok !== false,
          requestId: `agentic-${Date.now()}`,
          datasetId: dataset.id || body.datasetId || "runtime-context",
          schemaOnly: true,
          profile: makeSchemaOnlyPacket(profile, { includeStats: true, includeTopValues: true }),
          schemaPacket,
          currentDashboardState: currentDashboard,
          dashboard,
          dashboardPlan: dashboard,
          dashboardAction: envelope,
          ...envelope,
          governance: unified.governance,
          dashboardHealth: unified.data?.dashboardHealth || unified.governance?.status || "unknown",
          quality: unified.data?.quality || null,
          rag: unified.data?.rag || null,
          meta: {
            workflowId: workflow.id,
            workflowName: workflow.name,
            rowCount: profile.rowCount,
            columnCount: profile.columnCount,
            recoveredContext: Boolean(dataset.recovered),
            localCalculations: "frontend/backend deterministic engines calculate values from rows; LLM receives schema metadata only.",
          },
        },
        "Agentic schema-only analysis complete"
      );
      return true;
    } catch (error) {
      const isSensitive = error.message?.includes("sqlite") || error.message?.includes("connect") || error.message?.includes(".js");
      const message = isSensitive
        ? "Agentic analysis failed due to an internal service error"
        : error.message || "Agentic analysis failed";
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, message, ERROR_CODES.AI_GENERATION_FAILED);
      return true;
    }
  }

  if (method === "GET" && pathname === "/api/agentic/agents") {
    sendJson(response, 200, {
      ok: true,
      agents: globalRegistry.listAgents(),
      total: globalRegistry.size,
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/agentic/workflows") {
    sendJson(response, 200, {
      ok: true,
      workflows: listWorkflows(),
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/agentic/health") {
    sendJson(response, 200, {
      ok: true,
      status: "healthy",
      registry: globalRegistry.getStatus(),
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/agentic/metrics") {
    sendJson(response, 200, {
      ok: true,
      metrics: globalRegistry.collectMetrics(),
    });
    return true;
  }

  return false;
}

export default {
  handleAgenticApiRoutes,
};
