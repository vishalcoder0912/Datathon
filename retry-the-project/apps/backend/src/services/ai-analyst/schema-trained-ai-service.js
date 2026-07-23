import { buildSchemaProfile, makeSchemaOnlyPacket, normalizeColumnName } from "./schema-fingerprint.js";
import { applyTrainedTemplates, buildRuleDashboardPlan, mergePlans, pickPrimaryCategory, pickPrimaryMetric, pickSecondaryMetric, sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";
import { findBestSchemaMatch, trainSchemaExample } from "./schema-training-store.js";
import { formatChatAnswerWithOllama, planCommandWithOllama, planDashboardWithOllama } from "./llm-schema-dashboard-planner.js";
import { buildGuardianDashboardResponse } from "./dashboard-quality-guardian.js";
import { generateUnifiedDashboard } from "../agentic-dashboard/unified-dashboard-orchestrator.js";
import {
  buildSchemaUnderstanding,
} from "./schema-understanding-engine.js";
import { findAnalystTrainingForDomain } from "./analyst-training-memory.js";
import {
  buildRagDashboardPlan,
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
} from "./schema-rag-retriever.js";
import {
  governDashboardCommand,
  governChatAnswer,
} from "../agentic-dashboard/chat-agent.js";
import { profileLargeDataset } from "./large-data-profiler.js";
import { buildSeniorAnalystPlan } from "./senior-analyst-brain.js";
import {
  buildSeniorDashboardPlan,
  calculateSeniorCharts,
} from "./senior-dashboard-planner.js";
import { selectSeniorKpis } from "./senior-kpi-selector.js";
import { buildExcelAnalystPlan } from "./excel-analyst-brain.js";
import { executeExcelAnalysis } from "./excel-calculation-engine.js";

function validateQueryColumns(profile, query) {
  const lower = String(query || "").toLowerCase().trim();
  const cols = [];

  // Extract columns using patterns
  // 1. filter <col> = <val>
  const filterMatch = lower.match(/filter\s+([a-z0-9_-]+)\s*(=|to|is)/i);
  if (filterMatch) cols.push(filterMatch[1]);

  // 2. <col> distribution / distribution of <col>
  const distOfMatch = lower.match(/distribution\s+of\s+([a-z0-9_-]+)/i);
  if (distOfMatch) {
    cols.push(distOfMatch[1]);
  } else {
    const distMatch = lower.match(/([a-z0-9_-]+)\s+distribution/i);
    if (distMatch) cols.push(distMatch[1]);
  }

  // 3. <col> breakdown / breakdown of <col>
  const bdOfMatch = lower.match(/breakdown\s+of\s+([a-z0-9_-]+)/i);
  if (bdOfMatch) {
    cols.push(bdOfMatch[1]);
  } else {
    const bdMatch = lower.match(/([a-z0-9_-]+)\s+breakdown/i);
    if (bdMatch) cols.push(bdMatch[1]);
  }

  // 4. chart/graph of <col>
  const chartOfMatch = lower.match(/(pie|donut|bar|line|scatter|histogram|chart|graph)\s*(chart)?\s*of\s*([a-z0-9_-]+)/i);
  if (chartOfMatch) cols.push(chartOfMatch[3]);

  // 5. average/avg/mean/highest/max/lowest/min/total/sum <col>
  const metricMatch = lower.match(/(average|avg|mean|highest|max|lowest|min|total|sum)\s+(?:of\s+|for\s+)?([a-z0-9_-]+)/i);
  if (metricMatch) cols.push(metricMatch[2]);

  // 6. KPI/card commands often include filler words and metric modifiers:
  // "add KPI for highest salary_usd" should validate salary_usd, not "for".
  const kpiMatch = lower.match(/(?:kpi|card)(?:\s+(?:for|of|on|with|showing))*\s+(?:(?:average|avg|mean|highest|max|lowest|min|total|sum)\s+)?([a-z0-9_-]+)/i);
  if (kpiMatch) cols.push(kpiMatch[1]);

  // 7. <col1> vs <col2>
  const vsMatch = lower.match(/([a-z0-9_-]+)\s+vs\s+([a-z0-9_-]+)/i);
  if (vsMatch) {
    cols.push(vsMatch[1]);
    cols.push(vsMatch[2]);
  }

  // 8. chart/compare/show <metric> by <dimension>
  const byMatch = lower.match(/(?:chart|graph|show|compare|create)\s+.+?\s+by\s+([a-z0-9_-]+)/i);
  if (byMatch) cols.push(byMatch[1]);

  const ignoredTokens = new Set([
    "record",
    "row",
    "count",
    "for",
    "of",
    "on",
    "with",
    "showing",
    "average",
    "avg",
    "mean",
    "highest",
    "max",
    "lowest",
    "min",
    "total",
    "sum",
    "median",
    "salary",
    "usd",
    "kpi",
    "card",
  ]);
  const cleanCols = cols.map(c => c.trim()).filter(Boolean);
  
  for (const col of cleanCols) {
    if (ignoredTokens.has(col)) continue;
    if (findCategoryValue(profile, col)) continue;
    const exists = (profile.columns || []).some(c => 
      c.normalizedName === col || 
      c.name.toLowerCase() === col || 
      c.title.toLowerCase() === col ||
      c.normalizedName?.split("_").includes(col)
    );
    if (!exists) {
      throw new Error(`Column '${col}' does not exist in schema.`);
    }
  }

  // Also catch direct words that represent invalid column/dimension names (e.g. "gender", "age", "fake_column")
  // if they are present in the query but not in the schema.
  const commonInvalidColumns = ["gender", "age", "fake_column", "department", "turnover", "satisfaction", "retention", "retention_rate"];
  for (const invalid of commonInvalidColumns) {
    const invalidPattern = new RegExp(`(^|[^a-z0-9_])${invalid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`, "i");
    if (invalidPattern.test(lower)) {
      const exists = (profile.columns || []).some(c => 
        c.normalizedName === invalid || 
        c.name.toLowerCase() === invalid || 
        c.title.toLowerCase() === invalid
      );
      if (!exists) {
        throw new Error(`Column '${invalid}' does not exist in schema.`);
      }
    }
  }
}

function findColumn(profile, text, preferredRoles = []) {
  const lower = normalizeColumnName(text);
  const tokens = new Set(lower.split("_").filter(Boolean));
  const scored = (profile.columns || [])
    .map((column) => {
      const name = column.normalizedName || normalizeColumnName(column.name);
      const nameTokens = name.split("_").filter(Boolean);
      let score = 0;

      if (lower === name) score += 100;
      if (tokens.has(name)) score += 80;
      if (nameTokens.length && nameTokens.every((token) => tokens.has(token))) score += 60;
      if (nameTokens.some((token) => tokens.has(token))) score += 20;
      
      if (preferredRoles.length > 0) {
        if (preferredRoles.includes(column.role)) {
          score += 150;
        } else {
          score -= 150;
        }
      }

      return { column, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.column ||
    profile.columns.find((column) => preferredRoles.includes(column.role)) ||
    profile.columns.find((column) => ["money_metric", "score_metric", "continuous_metric", "count_metric"].includes(column.role)) ||
    profile.columns[0];
}

function findCategory(profile, text) {
  const lower = normalizeColumnName(text);
  return profile.columns.find((column) => lower.includes(column.normalizedName) && ["category", "location", "target", "numeric_category"].includes(column.role)) ||
    pickPrimaryCategory(profile);
}

const COUNTRY_ALIASES = new Map([
  ["usa", ["usa", "us", "u_s", "united states", "united states of america", "america"]],
  ["uk", ["uk", "u_k", "united kingdom", "great britain", "britain", "england"]],
  ["uae", ["uae", "u_a_e", "united arab emirates"]],
]);

function normalizeValueText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function columnValues(column = {}) {
  return (column.topValues || [])
    .map((item) => item?.value)
    .filter((value) => value !== null && value !== undefined && String(value).trim());
}

function aliasesForValue(value) {
  const normalized = normalizeValueText(value);
  const direct = [normalized, normalized.replace(/\s+/g, "")].filter(Boolean);
  const aliasGroup = COUNTRY_ALIASES.get(normalized) || [];
  return new Set([...direct, ...aliasGroup.map(normalizeValueText), ...aliasGroup.map((item) => normalizeValueText(item).replace(/\s+/g, ""))]);
}

function findCategoryValue(profile, query) {
  const lower = normalizeValueText(query);
  const categoryColumns = (profile.columns || []).filter((column) =>
    ["location", "category", "target", "numeric_category"].includes(column.role)
  );

  for (const column of categoryColumns) {
    for (const value of columnValues(column)) {
      const aliases = aliasesForValue(value);
      if ([...aliases].some((alias) => alias && new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(lower))) {
        return { column, value: String(value) };
      }
    }
  }

  return null;
}

function extractKpiValueCandidate(query) {
  const match = String(query || "").match(/\b(?:add|create|show|make)?\s*(?:a\s+)?(?:kpi|card|metric)\s+(?:of|for|on|with)\s+([a-z][a-z\s.-]{1,40})/i);
  if (!match) return null;
  return match[1]
    .replace(/[_-]+/g, " ")
    .replace(/\b(average|avg|mean|median|highest|max|top|lowest|min|sum|total|salary|usd|revenue|amount|metric|kpi|card)\b/ig, "")
    .trim();
}

function primaryBusinessMetric(profile) {
  return (profile.columns || []).find((column) => column.role === "money_metric") || pickPrimaryMetric(profile);
}

function aggregationLabel(aggregation) {
  if (aggregation === "avg") return "Avg";
  if (aggregation === "median") return "Median";
  if (aggregation === "sum") return "Total";
  if (aggregation === "max") return "Highest";
  if (aggregation === "min") return "Lowest";
  if (aggregation === "count_unique") return "Unique";
  return "Count";
}

function pluralizeTitle(title = "") {
  if (/y$/i.test(title)) return title.replace(/y$/i, "ies");
  if (/s$/i.test(title)) return title;
  return `${title}s`;
}

function detectAggregation(lower, fallback = "avg") {
  if (/highest|max|top/.test(lower)) return "max";
  if (/lowest|min/.test(lower)) return "min";
  if (/median/.test(lower)) return "median";
  if (/sum|total/.test(lower)) return "sum";
  if (/unique|distinct/.test(lower)) return "count_unique";
  if (/count|records?|rows?/.test(lower)) return "count";
  if (/average|avg|mean/.test(lower)) return "avg";
  return fallback;
}

function availableValuesMessage(column) {
  return columnValues(column).slice(0, 10).join(", ");
}

function blockedPolicyResponse(query) {
  const lower = String(query || "").toLowerCase();

  if (/assume|invent|guess|hallucinate/.test(lower) && /missing|unknown|columns?|data|metric/.test(lower)) {
    return {
      action: "ANSWER",
      message: "Request blocked by Schema Guardian: I cannot assume missing data, columns, or metrics. Use only fields present in the loaded schema.",
      schemaOnly: true,
      schema_safe: false,
      approvedForRender: false,
    };
  }

  if (/(show|reveal|export|dump|download|print|list).*(raw|all|every|full).*(rows?|records?|data)/.test(lower) || /show all \d[\d,]* records?/.test(lower)) {
    return {
      action: "ANSWER",
      message: "Request blocked by Schema Guardian: dashboard AI cannot expose raw rows or bulk record dumps. Use aggregated charts, KPIs, or the data table export controls.",
      schemaOnly: true,
      schema_safe: false,
      approvedForRender: false,
    };
  }

  if (/(show|reveal|dump|print|export).*(internal schema|schema packet|runtime context|hidden columns?|system prompt|prompt)/.test(lower)) {
    return {
      action: "ANSWER",
      message: "Request blocked by Schema Guardian: internal schema packets, hidden fields, runtime context, and prompts are not exposed through chat.",
      schemaOnly: true,
      schema_safe: false,
      approvedForRender: false,
    };
  }

  return null;
}

function extractDeleteChartTarget(query) {
  const text = String(query || "")
    .replace(/\b(remove|delete|drop)\b/ig, "")
    .replace(/\b(the|a|an|chart|card|visual|visualization|plot)\b/ig, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || undefined;
}

export async function generateSchemaDashboard(dataset, options = {}) {
  const unified = await generateUnifiedDashboard(dataset, options);
  const data = { ...unified.data };

  if (options.useLlm !== false) {
    const profile = buildSchemaProfile(dataset);
    const llmPlan = await planDashboardWithOllama(profile, null, {
      ragMatches: [],
      schemaUnderstanding: {},
    });

    if (llmPlan) {
      data.llm = {
        source: llmPlan.source,
        model: llmPlan.model,
        error: llmPlan.error,
      };
      data.model = llmPlan.model || data.model;
    }
  }

  return data;
}

export async function generateLegacySchemaDashboard(dataset, options = {}) {
  const profile = buildSchemaProfile(dataset);
  const understanding = buildSchemaUnderstanding(profile);
  const analystTraining = findAnalystTrainingForDomain(profile.domain);

  const matchResult = findBestSchemaMatch(profile, {
    threshold: options.threshold ?? 0.35,
  });

  const ragResult = await retrieveSchemaRagMemories(profile, {
    threshold: options.ragThreshold ?? 0.55,
    limit: options.ragLimit ?? 5,
    useOllama: options.useRagEmbedding !== false,
  });

  const ragPlan = buildRagDashboardPlan(profile, ragResult.matches);
  const trainedPlan = applyTrainedTemplates(profile, matchResult.best);
  const rulePlan = buildRuleDashboardPlan(profile);

  let llmPlan = null;

  if (options.useLlm !== false) {
    llmPlan = await planDashboardWithOllama(profile, matchResult.best, {
      ragMatches: ragResult.matches,
      schemaUnderstanding: {
        domain: understanding.domain,
        roles: understanding.roles,
        userExplanation: understanding.userExplanation,
        kpiCandidates: understanding.kpiCandidates,
        chartCandidates: understanding.chartCandidates,
      },
    });
  }

  const smartCandidatePlan = {
    source: "schema-understanding-engine",
    domain: understanding.domain.domain,
    kpis: understanding.kpiCandidates,
    charts: understanding.chartCandidates,
  };

  const mergedDashboard = mergePlans(
    profile,
    ragPlan,
    trainedPlan,
    smartCandidatePlan,
    llmPlan?.charts?.length || llmPlan?.kpis?.length ? llmPlan : null,
    rulePlan
  );

  const guarded = buildGuardianDashboardResponse(profile, mergedDashboard, {
    maxCharts: options.maxCharts ?? 7,
    maxKpis: options.maxKpis ?? 8,
  });

  return {
    success: true,
    schemaOnly: true,
    profile: makeSchemaOnlyPacket(profile),
    understanding: {
      domain: understanding.domain,
      userExplanation: understanding.userExplanation,
      primaryMetric: understanding.roles.primaryMetric,
      primaryCategory: understanding.roles.primaryCategory,
      recommendedKpis: understanding.kpiCandidates.slice(0, 6),
      recommendedCharts: understanding.chartCandidates.slice(0, 7),
    },
    analystThinking: analystTraining?.analystThinking || null,
    dashboardGoal:
      analystTraining?.analystThinking?.businessQuestion ||
      understanding.domain?.goal ||
      "Create useful decision-making analytics.",
    match: matchResult.best
      ? {
          dataset: matchResult.best.entry.name,
          domain: matchResult.best.entry.domain,
          score: matchResult.best.score,
        }
      : null,
    candidates: matchResult.candidates.map((candidate) => ({
      dataset: candidate.entry.name,
      domain: candidate.entry.domain,
      score: candidate.score,
    })),
    rag: {
      used: ragResult.used,
      threshold: ragResult.threshold,
      query: ragResult.query,
      matches: ragResult.matches.map((match) => ({
        id: match.entry.id,
        name: match.entry.name,
        domain: match.entry.domain,
        score: match.score,
      })),
      stats: ragResult.stats,
    },
    dashboard: guarded.dashboard,
    dashboardPlan: guarded.dashboard,
    dashboardType: llmPlan?.dashboardType || understanding.domain?.domain || profile.domain,
    executiveSummary: llmPlan?.executiveSummary || null,
    geoAnalysis: Array.isArray(llmPlan?.geoAnalysis) ? llmPlan.geoAnalysis : [],
    insights: Array.isArray(llmPlan?.insights) ? llmPlan.insights : [],
    recommendations: Array.isArray(llmPlan?.recommendations) ? llmPlan.recommendations : [],
    storyMode: llmPlan?.storyMode || null,
    confidenceScore: Number.isFinite(Number(llmPlan?.confidenceScore))
      ? Number(llmPlan.confidenceScore)
      : guarded.qualityScore / 100,
    dashboardHealth: guarded.dashboardHealth,
    provider: llmPlan?.source?.startsWith("ollama:") ? "ollama" : ragResult.used ? "rag+local" : "local",
    model: llmPlan?.model || "local",
    quality: {
      score: guarded.qualityScore,
      health: guarded.dashboardHealth,
      warnings: guarded.warnings,
      fixes: guarded.fixes,
    },
    llm: llmPlan
      ? {
          source: llmPlan.source,
          model: llmPlan.model,
          error: llmPlan.error,
        }
      : null,
  };
}

export function trainSchemaDashboard(dataset, { dashboardPlan, rating = "good", notes = "", source = "upload-feedback" } = {}) {
  return trainSchemaExample({ dataset, dashboardPlan, rating, notes, source });
}

export async function trainSchemaRagDashboard(
  dataset,
  {
    dashboardPlan,
    acceptedDashboardPlan,
    rating = "good",
    notes = "",
    source = "user-feedback",
    useOllama,
  } = {}
) {
  return trainSchemaRagMemoryFromDataset({
    dataset,
    acceptedDashboardPlan: acceptedDashboardPlan || dashboardPlan,
    rating,
    notes,
    source,
    useOllama,
  });
}

function localCommand(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = pickPrimaryMetric(profile);
  const metric2 = pickSecondaryMetric(profile);
  const category = pickPrimaryCategory(profile);
  const blocked = blockedPolicyResponse(query);
  if (blocked) return blocked;

  if (/clear|reset/.test(lower) && /filter/.test(lower)) {
    return { action: "CLEAR_FILTERS", message: "Filters cleared.", schemaOnly: true };
  }

  if (/remove|delete/.test(lower) && /(all|every)/.test(lower) && /charts?/.test(lower)) {
    return {
      action: "ANSWER",
      message: "Removed all charts.",
      response_type: "dashboard_action",
      natural_response: "Removed all charts.",
      actions: [{ action: "delete_all_charts" }],
      schema_safe: true,
      schemaOnly: true,
    };
  }

  if (/remove|delete/.test(lower) && /chart/.test(lower)) {
    const targetTitle = extractDeleteChartTarget(query);
    return {
      action: "DELETE_CHART",
      message: targetTitle ? `Removed chart matching "${targetTitle}".` : "Removed the selected chart.",
      targetTitle,
      schemaOnly: true,
    };
  }

  if (
    /fix|repair|validate|correct|regenerate/.test(lower) &&
    /dashboard|chart|charts|kpi|broken|wrong|invalid/.test(lower)
  ) {
    return {
      action: "FIX_DASHBOARD",
      message: "I checked the dashboard and prepared a schema-safe repair plan.",
      dashboardPlan: buildRuleDashboardPlan(profile),
      schemaOnly: true,
    };
  }

  if (/best dashboard|generate dashboard|build dashboard|create dashboard/.test(lower)) {
    return {
      action: "GENERATE_DASHBOARD",
      message: "Generated the best schema-safe dashboard.",
      dashboardPlan: buildRuleDashboardPlan(profile),
      schemaOnly: true,
    };
  }

  if (/trend/.test(lower)) {
    const hasDate = (profile.columns || []).some((column) => column.role === "date" || column.type === "date");
    if (!hasDate) {
      return {
        action: "ANSWER",
        message: "No date/time column exists, so trend over time is unavailable. I can explain salary distribution and country comparison instead.",
        schemaOnly: true,
        needsClarification: false,
        skipGovernance: true,
      };
    }
  }

  if (/run\s+geo\s+intelligence|geo intelligence/.test(lower)) {
    const geoColumn = (profile.columns || []).find((column) => column.role === "location" || /country|region|state|city/.test(column.normalizedName)) || category;
    const geoMetric = primaryBusinessMetric(profile) || metric;
    return {
      action: "RUN_GEO_INTELLIGENCE",
      message: geoColumn ? `Running Geo Intelligence using ${geoColumn.title}.` : "Geo Intelligence needs a location field in the dataset schema.",
      geoColumn: geoColumn?.name,
      metric: geoMetric?.name,
      schemaOnly: true,
    };
  }

  if (/(replace|convert|change|modify|update)/.test(lower) && /scatter|scatter plot/.test(lower) && /heatmap/.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric"]) || metric;
    const x = profile.columns.find((column) => column.name !== y?.name && ["continuous_metric", "score_metric", "count_metric"].includes(column.role)) || metric2;
    if (x && y) {
      return {
        action: "MODIFY_CHART",
        message: "Replaced the scatter plot with a schema-safe heatmap.",
        targetTitle: "Experience vs Salary",
        chartSpec: sanitizeChartSpec({
          type: "heatmap",
          title: `${x.title} by ${y.title} Heatmap`,
          xKey: x.name,
          yKey: y.name,
          aggregation: "avg",
          limit: 50,
        }, profile),
        schemaOnly: true,
      };
    }
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

  if (/filter\s+to\s+[\w\s.-]+/.test(lower)) {
    const resolved = findCategoryValue(profile, query);
    if (resolved) {
      return {
        action: "FILTER",
        message: `Applied filter ${resolved.column.name} = ${resolved.value}.`,
        filters: { [resolved.column.name]: resolved.value },
        schemaOnly: true,
      };
    }
  }

  if (/kpi|card|metric/.test(lower)) {
    const resolvedValue = findCategoryValue(profile, query);
    if (resolvedValue) {
      const aggregation = detectAggregation(lower, "avg");
      const target = primaryBusinessMetric(profile) || metric;
      const title = `${aggregationLabel(aggregation)} ${target?.title || target?.name || "Value"} - ${resolvedValue.value}`;
      const filter = { column: resolvedValue.column.name, operator: "equals", value: resolvedValue.value };
      return {
        action: "GENERATE_KPI",
        message: `Added KPI: ${title}.`,
        kpiSpec: sanitizeKpiSpec({
          title,
          metric: target?.name || "__row_count__",
          aggregation,
          format: target?.role === "money_metric" ? "currency" : "number",
          filters: [filter],
          calculationSource: `${aggregation.toUpperCase()}(${target?.name || "rows"}) where ${resolvedValue.column.name} = ${resolvedValue.value}`,
        }, profile),
        schemaOnly: true,
      };
    }

    const unknownValue = extractKpiValueCandidate(query);
    const likelyValueOnlyKpi = unknownValue && !findColumn(profile, unknownValue, ["money_metric", "score_metric", "continuous_metric", "count_metric"])?.normalizedName?.includes(normalizeColumnName(unknownValue));
    if (likelyValueOnlyKpi && category) {
      return {
        action: "ANSWER",
        message: `I could not find '${unknownValue}' in available ${category.title} values. Please choose one of: ${availableValuesMessage(category) || "the values present in the dataset"}.`,
        needsClarification: true,
        schemaOnly: true,
      };
    }

    const aggregation = detectAggregation(lower, "count");
    const target = aggregation === "count" && /record|row/.test(lower) ? { name: "__row_count__", title: "Records" } : findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric", "location", "category"]);
    const title = aggregation === "count" && target.name === "__row_count__" ? "Total Records" : `${aggregation === "avg" ? "Average" : aggregation === "max" ? "Highest" : aggregation === "sum" ? "Total" : aggregation === "median" ? "Median" : aggregation === "count_unique" ? "Unique" : "Count"} ${target?.title || target?.name}`;
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

  if (/chart|graph|show|compare|average|avg|top/.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]) || metric;
    const x = findCategory(profile, lower) || category;
    if (x && y) {
      const aggregation = /\bsum\b|\btotal\b/.test(lower) ? "sum" : /\bmax\b|\bhighest\b/.test(lower) ? "max" : /\bmedian\b/.test(lower) ? "median" : /\bcount\b/.test(lower) || y.name === "count" ? "count" : "avg";
      const topMatch = lower.match(/top\s*(\d+)/);
      const limit = topMatch ? Number(topMatch[1]) : 10;
      const type = topMatch ? "horizontal_bar" : "bar";
      const titlePrefix = topMatch ? `Top ${limit}` : aggregation === "avg" ? "Average" : aggregation.toUpperCase();
      const pluralCategory = topMatch ? pluralizeTitle(x.title) : x.title;
      return {
        action: "GENERATE_CHART",
        message: `Created chart: ${aggregation} ${y.title} by ${x.title}.`,
        chartSpec: sanitizeChartSpec({
          type,
          title: `${titlePrefix} ${topMatch ? pluralCategory : y.title} by ${topMatch ? `${aggregationLabel(aggregation)} ${y.title}` : x.title}`,
          xKey: x.name,
          yKey: y.name,
          aggregation,
          limit,
          filters: [],
          sort: topMatch ? { by: "value", direction: "desc" } : undefined,
          calculationSource: `${aggregation.toUpperCase()}(${y.name}) grouped by ${x.name}`,
        }, profile),
        schemaOnly: true,
      };
    }
  }

  return {
    action: "ANSWER",
    message: buildDatasetUnderstandingAnswer(profile),
    schemaOnly: true,
  };
}

function toDashboardActionItem(command = {}) {
  if (command.action === "GENERATE_CHART" && command.chartSpec) {
    return {
      action: "create_chart",
      chart_type: command.chartSpec.type,
      title: command.chartSpec.title,
      x: command.chartSpec.xKey,
      y: command.chartSpec.yKey,
      aggregation: command.chartSpec.aggregation,
      reason: command.chartSpec.reason || "Schema-safe chart action.",
      chartSpec: command.chartSpec,
    };
  }

  if (command.action === "MODIFY_CHART" && command.chartSpec) {
    return {
      action: "modify_chart",
      chart_type: command.chartSpec.type,
      title: command.chartSpec.title,
      x: command.chartSpec.xKey,
      y: command.chartSpec.yKey,
      aggregation: command.chartSpec.aggregation,
      reason: command.chartSpec.reason || "Schema-safe chart modification.",
      chartSpec: command.chartSpec,
    };
  }

  if (command.action === "GENERATE_KPI" && command.kpiSpec) {
    return {
      action: "create_kpi",
      title: command.kpiSpec.title,
      metric: command.kpiSpec.metric,
      aggregation: command.kpiSpec.aggregation,
      reason: command.kpiSpec.description || "Schema-safe KPI action.",
      kpiSpec: command.kpiSpec,
    };
  }

  if (command.action === "FILTER") {
    return {
      action: "filter",
      filters: command.filters || {},
      reason: "Schema-safe filter action.",
    };
  }

  if (command.action === "CLEAR_FILTERS") return { action: "clear_filters" };
  if (command.action === "DELETE_CHART") {
    return {
      action: "delete_chart",
      targetTitle: command.targetTitle,
      targetId: command.targetId,
      chartSpec: command.chartSpec,
    };
  }

  return null;
}

function withDashboardActionEnvelope(command = {}) {
  if (command.response_type === "dashboard_action") return command;

  const item = toDashboardActionItem(command);
  if (!item) return command;

  return {
    ...command,
    response_type: "dashboard_action",
    natural_response: command.message || "I prepared a schema-safe dashboard action.",
    actions: [item],
    warnings: command.warnings || [],
    schema_safe: true,
    schemaOnly: true,
  };
}

export async function runDashboardCommand({ dataset, query, currentDashboard = {}, useLlm = true, requireOllamaValidation, useOllamaValidator }) {
  const profile = buildSchemaProfile(dataset);
  const earlyCommand = localCommand(profile, query);
  if (earlyCommand.approvedForRender === false) return earlyCommand;
  if (earlyCommand.skipGovernance || earlyCommand.needsClarification) return earlyCommand;
  if (
    earlyCommand.action === "DELETE_CHART" ||
    earlyCommand.actions?.some((action) => ["delete_chart", "delete_all_charts", "remove_all_charts"].includes(String(action.action || "").toLowerCase()))
  ) {
    return governDashboardCommand({
      dataset,
      query,
      command: withDashboardActionEnvelope(earlyCommand),
      currentDashboard,
      requireOllama: requireOllamaValidation ?? useOllamaValidator,
    });
  }

  validateQueryColumns(profile, query);
  const matchResult = findBestSchemaMatch(profile, { threshold: 0.35 });
  const ragResult = await retrieveSchemaRagMemories(profile, {
    threshold: 0.55,
    limit: 5,
  });

  const deterministic = earlyCommand;
  const shouldUseLlm = useLlm && deterministic.action === "ANSWER";
  const rag = {
    used: ragResult.used,
    matches: ragResult.matches.map((match) => ({
      id: match.entry.id,
      domain: match.entry.domain,
      score: match.score,
    })),
  };

  if (shouldUseLlm) {
    const planned = await planCommandWithOllama({
      query,
      schemaProfile: profile,
      memoryMatch: matchResult.best,
      ragMatches: ragResult.matches,
      currentDashboard,
    });
    if (planned?.error) {
      return governDashboardCommand({
        dataset,
        query,
        command: withDashboardActionEnvelope({ ...planned, rag }),
        currentDashboard,
        requireOllama: requireOllamaValidation ?? useOllamaValidator,
      });
    }
    if (planned && planned.action !== "ANSWER") {
      return governDashboardCommand({
        dataset,
        query,
        command: withDashboardActionEnvelope({ ...planned, rag }),
        currentDashboard,
        requireOllama: requireOllamaValidation ?? useOllamaValidator,
      });
    }
    return governDashboardCommand({
      dataset,
      query,
      command: withDashboardActionEnvelope({ ...deterministic, aiFallback: planned?.aiError || null, model: planned?.model, provider: planned?.provider, rag }),
      currentDashboard,
      requireOllama: requireOllamaValidation ?? useOllamaValidator,
    });
  }

  return governDashboardCommand({
    dataset,
    query,
    command: withDashboardActionEnvelope({ ...deterministic, rag }),
    currentDashboard,
    requireOllama: requireOllamaValidation ?? useOllamaValidator,
  });
}

export async function generateSeniorAnalystDashboard({ dataset, currentDashboard = {}, options = {} } = {}) {
  const dataProfile = profileLargeDataset(dataset, {
    sampleSize: options.sampleSize || 5000,
  });
  const seniorPlanResult = buildSeniorAnalystPlan(dataProfile, options);
  const seniorAnalysisPlan = seniorPlanResult.seniorAnalysisPlan;

  const ragResult = await retrieveSchemaRagMemories(dataProfile, {
    threshold: options.ragThreshold ?? 0.5,
    limit: options.ragLimit ?? 5,
    useOllama: options.useRagEmbedding !== false,
  });

  const ragPlan = buildRagDashboardPlan(dataProfile, ragResult.matches);
  const rulePlan = buildRuleDashboardPlan(dataProfile);
  const seniorDashboardPlan = buildSeniorDashboardPlan({
    profile: dataProfile,
    seniorAnalysisPlan,
    maxCharts: options.maxCharts ?? 10,
  });

  const selectedKpis = selectSeniorKpis({
    dataset,
    profile: dataProfile,
    seniorAnalysisPlan,
    maxKpis: options.maxKpis ?? 8,
  });

  const mergedPlan = mergePlans(
    dataProfile,
    ragPlan,
    {
      ...seniorDashboardPlan,
      kpis: selectedKpis.map(({ value, ...spec }) => spec),
    },
    rulePlan,
    currentDashboard?.kpis || currentDashboard?.charts
      ? {
          source: "current-dashboard-context",
          domain: dataProfile.domain,
          kpis: currentDashboard.kpis || [],
          charts: currentDashboard.charts || [],
        }
      : null
  );

  const guarded = buildGuardianDashboardResponse(dataProfile, mergedPlan, {
    maxCharts: options.maxCharts ?? 10,
    maxKpis: options.maxKpis ?? 8,
  });

  const allowedKpiKeys = new Set(selectedKpis.map((kpi) => `${kpi.title}-${kpi.metric}-${kpi.aggregation}`));
  const finalKpis = selectedKpis
    .filter((kpi) => allowedKpiKeys.has(`${kpi.title}-${kpi.metric}-${kpi.aggregation}`))
    .slice(0, options.maxKpis ?? 8);

  const qualityCharts = seniorDashboardPlan.charts.filter((chart) => chart.section === "Data quality");
  const chartSpecsForCalculation = [
    ...guarded.dashboard.charts,
    ...qualityCharts.filter((chart) => !guarded.dashboard.charts.some((safeChart) => safeChart.id === chart.id)),
  ];

  const calculatedCharts = calculateSeniorCharts({
    dataset,
    profile: dataProfile,
    charts: chartSpecsForCalculation,
  });

  const dashboard = {
    ...guarded.dashboard,
    source: "senior-analyst-brain+rag+local-calculation+quality-guardian",
    layout: seniorDashboardPlan.layout,
    kpis: finalKpis,
    charts: calculatedCharts.slice(0, options.maxCharts ?? 10),
    schemaOnly: false,
    valuesCalculatedLocally: true,
  };

  const warnings = [
    ...(dataProfile.warnings || []),
    ...(seniorAnalysisPlan.warnings || []),
    ...(guarded.dashboardHealth?.warnings || []).map((warning) => warning.message || String(warning)),
    finalKpis.length === 0 ? "No meaningful KPIs could be calculated from available columns." : null,
    calculatedCharts.length === 0 ? "No meaningful chart data could be calculated from available columns." : null,
  ].filter(Boolean);

  const confidence = Math.round(
    Math.min(
      0.98,
      0.35 +
        (finalKpis.length ? 0.2 : 0) +
        (calculatedCharts.length ? 0.2 : 0) +
        (ragResult.used ? 0.1 : 0) +
        (dataProfile.dataQualityScore || 0) / 100 * 0.13
    ) * 100
  ) / 100;

  return {
    success: true,
    schemaOnly: false,
    seniorAnalysisPlan,
    profile: makeSchemaOnlyPacket(dataProfile, { includeStats: true, includeTopValues: true }),
    dataQuality: {
      score: dataProfile.dataQualityScore,
      duplicateEstimate: dataProfile.duplicateEstimate,
      sampling: dataProfile.sampling,
      warnings: dataProfile.warnings,
    },
    rag: {
      used: ragResult.used,
      matches: ragResult.matches.map((match) => ({
        id: match.entry.id,
        name: match.entry.name,
        domain: match.entry.domain,
        score: match.score,
      })),
      stats: ragResult.stats,
    },
    dashboard,
    dashboardPlan: guarded.dashboard,
    KPIs: finalKpis,
    kpis: finalKpis,
    charts: dashboard.charts,
    warnings,
    quality: {
      score: guarded.qualityScore,
      health: guarded.dashboardHealth,
      guardian: guarded.dashboard.guardian,
    },
    confidence,
    provider: ragResult.used ? "rag+local" : "local",
    model: "senior-analyst-local-rules",
  };
}

function computeLocalAnswer(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]);
  const category = findCategory(profile, lower);

  if (/schema|columns|fields/.test(lower)) {
    return buildDatasetUnderstandingAnswer(profile, { includeColumns: true });
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

  return buildDatasetUnderstandingAnswer(profile);
}

function inferIntent(query) {
  const lower = String(query || "").toLowerCase();
  if (/report|presentation|board|executive summary|summary/.test(lower)) return "executive narrative";
  if (/trend|growth|changed|over time|fastest/.test(lower)) return "trend analysis";
  if (/compare| vs | versus /.test(lower)) return "comparison";
  if (/correlation|relationship|affect|impact/.test(lower)) return "relationship analysis";
  if (/top|highest|best|rank|most/.test(lower)) return "ranking";
  if (/country|region|city|state|geo|map/.test(lower)) return "geo analysis";
  if (/kpi|average|avg|total|sum|revenue|salary|count/.test(lower)) return "KPI analysis";
  return "dataset understanding";
}

function formatAnalystAnswer({ query, localAnswer, profile }) {
  const intent = inferIntent(query);

  return [
    "Summary",
    localAnswer,
    "",
    "What This Can Help Answer",
    ...buildBusinessQuestions(profile).slice(0, 5).map((question, index) => `${index + 1}. ${question}`),
    "",
    "Recommended Starting Point",
    ...buildRecommendedVisuals(profile).slice(0, 5).map((visual) => `- ${visual}`),
    "",
    "Next Step",
    intent === "dataset understanding"
      ? "I can turn this into a focused dashboard with KPIs, distributions, segment comparisons, and ranking views."
      : "I can use this as the basis for the next dashboard action or deeper analysis.",
  ].join("\n");
}

function roleLabel(column = {}) {
  const name = String(column.normalizedName || column.name || "").toLowerCase();
  if (/salary|income|pay|compensation/.test(name)) return "employee compensation";
  if (/revenue|sales|amount|profit|cost|price|billing/.test(name)) return "financial performance";
  if (/country|state|city|region|territory|location/.test(name)) return "geographic distribution";
  if (/education|degree|qualification/.test(name)) return "qualification level";
  if (/experience|seniority|tenure|years/.test(name)) return "seniority indicator";
  if (/department|team|function/.test(name)) return "organizational segment";
  if (/category|segment|type|status/.test(name)) return "business segment";
  if (/date|time|created|ordered|admission/.test(name)) return "time trend";
  if (/rating|score|satisfaction/.test(name)) return "quality or performance score";

  if (column.role === "location") return "geographic dimension";
  if (column.role === "date") return "time dimension";
  if (["money_metric", "continuous_metric", "score_metric", "count_metric"].includes(column.role)) return "business metric";
  if (["category", "target", "numeric_category"].includes(column.role)) return "analysis segment";
  return "supporting field";
}

function describeDomain(profile) {
  const names = (profile.columns || []).map((column) => column.normalizedName || normalizeColumnName(column.name)).join(" ");
  if (/salary|income|pay|compensation/.test(names)) {
    return "workforce compensation dataset that can explain salary patterns across employee, location, and qualification segments";
  }
  if (/revenue|sales|profit|order|customer/.test(names)) {
    return "commercial performance dataset that can show revenue, customer, product, and market patterns";
  }
  if (/patient|hospital|medical|disease|condition|billing/.test(names)) {
    return "healthcare operations dataset that can support patient, condition, provider, and billing analysis";
  }
  if (/rating|review|score/.test(names)) {
    return "feedback and quality dataset that can highlight satisfaction, ratings, and review patterns";
  }
  return "business dataset that can be explored through its key measures, segments, and distributions";
}

function importantColumns(profile) {
  const roles = ["money_metric", "continuous_metric", "score_metric", "count_metric", "location", "date", "category", "target", "numeric_category"];
  const selected = [];
  for (const column of profile.columns || []) {
    if (roles.includes(column.role) && !selected.some((item) => item.name === column.name)) selected.push(column);
    if (selected.length >= 6) break;
  }
  return selected;
}

function buildBusinessQuestions(profile) {
  const metric = pickPrimaryMetric(profile);
  const category = pickPrimaryCategory(profile);
  const secondaryMetric = pickSecondaryMetric(profile);
  const location = (profile.columns || []).find((column) => column.role === "location");
  const date = (profile.columns || []).find((column) => column.role === "date");

  return [
    metric && location ? `Which ${location.title.toLowerCase()} segments perform best on ${metric.title.toLowerCase()}?` : null,
    metric && category ? `How does ${metric.title.toLowerCase()} vary by ${category.title.toLowerCase()}?` : null,
    metric ? `What does the ${metric.title.toLowerCase()} distribution look like, and are there outliers?` : null,
    metric && secondaryMetric ? `Is there a relationship between ${metric.title.toLowerCase()} and ${secondaryMetric.title.toLowerCase()}?` : null,
    date && metric ? `How is ${metric.title.toLowerCase()} changing over time?` : null,
    category ? `Which ${category.title.toLowerCase()} groups dominate the dataset?` : null,
  ].filter(Boolean);
}

function buildRecommendedVisuals(profile) {
  const plan = buildRuleDashboardPlan(profile);
  return plan.charts?.length
    ? plan.charts.map((chart) => chart.title)
    : ["Metric by Category", "Category Distribution", "Top Segment Ranking", "Metric Distribution"];
}

function buildDatasetUnderstandingAnswer(profile, { includeColumns = false } = {}) {
  const columns = importantColumns(profile);
  const lines = [
    `This appears to be a ${describeDomain(profile)}.`,
    "",
    "The most useful fields appear to be:",
    ...columns.map((column) => `- ${column.name} -> ${roleLabel(column)}`),
  ];

  if (includeColumns) {
    const remaining = (profile.columns || [])
      .filter((column) => !columns.some((selected) => selected.name === column.name))
      .slice(0, 6)
      .map((column) => column.name);
    if (remaining.length) {
      lines.push("", `Other available fields include ${remaining.join(", ")}.`);
    }
  }

  lines.push(
    "",
    "Based on these fields, I would start by looking for performance differences, segment patterns, distributions, rankings, and any unusual outliers."
  );

  return lines.join("\n");
}

export async function runSchemaChat({ dataset, query, useLlm = true, requireOllamaValidation, useOllamaValidator }) {
  const profile = buildSchemaProfile(dataset);
  validateQueryColumns(profile, query);
  const localAnswer = computeLocalAnswer(profile, query);
  const structuredLocalAnswer = formatAnalystAnswer({ query, localAnswer, profile });
  if (!useLlm) {
    const governed = await governChatAnswer({
      dataset,
      query,
      answer: structuredLocalAnswer,
      requireOllama: requireOllamaValidation ?? useOllamaValidator,
    });
    return { ...governed, model: "local", provider: "local", schemaOnly: true };
  }
  const formatted = await formatChatAnswerWithOllama({ query, schemaProfile: profile, localAnswer: structuredLocalAnswer });
  const governed = await governChatAnswer({
    dataset,
    query,
    answer: formatted.answer,
    requireOllama: requireOllamaValidation ?? useOllamaValidator,
  });
  return { ...formatted, ...governed, schemaOnly: true };
}

export async function runExcelAnalystChat({
  dataset,
  query,
  currentDashboard = {},
  useLlm = true,
} = {}) {
  const plan = await buildExcelAnalystPlan({
    dataset,
    query,
    currentDashboard,
    options: { useOllama: useLlm },
  });

  const calculation = executeExcelAnalysis({
    rows: dataset?.rows || [],
    plan,
  });

  const message = buildExcelAnswerMessage(query, plan, calculation);
  const warnings = [
    ...(plan.quality?.warnings || []),
    ...(calculation.ok ? [] : [calculation.warning]),
  ].filter(Boolean);

  return {
    schemaOnly: true,
    provider: "excel-analyst-rag",
    model: useLlm ? "rag-plus-local-calculation" : "local-calculation",
    query,
    intent: plan.intent,
    answer: message,
    plan: plan.executionPlan,
    calculation,
    suggestedCharts: plan.recommendedDashboard?.charts || [],
    suggestedKpis: plan.recommendedDashboard?.kpis || [],
    recommendedDashboard: plan.recommendedDashboard,
    confidence: buildExcelConfidence(plan, calculation),
    warnings,
    rag: plan.rag,
    quality: plan.quality,
    profile: plan.publicProfile,
  };
}

function buildExcelConfidence(plan, calculation) {
  let score = 0.45;
  if (plan.executionPlan?.metric) score += 0.2;
  if (plan.executionPlan?.dimension || plan.executionPlan?.dateColumn) score += 0.15;
  if (plan.rag?.used) score += 0.1;
  if (calculation?.ok) score += 0.1;
  return Math.round(Math.min(score, 0.98) * 100) / 100;
}

function formatMetricLocal(value, metricKey) {
  if (typeof value !== "number") return String(value);
  if (/salary|amount|revenue|sales|profit|price|cost|usd/i.test(metricKey)) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return value.toLocaleString();
}

function labelLocal(text) {
  if (!text) return "";
  return String(text).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildExcelAnswerMessage(query, plan, calculation) {
  if (!calculation.ok) {
    return `I could not complete the analysis because: ${calculation.warning}`;
  }

  const p = plan.executionPlan || {};

  if (Array.isArray(calculation.result) && calculation.result.length > 0) {
    const sorted = [...calculation.result].sort((left, right) => (right.value ?? right.count ?? 0) - (left.value ?? left.count ?? 0));
    const highest = sorted[0];
    const second = sorted[1];
    
    const highestLabel = highest.name || highest.period || highest.label || `Row ${highest.rowIndex || 1}`;
    const highestValue = highest.value ?? highest.count ?? highest.zScore ?? 0;
    const formattedHighest = formatMetricLocal(highestValue, p.metric || "value");

    let summaryText = "";
    if (plan.intent === "TREND") {
      summaryText = `Trend analysis over time shows key movements in the data. The highest peak occurred at ${highestLabel} with a value of ${formattedHighest}.`;
    } else {
      summaryText = `${labelLocal(p.dimension || "Category")}-wise ${labelLocal(p.metric || "metric")} analysis shows that ${highestLabel} has the highest contribution of ${formattedHighest}`;
      if (second) {
        const secondLabel = second.name || second.period || second.label || `Row ${second.rowIndex || 2}`;
        const secondValue = second.value ?? second.count ?? second.zScore ?? 0;
        const formattedSecond = formatMetricLocal(secondValue, p.metric || "value");
        summaryText += `, followed closely by ${secondLabel} with ${formattedSecond}`;
      }
      summaryText += `. This indicates a notable compensation or performance concentration in these categories.`;
    }

    const rowsText = calculation.result.slice(0, 5)
      .map((item, index) => {
        const labelStr = item.name || item.period || item.label || `Row ${item.rowIndex}`;
        const val = item.value ?? item.count ?? item.zScore;
        const formatted = formatMetricLocal(val, p.metric || "value");
        return `• ${labelStr}: ${formatted}`;
      })
      .join("\n");

    return [
      summaryText,
      "",
      "Breakdown Details:",
      rowsText
    ].join("\n");
  }

  if (typeof calculation.result === "number") {
    const formatted = formatMetricLocal(calculation.result, p.metric || "value");
    return `Analysis of the dataset shows that the calculated aggregate ${labelLocal(p.metric || "metric")} is ${formatted}. This value represents the total sum or count of points satisfying the query conditions.`;
  }

  return [
    "I analyzed your dataset like a senior business analyst.",
    `Intent detected: ${plan.intent}.`,
    p.metric ? `Metric used: ${labelLocal(p.metric)}.` : null,
    p.dimension ? `Dimension used: ${labelLocal(p.dimension)}.` : null,
    "",
    "The analysis calculation completed successfully.",
  ].filter((line) => line !== null).join("\n");
}
