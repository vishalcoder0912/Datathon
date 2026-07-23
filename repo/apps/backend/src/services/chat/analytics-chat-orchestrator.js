import { randomUUID } from "node:crypto";
import { getDatasetById } from "../../database/dataset-repository.js";
import { buildChatSchema, schemaForAi } from "./chat-schema-utils.js";
import { planChatCommand } from "./schema-only-chat-planner.js";
import { validateChatPlan } from "./chat-plan-validator.js";
import { buildSafeAnalyticsSql } from "./safe-sql-builder.js";
import { executeAnalyticsQuery } from "./local-query-executor.js";
import { buildChartFromQueryResult } from "./chat-chart-builder.js";
import { generateChatAnswer } from "./chat-answer-generator.js";

function normalizeFilters(activeFilters = []) {
  if (Array.isArray(activeFilters)) return activeFilters;
  return Object.entries(activeFilters || {})
    .filter(([key, value]) => key !== "conditions" && value !== null && value !== undefined && value !== "")
    .map(([column, value]) => ({ column, operator: "equals", value }));
}

function errorResponse({ answer, errorCode = "CHAT_ERROR", details = "" }) {
  return {
    success: false,
    answer,
    errorCode,
    details,
    safety: {
      schemaOnlyAI: true,
      rawRowsSentToAI: false,
      sqlValidated: false,
    },
  };
}

export async function handleAnalyticsChat({ datasetId, message, activeFilters = [], mode = "analysis" } = {}) {
  const query = String(message || "").trim();
  if (!query) {
    return errorResponse({ answer: "Please enter a chat message.", errorCode: "EMPTY_MESSAGE" });
  }

  const dataset = getDatasetById(datasetId);
  if (!dataset) {
    return errorResponse({
      answer: "I could not process that request because the dataset schema was not found.",
      errorCode: "SCHEMA_NOT_FOUND",
    });
  }

  const schema = buildChatSchema(dataset);
  const aiSchema = schemaForAi(schema);
  const filters = normalizeFilters(activeFilters);

  let plan = await planChatCommand({ message: query, schema, activeFilters: filters, mode });
  const validation = validateChatPlan({ plan, schema, message: query });
  if (!validation.valid) {
    return {
      success: true,
      messageId: randomUUID(),
      intent: "clarification",
      answer: validation.message,
      queryPlan: plan,
      result: null,
      chart: null,
      kpi: null,
      dashboardAction: { available: false },
      safety: {
        schemaOnlyAI: true,
        rawRowsSentToAI: false,
        sqlValidated: false,
      },
    };
  }

  if (plan.needsCalculation === false) {
    const answer = plan.answer || "I can help with schema-safe analytics questions and dashboard commands.";
    return {
      success: true,
      messageId: randomUUID(),
      intent: plan.intent,
      answer,
      queryPlan: plan,
      sql: null,
      result: null,
      chart: null,
      kpi: null,
      dashboardAction: plan.dashboardAction
        ? { available: true, type: plan.dashboardAction, payload: { filters: plan.filters || [] } }
        : { available: false },
      safety: {
        schemaOnlyAI: true,
        rawRowsSentToAI: false,
        sqlValidated: true,
      },
      aiPayloadPreview: aiSchema,
    };
  }

  try {
    const { sql, params } = buildSafeAnalyticsSql({ plan, schema, tableName: "dataset" });
    const result = await executeAnalyticsQuery({ dataset, plan });
    const visual = buildChartFromQueryResult({ plan, result, schema }) || {};
    const answer = await generateChatAnswer({ message: query, plan, result, schema });

    const dashboardAction = visual.chart
      ? { available: true, type: "ADD_CHART", label: "Add chart to dashboard", payload: { chart: visual.chart } }
      : visual.kpi
        ? { available: true, type: "ADD_KPI", label: "Add KPI to dashboard", payload: { kpi: visual.kpi } }
        : { available: false };

    return {
      success: true,
      messageId: randomUUID(),
      intent: plan.intent,
      answer,
      queryPlan: plan,
      sql,
      params,
      result,
      chart: visual.chart || null,
      kpi: visual.kpi || null,
      dashboardAction,
      safety: {
        schemaOnlyAI: true,
        rawRowsSentToAI: false,
        sqlValidated: true,
      },
      aiPayloadPreview: aiSchema,
    };
  } catch (error) {
    return errorResponse({
      answer: `I could not process that analytics request safely: ${error.message}`,
      errorCode: "QUERY_EXECUTION_FAILED",
      details: error.message,
    });
  }
}
