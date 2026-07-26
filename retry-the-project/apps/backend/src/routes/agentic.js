import { handleAnalyticsChat } from "../services/chat/analytics-chat-orchestrator.js";
import { generateSchemaProfile } from "../services/dashboard/schemaProfiler.js";
import { planDashboardWithAI } from "../services/ai/dashboardPlanner.js";
import { buildDashboardFromPlan } from "../services/dashboard/dashboardAnalytics.js";
import { selectAgenticPipeline } from "../services/agentic/agentic-pipeline-router.js";
import {
  createAgentRun,
  createDatasetPipelineRun,
  finishAgentRun,
  finishDatasetPipelineRun,
  getDatasetById,
  getLatestDashboardArtifact,
  getLatestDatasetPipelineRun,
  getLatestDatasetSchema,
  saveAgentToolCall,
  saveDashboardArtifact,
  saveDatasetSchemaProfile,
  saveRagMemory,
} from "../database/dataset-repository.js";
import { sendError, sendSuccess } from "../utils/response-utils.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";

async function getRequestBody(request) {
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

function datasetSummary(dataset) {
  return {
    id: dataset.id,
    name: dataset.name,
    fileName: dataset.fileName,
    sourceType: dataset.sourceType,
    rowCount: dataset.rowCount || dataset.rows?.length || 0,
    columnCount: dataset.columns?.length || 0,
    originalFilePath: dataset.originalFilePath,
    optimizedFilePath: dataset.optimizedFilePath,
    optimizedFormat: dataset.optimizedFormat,
  };
}

function schemaFromDataset(dataset) {
  return generateSchemaProfile({
    rows: dataset.rows || [],
    dataDictionary: [],
    datasetName: dataset.name || "Uploaded Dataset",
  });
}

function schemaSummary(profile) {
  const columns = Array.isArray(profile?.columns) ? profile.columns : [];
  return {
    datasetName: profile?.datasetName,
    rowCount: profile?.rowCount || 0,
    columnCount: profile?.columnCount || columns.length,
    numericMetrics: columns.filter((column) => column.role === "metric").map((column) => column.name),
    categories: columns.filter((column) => column.role === "dimension").map((column) => column.name),
    dates: columns.filter((column) => column.role === "date").map((column) => column.name),
    ids: columns.filter((column) => column.role === "id").map((column) => column.name),
    textColumns: columns.filter((column) => column.role === "text").map((column) => column.name),
  };
}

function getDatasetOrRespond(response, datasetId) {
  const dataset = getDatasetById(datasetId);
  if (!dataset) {
    sendError(response, HTTP_STATUS.NOT_FOUND, "Dataset not found", ERROR_CODES.DATASET_NOT_FOUND);
    return null;
  }
  return dataset;
}

export async function handleAgenticRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname === "/api/agentic/capabilities" && method === "GET") {
    sendSuccess(response, {
      canonicalRoutes: {
        context: "GET /api/agentic/datasets/:datasetId/context",
        dashboard: "POST /api/agentic/datasets/:datasetId/dashboard",
        chat: "POST /api/agentic/datasets/:datasetId/chat",
      },
      safety: {
        schemaFirst: true,
        llmReadsRawRows: false,
        sqlValidatedBeforeExecution: true,
        dashboardValuesCalculatedByBackend: true,
      },
    }, "Agentic route family is available");
    return true;
  }

  const match = pathname.match(/^\/api\/agentic\/datasets\/([^/]+)\/(context|dashboard|chat)$/);
  if (!match) return false;

  const [, datasetId, action] = match;
  const dataset = getDatasetOrRespond(response, datasetId);
  if (!dataset) return true;

  if (action === "context" && method === "GET") {
    const latestSchema = getLatestDatasetSchema(datasetId);
    const profile = latestSchema?.profile || schemaFromDataset(dataset);
    const pipeline = getLatestDatasetPipelineRun(datasetId) || selectAgenticPipeline({ dataset, schemaProfile: profile });
    const dashboardArtifact = getLatestDashboardArtifact(datasetId);

    sendSuccess(response, {
      dataset: datasetSummary(dataset),
      schemaSummary: schemaSummary(profile),
      schemaProfile: profile,
      pipeline,
      dashboardArtifact,
      safety: {
        rawRowsSentToLlm: false,
        frontendReceivesFullRows: false,
      },
    }, "Agentic dataset context loaded");
    return true;
  }

  if (action === "dashboard" && method === "POST") {
    let agentRun = null;
    let pipelineRun = null;

    try {
      const body = await getRequestBody(request);
      const profile = schemaFromDataset(dataset);
      const schemaRecord = saveDatasetSchemaProfile({
        datasetId,
        schema: schemaSummary(profile),
        profile,
        rawRowsSent: false,
      });

      const pipeline = selectAgenticPipeline({ dataset, schemaProfile: profile });
      pipelineRun = createDatasetPipelineRun({
        datasetId,
        selectedPipeline: pipeline.selectedPipeline,
        policy: pipeline,
      });

      agentRun = createAgentRun({
        datasetId,
        kind: "dashboard_planner",
        input: {
          userQuery: body.query || "Generate the master dashboard.",
          schemaSummary: schemaSummary(profile),
          selectedPipeline: pipeline.selectedPipeline,
        },
        rawRowsSent: false,
      });

      const aiPlan = await planDashboardWithAI({
        schemaProfile: profile,
        userQuery: body.query || "Generate the master dashboard.",
        currentDashboard: body.currentDashboard || null,
      });
      saveAgentToolCall({
        agentRunId: agentRun.id,
        datasetId,
        toolName: "dashboard_planner",
        input: { schemaSummary: schemaSummary(profile), query: body.query || null },
        output: aiPlan,
      });

      const dashboard = buildDashboardFromPlan({
        rows: dataset.rows || [],
        filters: body.filters || {},
        dashboardPlan: aiPlan.dashboardPlan,
      });
      saveAgentToolCall({
        agentRunId: agentRun.id,
        datasetId,
        toolName: "deterministic_dashboard_executor",
        input: { filters: body.filters || {}, planWidgetCount: aiPlan.dashboardPlan?.charts?.length || 0 },
        output: { kpis: dashboard.kpis?.length || 0, charts: dashboard.charts?.length || 0 },
      });

      const artifact = saveDashboardArtifact({
        datasetId,
        pipelineRunId: pipelineRun.id,
        dashboard: {
          ...dashboard,
          dashboardPlan: aiPlan.dashboardPlan,
          schemaSummary: schemaSummary(profile),
          generatedAt: new Date().toISOString(),
          selectedPipeline: pipeline.selectedPipeline,
        },
        rawRowsSent: false,
      });

      saveRagMemory({
        datasetId,
        memoryType: "dashboard_pattern",
        fingerprint: `${pipeline.selectedPipeline}:${profile.columns.map((column) => `${column.name}:${column.role}`).join("|")}`,
        content: {
          schemaSummary: schemaSummary(profile),
          selectedPipeline: pipeline.selectedPipeline,
          dashboardPlan: aiPlan.dashboardPlan,
        },
      });

      finishDatasetPipelineRun({ runId: pipelineRun.id, status: "completed", policy: pipeline });
      finishAgentRun({
        runId: agentRun.id,
        status: "completed",
        output: { artifactId: artifact.id, selectedPipeline: pipeline.selectedPipeline },
        rawRowsSent: false,
      });

      sendSuccess(response, {
        dataset: datasetSummary(dataset),
        schema: schemaRecord,
        pipeline,
        dashboardArtifact: artifact,
        agentRunId: agentRun.id,
        executionAudit: {
          rawRowsSentToLlm: false,
          plannerUsedSchemaOnly: true,
          valuesCalculatedByBackend: true,
          persisted: true,
        },
      }, "Agentic dashboard generated and persisted");
      return true;
    } catch (error) {
      if (pipelineRun?.id) {
        finishDatasetPipelineRun({ runId: pipelineRun.id, status: "failed", policy: { error: error.message } });
      }
      if (agentRun?.id) {
        finishAgentRun({ runId: agentRun.id, status: "failed", output: { error: error.message }, rawRowsSent: false });
      }
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Agentic dashboard generation failed", ERROR_CODES.AI_GENERATION_FAILED);
      return true;
    }
  }

  if (action === "chat" && method === "POST") {
    let agentRun = null;

    try {
      const body = await getRequestBody(request);
      agentRun = createAgentRun({
        datasetId,
        kind: "sql_chat",
        input: {
          message: body.message || body.query,
          mode: body.mode || "analysis",
        },
        rawRowsSent: false,
      });

      const result = await handleAnalyticsChat({
        datasetId,
        message: body.message || body.query,
        activeFilters: body.activeFilters || [],
        mode: body.mode || "analysis",
      });

      saveAgentToolCall({
        agentRunId: agentRun.id,
        datasetId,
        toolName: "safe_sql_gateway",
        input: { queryPlan: result.queryPlan || null, sql: result.sql || null },
        output: {
          sqlValidated: Boolean(result.safety?.sqlValidated),
          resultRows: Array.isArray(result.result?.rows) ? result.result.rows.length : 0,
          dashboardActionAvailable: Boolean(result.dashboardAction?.available),
        },
        status: result.success === false ? "rejected" : "completed",
      });

      finishAgentRun({
        runId: agentRun.id,
        status: result.success === false ? "failed" : "completed",
        output: result,
        rawRowsSent: false,
      });

      sendSuccess(response, {
        ...result,
        agentRunId: agentRun.id,
        executionAudit: {
          rawRowsSentToLlm: false,
          sqlValidated: Boolean(result.safety?.sqlValidated),
          persisted: true,
        },
      }, "Agentic chat response generated");
      return true;
    } catch (error) {
      if (agentRun?.id) {
        finishAgentRun({ runId: agentRun.id, status: "failed", output: { error: error.message }, rawRowsSent: false });
      }
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Agentic chat failed", ERROR_CODES.AI_GENERATION_FAILED);
      return true;
    }
  }

  return false;
}

export default {
  handleAgenticRoutes,
};
