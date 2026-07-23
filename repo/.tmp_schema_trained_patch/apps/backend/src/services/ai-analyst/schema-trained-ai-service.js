import { buildSchemaProfile, makeSchemaOnlyPacket, normalizeColumnName } from "./schema-fingerprint.js";
import { applyTrainedTemplates, buildRuleDashboardPlan, mergePlans, pickPrimaryCategory, pickPrimaryMetric, pickSecondaryMetric, sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";
import { findBestSchemaMatch, trainSchemaExample } from "./schema-training-store.js";
import { formatChatAnswerWithOllama, planCommandWithOllama, planDashboardWithOllama } from "./llm-schema-dashboard-planner.js";

function findColumn(profile, text, preferredRoles = []) {
  const lower = normalizeColumnName(text);
  return profile.columns.find((column) => lower.includes(column.normalizedName)) ||
    profile.columns.find((column) => preferredRoles.includes(column.role)) ||
    profile.columns.find((column) => ["money_metric", "score_metric", "continuous_metric", "count_metric"].includes(column.role)) ||
    profile.columns[0];
}

function findCategory(profile, text) {
  const lower = normalizeColumnName(text);
  return profile.columns.find((column) => lower.includes(column.normalizedName) && ["category", "location", "target", "numeric_category"].includes(column.role)) ||
    pickPrimaryCategory(profile);
}

export async function generateSchemaDashboard(dataset, options = {}) {
  const profile = buildSchemaProfile(dataset);
  const matchResult = findBestSchemaMatch(profile, { threshold: options.threshold ?? 0.35 });
  const trainedPlan = applyTrainedTemplates(profile, matchResult.best);
  const rulePlan = buildRuleDashboardPlan(profile);

  let llmPlan = null;
  if (options.useLlm !== false) {
    llmPlan = await planDashboardWithOllama(profile, matchResult.best);
  }

  const dashboard = mergePlans(profile, trainedPlan, llmPlan?.charts?.length || llmPlan?.kpis?.length ? llmPlan : null, rulePlan);

  return {
    success: true,
    schemaOnly: true,
    profile: makeSchemaOnlyPacket(profile),
    match: matchResult.best ? {
      dataset: matchResult.best.entry.name,
      domain: matchResult.best.entry.domain,
      score: matchResult.best.score,
    } : null,
    candidates: matchResult.candidates.map((candidate) => ({
      dataset: candidate.entry.name,
      domain: candidate.entry.domain,
      score: candidate.score,
    })),
    dashboard,
    llm: llmPlan ? {
      source: llmPlan.source,
      model: llmPlan.model,
      error: llmPlan.error,
    } : null,
  };
}

export function trainSchemaDashboard(dataset, { dashboardPlan, rating = "good", notes = "", source = "upload-feedback" } = {}) {
  return trainSchemaExample({ dataset, dashboardPlan, rating, notes, source });
}

function localCommand(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = pickPrimaryMetric(profile);
  const metric2 = pickSecondaryMetric(profile);
  const category = pickPrimaryCategory(profile);

  if (/clear|reset/.test(lower) && /filter/.test(lower)) {
    return { action: "CLEAR_FILTERS", message: "Filters cleared.", schemaOnly: true };
  }

  if (/remove|delete/.test(lower) && /chart/.test(lower)) {
    return { action: "DELETE_CHART", message: "Removed the selected chart.", schemaOnly: true };
  }

  const filterMatch = lower.match(/filter\s+([a-z0-9_\s]+)\s*(=|to|is)\s*([\w\s.-]+)/i);
  if (filterMatch) {
    const column = findCategory(profile, filterMatch[1]) || category;
    const value = filterMatch[3].trim();
    return {
      action: "FILTER",
      message: `Applied filter ${column?.name || filterMatch[1]} = ${value}.`,
      filters: column ? { [column.name]: value } : {},
      schemaOnly: true,
    };
  }

  if (/kpi|card|metric/.test(lower)) {
    const aggregation = /highest|max|top/.test(lower) ? "max" : /median/.test(lower) ? "median" : /sum|total/.test(lower) ? "sum" : /average|avg|mean/.test(lower) ? "avg" : "count";
    const target = aggregation === "count" && /record|row/.test(lower) ? { name: "__row_count__", title: "Records" } : findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]);
    const title = aggregation === "count" && target.name === "__row_count__" ? "Total Records" : `${aggregation === "avg" ? "Average" : aggregation === "max" ? "Highest" : aggregation === "sum" ? "Total" : aggregation === "median" ? "Median" : "Count"} ${target?.title || target?.name}`;
    return {
      action: "GENERATE_KPI",
      message: `Added KPI: ${title}.`,
      kpiSpec: sanitizeKpiSpec({ title, metric: target?.name || "__row_count__", aggregation, format: target?.role === "money_metric" ? "currency" : "number" }, profile),
      schemaOnly: true,
    };
  }

  if (/scatter|relationship|correlation| vs | versus /.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric"] ) || metric;
    const x = profile.columns.find((column) => column.name !== y?.name && ["continuous_metric", "score_metric", "count_metric"].includes(column.role)) || metric2;
    if (x && y) {
      return {
        action: "GENERATE_CHART",
        message: `Created scatter chart: ${y.title} vs ${x.title}.`,
        chartSpec: sanitizeChartSpec({ type: "scatter", title: `${y.title} vs ${x.title}`, xKey: x.name, yKey: y.name, aggregation: "count", limit: 500 }, profile),
        schemaOnly: true,
      };
    }
  }

  if (/pie|donut|distribution|breakdown/.test(lower) && !/salary|amount|revenue|score|age|experience|hours/.test(lower)) {
    const x = findCategory(profile, lower) || category;
    if (x) {
      const type = /pie/.test(lower) ? "pie" : "donut";
      return {
        action: "GENERATE_CHART",
        message: `Created ${type} chart for ${x.title}.`,
        chartSpec: sanitizeChartSpec({ type, title: `${x.title} Distribution`, xKey: x.name, yKey: "count", aggregation: "count", limit: 10 }, profile),
        schemaOnly: true,
      };
    }
  }

  if (/histogram|distribution/.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]) || metric;
    if (y) {
      return {
        action: "GENERATE_CHART",
        message: `Created histogram for ${y.title}.`,
        chartSpec: sanitizeChartSpec({ type: "histogram", title: `${y.title} Distribution`, xKey: y.name, yKey: y.name, aggregation: "count", bins: 12 }, profile),
        schemaOnly: true,
      };
    }
  }

  if (/chart|graph|show|average|avg|top/.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]) || metric;
    const x = findCategory(profile, lower) || category;
    if (x && y) {
      const aggregation = /sum|total/.test(lower) ? "sum" : /max|highest/.test(lower) ? "max" : /median/.test(lower) ? "median" : /count/.test(lower) || y.name === "count" ? "count" : "avg";
      return {
        action: "GENERATE_CHART",
        message: `Created chart: ${aggregation} ${y.title} by ${x.title}.`,
        chartSpec: sanitizeChartSpec({ type: "bar", title: `${aggregation === "avg" ? "Average" : aggregation.toUpperCase()} ${y.title} by ${x.title}`, xKey: x.name, yKey: y.name, aggregation, limit: /top\s*(\d+)/.test(lower) ? Number(lower.match(/top\s*(\d+)/)[1]) : 10 }, profile),
        schemaOnly: true,
      };
    }
  }

  return {
    action: "ANSWER",
    message: `I found ${profile.rowCount.toLocaleString()} records, ${profile.columnCount} columns, and detected the domain as ${profile.domain}. Ask me to create a KPI, chart, filter, or dashboard.` ,
    schemaOnly: true,
  };
}

export async function runDashboardCommand({ dataset, query, currentDashboard = {}, useLlm = true }) {
  const profile = buildSchemaProfile(dataset);
  const matchResult = findBestSchemaMatch(profile, { threshold: 0.35 });

  const deterministic = localCommand(profile, query);
  const shouldUseLlm = useLlm && deterministic.action === "ANSWER";

  if (shouldUseLlm) {
    const planned = await planCommandWithOllama({ query, schemaProfile: profile, memoryMatch: matchResult.best, currentDashboard });
    if (planned && planned.action !== "ANSWER") return planned;
    return { ...deterministic, aiFallback: planned?.aiError || null, model: planned?.model, provider: planned?.provider };
  }

  return deterministic;
}

function computeLocalAnswer(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]);
  const category = findCategory(profile, lower);

  if (/schema|columns|fields/.test(lower)) {
    return `This dataset has ${profile.rowCount.toLocaleString()} rows and ${profile.columnCount} columns. Main domain: ${profile.domain}. Columns: ${profile.columns.map((c) => `${c.name} (${c.type}, ${c.role})`).join(", ")}.`;
  }

  if (/kpi|dashboard|chart/.test(lower)) {
    const plan = buildRuleDashboardPlan(profile);
    return `Recommended KPIs: ${plan.kpis.map((k) => k.title).join(", ")}. Recommended charts: ${plan.charts.map((c) => c.title).join(", ")}.`;
  }

  if (metric?.stats && /average|avg|mean/.test(lower)) {
    return `Average ${metric.title} is approximately ${metric.stats.mean}.`;
  }

  if (category && /top|most|distribution|breakdown/.test(lower)) {
    const top = category.topValues?.slice(0, 5).map((item) => `${item.value} (${item.count})`).join(", ");
    return `Top ${category.title} values are: ${top || "not available from schema profile"}.`;
  }

  return `Dataset summary: ${profile.rowCount.toLocaleString()} rows, ${profile.columnCount} columns, detected domain ${profile.domain}. Primary metric: ${metric?.name || "not detected"}. Primary category: ${category?.name || "not detected"}.`;
}

export async function runSchemaChat({ dataset, query, useLlm = true }) {
  const profile = buildSchemaProfile(dataset);
  const localAnswer = computeLocalAnswer(profile, query);
  if (!useLlm) return { answer: localAnswer, model: "local", provider: "local", schemaOnly: true };
  const formatted = await formatChatAnswerWithOllama({ query, schemaProfile: profile, localAnswer });
  return { ...formatted, schemaOnly: true };
}
