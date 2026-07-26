import { humanize, normalizeColumnName } from "./schema-fingerprint.js";

const DOMAIN_RULES = [
  ["HR/salary", /salary|compensation|employee|department|experience|tenure|education|hr|payroll/],
  ["ecommerce", /order|gmv|cart|sku|product|customer|quantity|unit|checkout|conversion|aov|ecommerce/],
  ["sales", /sales|revenue|deal|pipeline|customer|region|quota|account|rep/],
  ["finance", /income|expense|profit|loss|cash|burn|spend|budget|transaction|balance|category/],
  ["education", /student|marks|cgpa|gpa|grade|course|subject|attendance|pass|exam/],
  ["marketing", /impression|click|ctr|cpc|campaign|conversion|roi|channel|ad|spend/],
  ["inventory", /stock|inventory|warehouse|sku|reorder|turnover|dead_stock|supplier/],
  ["survey", /survey|response|question|rating|nps|feedback|sentiment/],
  ["operations", /operation|ticket|sla|queue|process|duration|cycle|status|priority/],
];

const OBJECTIVE_RULES = [
  ["growth", /growth|new|increase|trend|mrr|arr|user|customer/],
  ["performance", /performance|score|rank|target|quota|sla/],
  ["revenue", /revenue|sales|gmv|income|profit|aov|price|amount/],
  ["efficiency", /efficiency|cost|duration|cycle|throughput|productivity|utilization/],
  ["risk", /risk|churn|loss|default|fraud|defect|late|overdue/],
  ["quality", /quality|rating|score|defect|pass|accuracy|satisfaction/],
  ["retention", /retention|churn|renewal|repeat|subscription/],
  ["comparison", /segment|region|country|department|category|channel|group/],
  ["forecasting", /date|month|year|time|forecast|trend|created|period/],
];

function textForColumns(columns = []) {
  return columns.map((column) => `${column.name} ${column.normalizedName || ""} ${column.role || ""}`).join(" ").toLowerCase();
}

function detectByRules(rules, text, fallback) {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || fallback;
}

function scoreMetric(column) {
  const name = normalizeColumnName(column.name);
  let score = 0;
  if (["money_metric", "count_metric", "rate_metric", "score_metric", "continuous_metric"].includes(column.role)) score += 40;
  if (/revenue|sales|gmv|profit|salary|amount|income|expense|spend|marks|score|clicks|orders|units|stock/.test(name)) score += 30;
  if (column.noisy) score -= 80;
  if (column.missingPct > 50) score -= 20;
  return score;
}

function scoreDimension(column) {
  const name = normalizeColumnName(column.name);
  let score = 0;
  if (["category", "location", "target", "numeric_category"].includes(column.role)) score += 35;
  if (/country|region|city|segment|category|product|department|channel|status|subject|campaign/.test(name)) score += 25;
  if (column.noisy || column.role === "id") score -= 80;
  if (column.uniqueCount > 50 && column.uniqueCount / Math.max(1, column.sampledRowCount || 1) > 0.5) score -= 20;
  return score;
}

function semanticClusterFor(column) {
  const name = normalizeColumnName(column.name);
  if (column.role === "id" || /id|uuid|key|code/.test(name)) return "ids";
  if (column.role === "date" || /date|time|month|year|created|updated/.test(name)) return "time";
  if (column.role === "location" || /country|city|state|region|location|lat|lng/.test(name)) return "geo";
  if (/revenue|sales|salary|amount|price|cost|profit|income|expense|budget|spend|gmv/.test(name)) return "financial_metrics";
  if (/order|quantity|qty|unit|count|click|impression|visit|session/.test(name)) return "volume_metrics";
  if (/score|rating|marks|cgpa|gpa|rate|percent|ctr|cpc|roi|conversion/.test(name)) return "performance_metrics";
  if (["category", "target", "numeric_category"].includes(column.role)) return "business_dimensions";
  return column.type === "number" ? "other_metrics" : "other_dimensions";
}

function groupSemanticClusters(columns = []) {
  return columns.reduce((clusters, column) => {
    const key = semanticClusterFor(column);
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(column.name);
    return clusters;
  }, {});
}

function topByScore(columns, scorer, limit) {
  return columns
    .map((column) => ({ column, score: scorer(column) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.column);
}

export function buildSeniorAnalystPlan(profile = {}, options = {}) {
  const columns = Array.isArray(profile.columns) ? profile.columns : [];
  const text = `${profile.datasetName || ""} ${textForColumns(columns)}`;
  const domain = options.domain || detectByRules(DOMAIN_RULES, text, "generic");
  const objective = options.objective || detectByRules(OBJECTIVE_RULES, text, domain === "generic" ? "quality" : "revenue");
  const metrics = topByScore(columns, scoreMetric, 12);
  const dimensions = topByScore(columns, scoreDimension, 12);
  const dates = columns.filter((column) => column.role === "date" || column.type === "date").slice(0, 4);
  const locations = columns.filter((column) => column.role === "location" || /country|city|state|region|location|lat|lng/i.test(column.name)).slice(0, 4);
  const ids = columns.filter((column) => column.role === "id" || /(^id$|_id$|uuid|identifier|key)$/i.test(column.name));
  const targets = columns.filter((column) => column.role === "target" || /status|result|outcome|target|label/i.test(column.name)).slice(0, 6);
  const ignored = columns.filter((column) => column.noisy || ids.includes(column) || column.missingPct >= 80);

  const metricDimensionCombos = [];
  for (const metric of metrics.slice(0, 6)) {
    for (const dimension of dimensions.slice(0, 6)) {
      if (metric.name === dimension.name || ignored.includes(metric) || ignored.includes(dimension)) continue;
      metricDimensionCombos.push({
        metric: metric.name,
        dimension: dimension.name,
        aggregation: metric.role === "money_metric" || /revenue|sales|amount|salary|profit|gmv/i.test(metric.name) ? "sum" : "avg",
        value: `${humanize(metric.name)} by ${humanize(dimension.name)}`,
      });
    }
  }

  return {
    seniorAnalysisPlan: {
      source: "senior-analyst-brain",
      domain,
      objective,
      largeSchema: columns.length >= 100,
      semanticClusters: groupSemanticClusters(columns),
      rankedColumns: {
        primaryMetric: metrics[0]?.name || null,
        secondaryMetrics: metrics.slice(1, 8).map((column) => column.name),
        dimensions: dimensions.map((column) => column.name),
        dateColumns: dates.map((column) => column.name),
        locationColumns: locations.map((column) => column.name),
        idColumns: ids.map((column) => column.name),
        targetColumns: targets.map((column) => column.name),
        ignoredColumns: ignored.map((column) => column.name),
      },
      usefulMetricDimensionCombinations: metricDimensionCombos.slice(0, 24),
      warnings: [
        columns.length >= 100 ? "Large schema detected; dashboard should use only high-value semantic clusters." : null,
        !metrics.length ? "No strong numeric business metric detected." : null,
        !dimensions.length ? "No strong segment/dimension column detected." : null,
      ].filter(Boolean),
    },
  };
}
