import { buildSchemaProfile } from "../ai-analyst/schema-fingerprint.js";
import { runOllamaValidatorAgent, buildGovernanceDecision } from "./ollama-validator-agent.js";
import { validateChatAnswer } from "./fact-validator-agent.js";
import { 
  parseCustomChartQuery, 
  normalizeChartAction,
  categorizeSchemaColumns
} from "./custom-chart-query-parser.js";

const ACTION_AGGREGATIONS = new Set(["none", "count", "sum", "avg", "min", "max", "median", "count_unique"]);
const ACTION_CHART_TYPES = new Set(["bar", "horizontal_bar", "horizontalBar", "line", "area", "pie", "donut", "histogram", "scatter", "heatmap", "map", "table"]);
const METRIC_ROLES = new Set(["money_metric", "score_metric", "continuous_metric", "count_metric", "rate_metric"]);
const CATEGORY_ROLES = new Set(["category", "location", "target", "numeric_category"]);

function governanceMode(query = "") {
  const lower = String(query).toLowerCase();
  if (/report|executive|summary|presentation/.test(lower)) return "executive_report";
  if (/geo|map|country|region|state|city/.test(lower)) return "geo_intelligence";
  if (/kpi|card|metric/.test(lower)) return "kpi_builder";
  if (/chart|plot|graph|show|compare|scatter|bar|line|distribution/.test(lower)) return "chart_builder";
  if (/dashboard|layout|build/.test(lower)) return "dashboard_builder";
  return "analytics_chat";
}

function columnMap(schemaProfile = {}) {
  return new Map((schemaProfile.columns || []).map((column) => [column.name, column]));
}

function isMetricColumn(column) {
  return Boolean(column && (column.type === "number" || METRIC_ROLES.has(column.role)));
}

function isCategoryColumn(column) {
  return Boolean(column && (CATEGORY_ROLES.has(column.role) || column.type === "category" || column.type === "boolean"));
}

function isGeoColumn(column) {
  return Boolean(column && (column.role === "location" || /country|state|city|region|territory|province|location|market/i.test(column.name || "")));
}

function isDateColumn(column) {
  return Boolean(column && (column.type === "date" || column.role === "date" || /date|time|month|year|created|updated/i.test(column.name || "")));
}

function getChartSpecFromAction(action = {}) {
  const spec = action.chartSpec || {};
  return {
    type: action.chart_type || action.type || spec.type,
    title: action.title || spec.title,
    xKey: action.x || action.xKey || spec.xKey,
    yKey: action.y || action.yKey || action.metric || spec.yKey || "count",
    aggregation: action.aggregation || spec.aggregation || "count",
  };
}

function getKpiSpecFromAction(action = {}) {
  const spec = action.kpiSpec || {};
  return {
    title: action.title || spec.title,
    metric: action.metric || action.y || spec.metric,
    aggregation: action.aggregation || spec.aggregation || "count",
  };
}

function chartKey(chart = {}) {
  return `${chart.type || chart.chart_type || ""}:${chart.xKey || chart.x || ""}:${chart.yKey || chart.y || chart.metric || ""}:${chart.aggregation || ""}`.toLowerCase();
}

function collectDashboardCharts(currentDashboard = {}) {
  return [
    ...(Array.isArray(currentDashboard.charts) ? currentDashboard.charts : []),
    ...(Array.isArray(currentDashboard.dashboard?.charts) ? currentDashboard.dashboard.charts : []),
    ...(Array.isArray(currentDashboard.dashboardPlan?.charts) ? currentDashboard.dashboardPlan.charts : []),
  ];
}

/**
 * CRITICAL FIX:
 * Validate chart action AFTER normalizing x/y fields.
 * 
 * Before: AI returns {x: "country", y: "salary_usd"}
 *         Guardian checks x column type → rejects if metric
 *         ERROR: "bar charts require a category x column"
 *
 * After:  AI returns {x: "country", y: "salary_usd"}
 *         Guardian NORMALIZES: {xKey: "country", yKey: "salary_usd"}
 *         Guardian validates normalized form
 *         PASS: country is category, salary_usd is metric ✓
 */
function validateChartAction(action, schemaProfile, currentDashboard, seenChartKeys) {
  const columns = columnMap(schemaProfile);
  
  // CRITICAL: Normalize the action FIRST, before extracting spec
  const normalizedAction = normalizeChartAction(action);
  const spec = getChartSpecFromAction(normalizedAction);
  
  const reasons = [];
  const warnings = [];

  // Debug log for development only
  if (process.env.DEBUG_CHART_VALIDATION) {
    console.log(`[ChartValidation] Query normalized:`, {
      original: { x: action.x, y: action.y, xKey: action.xKey, yKey: action.yKey },
      normalized: { x: spec.xKey, y: spec.yKey },
      type: spec.type,
      aggregation: spec.aggregation,
    });
  }

  if (!ACTION_CHART_TYPES.has(spec.type)) reasons.push(`Unsupported chart type ${spec.type || "unknown"}.`);
  if (!ACTION_AGGREGATIONS.has(spec.aggregation)) reasons.push(`Unsupported aggregation ${spec.aggregation || "unknown"}.`);

  const xColumn = columns.get(spec.xKey);
  const yColumn = columns.get(spec.yKey);

  if (spec.xKey && spec.xKey !== "count" && !xColumn) reasons.push(`Column ${spec.xKey} does not exist.`);
  if (spec.yKey && !["count", "__row_count__"].includes(spec.yKey) && !yColumn) reasons.push(`Column ${spec.yKey} does not exist.`);

  if (["bar", "horizontal_bar", "horizontalBar"].includes(spec.type)) {
    if (!isCategoryColumn(xColumn) && !isGeoColumn(xColumn)) {
      reasons.push(`${spec.type} charts require a category or geo x column, but got ${xColumn?.type} type.`);
    }
    // THIS IS THE KEY FIX: Allow numeric y if yKey is a metric column
    if (spec.yKey !== "count" && !isMetricColumn(yColumn)) {
      reasons.push(`${spec.type} charts require a numeric metric y column.`);
    }
  }

  if (["line", "area"].includes(spec.type)) {
    if (!isDateColumn(xColumn)) reasons.push("Line/area charts require a real date/time x column.");
    if (!isMetricColumn(yColumn)) reasons.push("Line/area charts require a numeric metric y column.");
  }

  if (["pie", "donut"].includes(spec.type)) {
    if (!isCategoryColumn(xColumn) && !isGeoColumn(xColumn)) reasons.push("Pie/donut charts require a category or geo column.");
    if (spec.yKey !== "count" || spec.aggregation !== "count") warnings.push("Pie/donut actions are converted to count-based category share locally.");
  }

  if (spec.type === "histogram") {
    const metricColumn = yColumn && spec.yKey !== "count" ? yColumn : xColumn;
    if (!isMetricColumn(metricColumn)) reasons.push("Histogram actions require a numeric metric column.");
  }

  if (spec.type === "scatter") {
    if (!isMetricColumn(xColumn) || !isMetricColumn(yColumn)) reasons.push("Scatter charts require two numeric metric columns.");
  }

  if (spec.type === "map") {
    if (!isGeoColumn(xColumn)) reasons.push("Map charts require a geographic x column.");
    if (spec.yKey !== "count" && !isMetricColumn(yColumn)) reasons.push("Map charts require count or a numeric metric y column.");
  }

  const key = chartKey(spec);
  const duplicateInAction = seenChartKeys.has(key);
  const duplicateOnDashboard = collectDashboardCharts(currentDashboard).some((chart) => chartKey(chart) === key);
  if (duplicateInAction) reasons.push(`Duplicate chart action for ${spec.title || key}.`);
  if (duplicateOnDashboard && String(normalizedAction.action || "").toLowerCase() === "create_chart") {
    normalizedAction.action = "modify_chart";
    warnings.push(`Updated existing chart instead of creating duplicate ${spec.title || key}.`);
  }
  seenChartKeys.add(key);

  return { valid: reasons.length === 0, reasons, warnings, action: normalizedAction };
}

function validateKpiAction(action, schemaProfile) {
  const columns = columnMap(schemaProfile);
  const normalizedAction = normalizeChartAction(action);
  const spec = getKpiSpecFromAction(normalizedAction);
  const reasons = [];

  if (!ACTION_AGGREGATIONS.has(spec.aggregation)) reasons.push(`Unsupported aggregation ${spec.aggregation || "unknown"}.`);

  if (spec.metric === "__row_count__") return { valid: reasons.length === 0, reasons, warnings: [], action: normalizedAction };

  const metricColumn = columns.get(spec.metric);
  if (!metricColumn) {
    reasons.push(`KPI metric ${spec.metric || "unknown"} does not exist.`);
  } else if (spec.aggregation === "count_unique") {
    if (!isCategoryColumn(metricColumn) && !isGeoColumn(metricColumn)) {
      reasons.push("count_unique KPI requires a category or geo column.");
    }
  } else if (!isMetricColumn(metricColumn)) {
    reasons.push("KPI actions require numeric metrics unless using count_unique or Total Records.");
  }

  return { valid: reasons.length === 0, reasons, warnings: [], action: normalizedAction };
}

function validateFilterAction(action, schemaProfile) {
  const columns = columnMap(schemaProfile);
  const filters = action.filters || {};
  const reasons = [];
  const warnings = [];

  for (const [columnName, value] of Object.entries(filters)) {
    const column = columns.get(columnName);
    if (!column) {
      reasons.push(`Filter column ${columnName} does not exist.`);
      continue;
    }

    const topValues = Array.isArray(column.topValues) ? column.topValues.map((item) => String(item.value)) : [];
    if (topValues.length && column.uniqueCount <= topValues.length && !topValues.includes(String(value))) {
      reasons.push(`Filter value ${value} was not found in ${columnName}.`);
    } else if (topValues.length && !topValues.includes(String(value))) {
      warnings.push(`Filter value ${value} is schema-safe but was not present in the top sampled values for ${columnName}.`);
    }
  }

  return { valid: reasons.length === 0, reasons, warnings, action };
}

function validateDashboardActionEnvelope(command = {}, schemaProfile = {}, currentDashboard = {}) {
  if (command.response_type !== "dashboard_action" || !Array.isArray(command.actions)) {
    return { command, warnings: [], blockingReasons: [] };
  }

  const warnings = [...(command.warnings || [])];
  const blockingReasons = [];
  const cleanedActions = [];
  const seenChartKeys = new Set();

  for (const rawAction of command.actions) {
    const action = { ...rawAction };
    const actionName = String(action.action || "").toLowerCase();
    let result = null;

    if (["create_chart", "modify_chart", "update_chart", "update_chart_type", "convert_chart_type"].includes(actionName)) {
      result = validateChartAction(action, schemaProfile, currentDashboard, seenChartKeys);
    } else if (["create_kpi", "add_kpi", "generate_kpi"].includes(actionName)) {
      result = validateKpiAction(action, schemaProfile);
    } else if (["filter", "add_filter", "apply_filter"].includes(actionName)) {
      result = validateFilterAction(action, schemaProfile);
    } else if (["clear_filters", "reset_filters", "delete_chart", "remove_chart", "delete_all_charts", "remove_all_charts", "clear_charts", "generate_code"].includes(actionName)) {
      result = { valid: true, reasons: [], warnings: [], action };
    } else {
      result = { valid: false, reasons: [`Unsupported dashboard action ${action.action || "unknown"}.`], warnings: [], action };
    }

    warnings.push(...result.warnings);
    if (result.valid) cleanedActions.push(result.action);
    else blockingReasons.push(...result.reasons);
  }

  return {
    command: {
      ...command,
      actions: cleanedActions,
      warnings,
      schema_safe: cleanedActions.length > 0 && blockingReasons.length === 0,
    },
    warnings,
    blockingReasons: cleanedActions.length ? blockingReasons : blockingReasons.length ? blockingReasons : ["No valid dashboard actions were produced."],
  };
}

function rejected(message, governance) {
  return {
    action: "ANSWER",
    message,
    schemaOnly: true,
    governance,
    approvedForRender: false,
  };
}

export async function governDashboardCommand({
  dataset,
  query,
  command,
  currentDashboard = {},
  requireOllama = process.env.ENABLE_OLLAMA_VALIDATOR === "1",
} = {}) {
  const schemaProfile = buildSchemaProfile(dataset || {});
  
  // Try deterministic parser FIRST unless a schema-safe local planner already
  // produced a dashboard action. Re-parsing here can drop filters, sort order,
  // and calculation metadata from richer deterministic specs.
  let parsedAction = null;
  const hasLocalDashboardAction = command?.schemaOnly === true && command?.response_type === "dashboard_action";
  if (!hasLocalDashboardAction) {
    try {
      parsedAction = parseCustomChartQuery(query, schemaProfile);
    } catch (err) {
      console.error("[ChartParser] Error in deterministic parsing:", err.message);
    }
  }

  // If deterministic parser succeeded, use its action
  if (parsedAction) {
    if (process.env.DEBUG_CHART_VALIDATION) {
      console.log("[ChartParser] Deterministic parse succeeded:", parsedAction);
    }
    // Wrap parsed action in dashboard_action envelope
    command = {
      response_type: "dashboard_action",
      natural_response: `I parsed "${query}" as a chart request.`,
      actions: [parsedAction],
      warnings: [],
      schema_safe: true,
    };
  }

  const actionValidation = validateDashboardActionEnvelope(command, schemaProfile, currentDashboard);
  const governedCommand = actionValidation.command;

  if (actionValidation.blockingReasons.length && !governedCommand.actions?.length) {
    return rejected(
      `Request blocked by Dashboard Guardian: ${actionValidation.blockingReasons.join(" ")}`,
      {
        status: "REJECTED",
        approvedForRender: false,
        mode: governanceMode(query),
        blockingReasons: actionValidation.blockingReasons,
        warnings: actionValidation.warnings,
      }
    );
  }

  const mode = governanceMode(query);
  const artifactType = governedCommand?.kpiSpec ? "kpi" : governedCommand?.chartSpec ? "chart" : governedCommand?.dashboardPlan || governedCommand?.dashboard ? "dashboard" : "chat";
  const artifact = governedCommand?.kpiSpec || governedCommand?.chartSpec || governedCommand?.dashboardPlan || governedCommand?.dashboard || { answer: governedCommand?.message };
  const validator = await runOllamaValidatorAgent({
    artifact,
    artifactType,
    schemaProfile,
    requireOllama,
  });
  const governance = buildGovernanceDecision({ validator, artifactType });

  if (!governance.approvedForRender) {
    return rejected(
      `Request blocked by AI governance: ${governance.blockingReasons.join(" ")}`,
      { ...governance, mode }
    );
  }

  return {
    ...governedCommand,
    warnings: actionValidation.warnings,
    mode,
    governance: { ...governance, mode, actionValidation },
    approvedForRender: true,
  };
}

export async function governChatAnswer({
  dataset,
  query,
  answer,
  dashboard,
  ragMatches = [],
  requireOllama = process.env.ENABLE_OLLAMA_VALIDATOR === "1",
} = {}) {
  const schemaProfile = buildSchemaProfile(dataset || {});
  const mode = governanceMode(query);
  const factCheck = validateChatAnswer({ answer, schemaProfile, dashboard, ragMatches });

  if (!factCheck.valid) {
    const governance = {
      status: "REJECTED",
      approvedForRender: false,
      mode,
      blockingReasons: [factCheck.reason],
      factValidator: factCheck,
    };
    return {
      answer: factCheck.answer,
      schemaOnly: true,
      governance,
      approvedForRender: false,
    };
  }

  const validator = await runOllamaValidatorAgent({
    artifact: { answer: factCheck.answer, query },
    artifactType: "chat",
    schemaProfile,
    requireOllama,
  });
  const governance = buildGovernanceDecision({ validator, artifactType: "chat" });

  return {
    answer: governance.approvedForRender
      ? factCheck.answer
      : "Based on the current schema and available analytics, this cannot be determined.",
    schemaOnly: true,
    governance: { ...governance, mode, factValidator: factCheck },
    approvedForRender: governance.approvedForRender,
  };
}
