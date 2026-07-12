import { buildSchemaProfile, makeSchemaOnlyPacket, normalizeColumnName } from "./schema-fingerprint.js";
import { buildRuleDashboardPlan, mergePlans, pickDateColumn, pickPrimaryCategory, pickPrimaryMetric } from "./dashboard-plan-engine.js";
import { buildGuardianDashboardResponse } from "./dashboard-quality-guardian.js";
import { buildSchemaUnderstanding } from "./schema-understanding-engine.js";
import { buildRagDashboardPlan, retrieveSchemaRagMemories } from "./schema-rag-retriever.js";

export const EXCEL_INTENTS = {
  SUMMARY: "SUMMARY",
  PIVOT: "PIVOT",
  TOP_N: "TOP_N",
  BOTTOM_N: "BOTTOM_N",
  TREND: "TREND",
  DISTRIBUTION: "DISTRIBUTION",
  CORRELATION: "CORRELATION",
  OUTLIERS: "OUTLIERS",
  DATA_QUALITY: "DATA_QUALITY",
  CLEANING: "CLEANING",
  FORECAST_READY: "FORECAST_READY",
  SEGMENT_COMPARISON: "SEGMENT_COMPARISON",
  ASK_EXPLANATION: "ASK_EXPLANATION",
};

export const INTENTS = EXCEL_INTENTS;

function norm(value = "") {
  return normalizeColumnName(String(value));
}

function textHas(text, words = []) {
  const lower = String(text || "").toLowerCase();
  return words.some((word) => lower.includes(word));
}

function isMetric(column = {}) {
  const role = String(column.role || "").toLowerCase();
  const type = String(column.type || "").toLowerCase();
  const name = norm(column.name || "");

  return (
    type === "number" ||
    role.includes("metric") ||
    /salary|revenue|sales|amount|price|cost|profit|quantity|qty|units|score|marks|gpa|value|income|expense|spend|budget|clicks|sessions|orders/.test(name)
  );
}

function isDimension(column = {}) {
  const role = String(column.role || "").toLowerCase();
  const type = String(column.type || "").toLowerCase();

  return (
    ["category", "string", "boolean"].includes(type) ||
    ["category", "location", "target", "numeric_category", "text"].includes(role)
  );
}

function isDateColumn(column = {}) {
  const role = String(column.role || "").toLowerCase();
  const type = String(column.type || "").toLowerCase();
  const name = norm(column.name || "");

  return type === "date" || role === "date" || /date|month|year|quarter|created|updated|time|period/.test(name);
}

function scoreColumn(column, query, preferred) {
  const q = norm(query);
  const name = norm(column.name || "");
  let score = 0;

  if (!name) return score;
  if (q.includes(name)) score += 100;

  for (const token of name.split("_")) {
    if (token && q.includes(token)) score += 15;
  }

  if (preferred === "metric" && isMetric(column)) score += 30;
  if (preferred === "dimension" && isDimension(column)) score += 30;
  if (preferred === "date" && isDateColumn(column)) score += 40;

  if (/salary|revenue|sales|amount|profit|price|score|marks|quantity|units/.test(name)) score += 12;
  if (preferred === "metric" && /salary|revenue|sales|amount|profit|price|order_value|spend|expense|income/.test(name)) score += 90;
  if (/country|region|city|category|product|department|education|gender|segment|channel/.test(name)) score += 10;
  if (/date|month|year|time/.test(name)) score += 10;

  return score;
}

function pickColumn(profile, query, preferred, options = {}) {
  const allColumns = profile.columns || [];
  const columns = allColumns
    .filter((column) => !options.exclude?.includes(column.name))
    .filter((column) => {
      if (preferred === "metric") return isMetric(column);
      if (preferred === "dimension") return isDimension(column);
      if (preferred === "date") return isDateColumn(column);
      return true;
    });

  const sorted = columns
    .map((column) => ({ column, score: scoreColumn(column, query, preferred) }))
    .sort((left, right) => right.score - left.score);

  const best = sorted[0];
  if (best && best.score > 0) return best.column;

  if (preferred === "metric") return pickPrimaryMetric(profile) || allColumns.find(isMetric) || null;
  if (preferred === "dimension") return pickPrimaryCategory(profile) || allColumns.find(isDimension) || null;
  if (preferred === "date") return pickDateColumn(profile) || allColumns.find(isDateColumn) || null;

  return allColumns[0] || null;
}

function pickCorrelationDimension(profile, query, metric) {
  const numeric = (profile.columns || []).filter((column) => isMetric(column) && column.name !== metric?.name);
  const sorted = numeric
    .map((column) => ({ column, score: scoreColumn(column, query, "metric") }))
    .sort((left, right) => right.score - left.score);

  return sorted[0]?.column || pickColumn(profile, query, "dimension");
}

export function detectExcelIntent(query = "") {
  const q = String(query || "").toLowerCase();

  if (textHas(q, ["top", "highest", "best", "maximum", "max", "most selling", "top selling"])) return EXCEL_INTENTS.TOP_N;
  if (textHas(q, ["bottom", "lowest", "worst", "minimum", "min", "least"])) return EXCEL_INTENTS.BOTTOM_N;
  if (textHas(q, ["trend", "over time", "month-wise", "month wise", "monthly", "yearly", "daily", "weekly", "growth"])) return EXCEL_INTENTS.TREND;
  if (textHas(q, ["correlation", "relationship", "impact", "influence", "depend", "relate"])) return EXCEL_INTENTS.CORRELATION;
  if (textHas(q, ["outlier", "anomaly", "abnormal", "unusual", "exception"])) return EXCEL_INTENTS.OUTLIERS;
  if (textHas(q, ["missing", "null", "blank", "duplicate", "quality", "errors"])) return EXCEL_INTENTS.DATA_QUALITY;
  if (textHas(q, ["clean", "fix data", "remove duplicate", "standardize", "dedupe"])) return EXCEL_INTENTS.CLEANING;
  if (textHas(q, ["forecast", "predict ready", "forecast ready"])) return EXCEL_INTENTS.FORECAST_READY;
  if (textHas(q, ["compare", "segment", "breakdown"])) return EXCEL_INTENTS.SEGMENT_COMPARISON;
  if (textHas(q, ["pivot", "group", " by "])) return EXCEL_INTENTS.PIVOT;
  if (textHas(q, ["distribution", "spread", "range", "histogram"])) return EXCEL_INTENTS.DISTRIBUTION;
  if (textHas(q, ["explain", "why", "insight", "summary"])) return EXCEL_INTENTS.ASK_EXPLANATION;

  return EXCEL_INTENTS.SUMMARY;
}

function detectLimit(query = "") {
  const match = String(query).match(/\btop\s+(\d+)|\bbottom\s+(\d+)|\b(\d+)\s+(items|records|categories|products|rows)/i);
  const value = Number(match?.[1] || match?.[2] || match?.[3]);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 50) : 10;
}

function detectAggregation(query = "", intent) {
  const q = String(query || "").toLowerCase();

  if (textHas(q, ["average", "avg", "mean"])) return "avg";
  if (textHas(q, ["median"])) return "median";
  if (textHas(q, ["unique", "distinct"])) return "count_unique";
  if (textHas(q, ["count", "number of", "how many"])) return "count";
  if (textHas(q, ["minimum", "lowest", "min"])) return "min";
  if (textHas(q, ["maximum", "highest", "max"])) return "max";
  if (intent === EXCEL_INTENTS.DISTRIBUTION) return "count";

  return "sum";
}

function publicRagMatches(matches = []) {
  return matches.map((match) => ({
    id: match.entry?.id,
    name: match.entry?.name,
    domain: match.entry?.domain,
    score: match.score,
    source: match.entry?.source,
    rating: match.entry?.rating,
  }));
}

export async function buildExcelAnalystPlan({
  dataset,
  query = "Analyze this dataset like an Excel expert",
  currentDashboard = {},
  options = {},
} = {}) {
  const profile = buildSchemaProfile(dataset || {});
  const understanding = buildSchemaUnderstanding(profile);

  const rag = await retrieveSchemaRagMemories(profile, {
    threshold: options.ragThreshold ?? 0.5,
    limit: options.ragLimit ?? 5,
    useOllama: options.useOllama !== false,
  });

  const ragPlan = buildRagDashboardPlan(profile, rag.matches);
  const rulePlan = buildRuleDashboardPlan(profile);
  const mergedPlan = mergePlans(profile, ragPlan, currentDashboard || {}, rulePlan);
  const guarded = buildGuardianDashboardResponse(profile, mergedPlan, {
    maxCharts: options.maxCharts ?? 8,
    maxKpis: options.maxKpis ?? 8,
  });

  const intent = detectExcelIntent(query);
  const metric = pickColumn(profile, query, "metric");
  const dimension = intent === EXCEL_INTENTS.CORRELATION
    ? pickCorrelationDimension(profile, query, metric)
    : pickColumn(profile, query, "dimension");
  const dateColumn = pickColumn(profile, query, "date");

  return {
    schemaOnly: true,
    intent,
    query,
    profile,
    publicProfile: makeSchemaOnlyPacket(profile),
    understanding,
    rag: {
      used: rag.used,
      matches: publicRagMatches(rag.matches),
      stats: rag.stats,
      query: rag.query,
    },
    executionPlan: {
      intent,
      metric: metric?.name || null,
      dimension: dimension?.name || null,
      dateColumn: dateColumn?.name || null,
      limit: detectLimit(query),
      aggregation: detectAggregation(query, intent),
    },
    recommendedDashboard: guarded.dashboard,
    quality: {
      score: guarded.qualityScore,
      health: guarded.dashboardHealth,
      warnings: guarded.warnings || [],
      fixes: guarded.fixes || [],
    },
  };
}
