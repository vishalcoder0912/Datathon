import { humanize, normalizeColumnName } from "./schema-fingerprint.js";
import { buildSalaryDashboardPlan } from "./salary-dashboard-engine.js";

const CHART_TYPES = new Set(["bar", "horizontalBar", "horizontal_bar", "line", "area", "pie", "donut", "histogram", "scatter", "radar", "composed", "heatmap"]);
const AGGREGATIONS = new Set([
  "none",
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "median",
  "count_unique",
  "top_by_avg",
]);

const METRIC_PRIORITY_HINTS = [
  "revenue",
  "profit",
  "sales",
  "billing_amount",
  "billingamount",
  "salary_usd",
  "salary",
  "orders",
  "customers",
  "patients",
  "review_count",
  "reviewcount",
  "rating",
  "quantity",
  "amount",
  "price",
  "cost",
];

const CATEGORY_PRIORITY_HINTS = [
  "country",
  "state",
  "city",
  "region",
  "territory",
  "province",
  "gender",
  "department",
  "product_category",
  "category",
  "insurance_provider",
  "admission_type",
  "medical_condition",
  "condition",
  "test_results",
  "status",
  "segment",
  "market",
];

const REJECTED_METRIC_TERMS = [
  "name",
  "reviewer_name",
  "customer_name",
  "patient_name",
  "doctor",
  "hospital",
  "email",
  "phone",
  "address",
  "profile_link",
  "link",
  "url",
  "title",
  "description",
  "text",
  "id",
];

const REJECTED_DEFAULT_AXIS_TERMS = [
  "name",
  "reviewer_name",
  "customer_name",
  "patient_name",
  "doctor",
  "email",
  "phone",
  "address",
  "profile_link",
  "link",
  "url",
  "title",
  "description",
  "text",
  "id",
];

function normalized(columnOrName = "") {
  return typeof columnOrName === "string"
    ? normalizeColumnName(columnOrName)
    : columnOrName.normalizedName || normalizeColumnName(columnOrName.name);
}

function hasAnyHint(column, hints) {
  const n = normalized(column);
  return hints.some((hint) => n.includes(normalizeColumnName(hint)));
}

function isRejectedMetricColumn(column) {
  if (!column || column.name === "__row_count__") return false;
  const n = normalized(column);
  return REJECTED_METRIC_TERMS.some((term) => n.includes(normalizeColumnName(term)));
}

function isRejectedDefaultAxisColumn(column) {
  if (!column) return false;
  const n = normalized(column);
  return REJECTED_DEFAULT_AXIS_TERMS.some((term) => n.includes(normalizeColumnName(term)));
}

function isMetricColumn(column) {
  return Boolean(
    column &&
    !isRejectedMetricColumn(column) &&
    ["money_metric", "score_metric", "rate_metric", "count_metric", "continuous_metric"].includes(column.role)
  );
}

function isDefaultAxisColumn(column) {
  return Boolean(
    column &&
    !isRejectedDefaultAxisColumn(column) &&
    ["location", "category", "target", "numeric_category"].includes(column.role)
  );
}

function byPriority(profile, roles, nameHints = []) {
  const columns = profile.columns || [];
  return columns.find((column) =>
    roles.includes(column.role) && nameHints.some((hint) => column.normalizedName.includes(hint))
  ) || columns.find((column) => roles.includes(column.role));
}

export function pickPrimaryMetric(profile) {
  const candidates = (profile.columns || []).filter(isMetricColumn);
  return candidates.find((column) => hasAnyHint(column, METRIC_PRIORITY_HINTS)) || candidates[0];
}

export function pickSecondaryMetric(profile) {
  const primary = pickPrimaryMetric(profile);
  return (profile.columns || []).filter(isMetricColumn).find((column) => column.name !== primary?.name);
}

export function pickPrimaryCategory(profile) {
  const candidates = (profile.columns || []).filter(isDefaultAxisColumn);
  return candidates.find((column) => hasAnyHint(column, CATEGORY_PRIORITY_HINTS)) || candidates[0];
}

export function pickSecondaryCategory(profile) {
  const primary = pickPrimaryCategory(profile);
  return (profile.columns || []).filter(isDefaultAxisColumn).find((column) => column.name !== primary?.name);
}

export function pickDateColumn(profile) {
  return (profile.columns || []).find((column) => column.role === "date" || column.type === "date");
}

function kpi(id, title, metric, aggregation, options = {}) {
  return {
    id,
    title,
    metric,
    aggregation,
    format: options.format || (aggregation === "count" ? "number" : undefined),
    description: options.description || "",
    businessKpi: true,
  };
}

function chart(id, type, title, xKey, yKey, aggregation = "count", options = {}) {
  return sanitizeChartSpec({ id, type, title, xKey, yKey, aggregation, limit: options.limit || 10, ...options });
}

function isRealDateColumn(schema, columnName) {
  const col = schema.columns?.find((c) => c.name === columnName);
  return Boolean(col && (col.type === "date" || col.role === "date"));
}

export function validateChartSpec(chartSpec, schema) {
  const columns = new Set((schema.columns || []).map((col) => col.name));
  const columnByName = new Map((schema.columns || []).map((col) => [col.name, col]));

  if (chartSpec.xKey === "__row_index__") {
    return {
      valid: false,
      reason: "Row index is not a real business dimension.",
    };
  }

  if (chartSpec.type === "line" || chartSpec.intent === "trend") {
    if (!isRealDateColumn(schema, chartSpec.xKey)) {
      return {
        valid: false,
        reason: "Trend charts require a real date/time column.",
      };
    }
  }

  if (chartSpec.xKey && chartSpec.xKey !== "count" && !columns.has(chartSpec.xKey)) {
    return { valid: false, reason: `Missing xKey column: ${chartSpec.xKey}` };
  }

  if (chartSpec.yKey && chartSpec.yKey !== "count" && !columns.has(chartSpec.yKey)) {
    return { valid: false, reason: `Missing yKey column: ${chartSpec.yKey}` };
  }

  const xColumn = columnByName.get(chartSpec.xKey);
  const yColumn = columnByName.get(chartSpec.yKey);

  if (chartSpec.yKey && chartSpec.yKey !== "count" && !isMetricColumn(yColumn)) {
    return { valid: false, reason: `Invalid metric column: ${chartSpec.yKey}` };
  }

  if (["pie", "donut"].includes(chartSpec.type) && !isDefaultAxisColumn(xColumn)) {
    return { valid: false, reason: `Invalid distribution axis: ${chartSpec.xKey}` };
  }

  if (["bar", "horizontalBar"].includes(chartSpec.type) && !isDefaultAxisColumn(xColumn)) {
    return { valid: false, reason: `Invalid grouping axis: ${chartSpec.xKey}` };
  }

  if (chartSpec.type === "histogram" && !isMetricColumn(xColumn)) {
    return { valid: false, reason: `Histogram requires a numeric metric: ${chartSpec.xKey}` };
  }

  if (chartSpec.type === "scatter" && (!isMetricColumn(xColumn) || !isMetricColumn(yColumn))) {
    return { valid: false, reason: "Scatter charts require two numeric business metrics." };
  }

  return { valid: true };
}

export function sanitizeChartSpec(spec = {}, profile) {
  const safe = {
    id: spec.id || `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: CHART_TYPES.has(spec.type) ? spec.type : "bar",
    title: spec.title || "Generated Chart",
    xKey: spec.xKey || spec.category || spec.dimension || "",
    yKey: spec.yKey || spec.metric || "count",
    aggregation: AGGREGATIONS.has(spec.aggregation) ? spec.aggregation : "count",
    limit: Number.isFinite(Number(spec.limit)) ? Math.max(1, Math.min(50, Number(spec.limit))) : 10,
    reason: spec.reason || "",
    intent: spec.intent,
    filters: Array.isArray(spec.filters) ? spec.filters : [],
    sort: spec.sort && typeof spec.sort === "object" ? spec.sort : undefined,
    calculationSource: spec.calculationSource || undefined,
  };

  if (profile?.columns?.length) {
    const names = new Set(profile.columns.map((column) => column.name));
    const normalizedMap = new Map(profile.columns.map((column) => [column.normalizedName, column.name]));
    safe.xKey = names.has(safe.xKey) ? safe.xKey : normalizedMap.get(normalizeColumnName(safe.xKey)) || safe.xKey;
    safe.yKey = safe.yKey === "count" || names.has(safe.yKey) ? safe.yKey : normalizedMap.get(normalizeColumnName(safe.yKey)) || safe.yKey;
  }

  if (["pie", "donut"].includes(safe.type)) {
    safe.aggregation = "count";
    safe.yKey = "count";
  }

  if (safe.type === "histogram") {
    safe.aggregation = "count";
  }

  if (spec.splitValues === true) {
    safe.splitValues = true;
  }

  if (spec.multiValue === true) {
    safe.multiValue = true;
  }

  if (spec.splitDelimiter) {
    safe.splitDelimiter = spec.splitDelimiter;
  }

  if (Number.isFinite(Number(spec.bins))) {
    safe.bins = Math.max(2, Math.min(50, Number(spec.bins)));
  }

  return safe;
}

export function sanitizeKpiSpec(spec = {}, profile) {
  const title = spec.title || humanize(`${spec.aggregation || "count"} ${spec.metric || "records"}`);
  return {
    id: spec.id || `kpi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    metric: spec.metric || "__row_count__",
    aggregation: AGGREGATIONS.has(spec.aggregation) ? spec.aggregation : "count",
    format: spec.format || undefined,
    description: spec.description || "",
    businessKpi: spec.businessKpi === true,
    filters: Array.isArray(spec.filters) ? spec.filters : [],
    calculationSource: spec.calculationSource || undefined,
  };
}

export function buildRuleDashboardPlan(profile) {
  const salaryPlan = buildSalaryDashboardPlan(profile);
  if (salaryPlan) {
    return {
      ...salaryPlan,
      kpis: salaryPlan.kpis.map((item) => sanitizeKpiSpec(item, profile)),
      charts: salaryPlan.charts.map((item) => sanitizeChartSpec(item, profile)),
    };
  }

  const metric = pickPrimaryMetric(profile);
  const metric2 = pickSecondaryMetric(profile);
  const category = pickPrimaryCategory(profile);
  const category2 = pickSecondaryCategory(profile);
  const date = pickDateColumn(profile);

  const kpis = [
    kpi("total-records", "Total Records", "__row_count__", "count", { format: "number" }),
  ];

  if (metric) {
    const isMoney = metric.role === "money_metric";
    kpis.push(kpi(`avg-${metric.normalizedName}`, `Average ${metric.title}`, metric.name, "avg", { format: isMoney ? "currency" : "number" }));
    kpis.push(kpi(`median-${metric.normalizedName}`, `Median ${metric.title}`, metric.name, "median", { format: isMoney ? "currency" : "number" }));
    kpis.push(kpi(`max-${metric.normalizedName}`, `Highest ${metric.title}`, metric.name, "max", { format: isMoney ? "currency" : "number" }));
  }

  if (category) {
    kpis.push(kpi(`unique-${category.normalizedName}`, `${category.title} Count`, category.name, "count_unique", { format: "number" }));
  }

  const charts = [];

  if (metric && category) {
    charts.push(chart(`avg-${metric.normalizedName}-by-${category.normalizedName}`, "bar", `Average ${metric.title} by ${category.title}`, category.name, metric.name, "avg"));
  }

  if (metric) {
    charts.push(chart(`${metric.normalizedName}-distribution`, "histogram", `${metric.title} Distribution`, metric.name, metric.name, "count", { bins: 12 }));
  }

  if (category) {
    charts.push(chart(`${category.normalizedName}-distribution`, "donut", `${category.title} Distribution`, category.name, "count", "count"));
  }

  if (metric && metric2) {
    charts.push(chart(`${metric.normalizedName}-vs-${metric2.normalizedName}`, "scatter", `${metric.title} vs ${metric2.title}`, metric2.name, metric.name, "count", { limit: 500 }));
  }

  if (date && metric) {
    charts.push(chart(`${metric.normalizedName}-trend`, "line", `${metric.title} Trend`, date.name, metric.name, "avg", { limit: 24 }));
  }

  if (metric && category2) {
    charts.push(chart(`avg-${metric.normalizedName}-by-${category2.normalizedName}`, "bar", `Average ${metric.title} by ${category2.title}`, category2.name, metric.name, "avg"));
  }

  return {
    source: "rules",
    domain: profile.domain,
    kpis: dedupeBy(kpis.map((item) => sanitizeKpiSpec(item, profile)), "title").slice(0, 8),
    charts: dedupeBy(charts.map((item) => sanitizeChartSpec(item, profile)), "title").slice(0, 8),
  };
}

function dedupeBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function resolveColumn(profile, template = {}, propName, roleName) {
  const raw = template[propName];
  if (raw) {
    const exact = profile.columns.find((column) => column.name === raw || column.normalizedName === normalizeColumnName(raw));
    if (exact) return exact.name;
  }

  const role = template[roleName];
  if (role) {
    const byRole = profile.columns.find((column) => column.role === role);
    if (byRole) return byRole.name;
  }

  return raw || "";
}

export function applyTrainedTemplates(profile, memoryMatch) {
  if (!memoryMatch?.entry?.dashboardPlan) return null;

  const plan = memoryMatch.entry.dashboardPlan;
  const kpis = (plan.kpis || []).map((template) => sanitizeKpiSpec({
    ...template,
    metric: template.metric === "__row_count__" ? "__row_count__" : resolveColumn(profile, template, "metric", "metricRole"),
  }, profile));

  const charts = (plan.charts || []).map((template) => sanitizeChartSpec({
    ...template,
    xKey: resolveColumn(profile, template, "xKey", "xRole"),
    yKey: template.yKey === "count" ? "count" : resolveColumn(profile, template, "yKey", "yRole"),
  }, profile));

  return {
    source: "trained-memory",
    matchedDataset: memoryMatch.entry.name,
    matchScore: memoryMatch.score,
    domain: profile.domain,
    kpis: dedupeBy(kpis, "title").slice(0, 8),
    charts: dedupeBy(charts, "title").slice(0, 8),
  };
}

export function mergePlans(profile, ...plans) {
  const salaryPlan = buildSalaryDashboardPlan(profile);
  if (salaryPlan) {
    return critiqueDashboard({
      ...salaryPlan,
      kpis: salaryPlan.kpis.map((item) => sanitizeKpiSpec(item, profile)),
      charts: salaryPlan.charts.map((item) => sanitizeChartSpec(item, profile)),
    }, profile);
  }

  const validPlans = plans.filter(Boolean);
  const kpis = dedupeBy(validPlans.flatMap((plan) => plan.kpis || []), "title").map((item) => sanitizeKpiSpec(item, profile));
  const charts = dedupeBy(validPlans.flatMap((plan) => plan.charts || []), "title").map((item) => sanitizeChartSpec(item, profile));

  return critiqueDashboard({
    source: validPlans.map((plan) => plan.source).join("+"),
    domain: profile.domain,
    kpis: kpis.slice(0, 8),
    charts: charts.slice(0, 10),
  }, profile);
}

export function critiqueDashboard(plan, schema) {
  const blockedKpis = [
    "attributes / columns",
    "numeric columns",
    "categorical columns",
    "missing values",
    "data quality score",
  ];

  const cleanedKpis = (plan.kpis || []).filter((kpi) => {
    const title = String(kpi.title || "").toLowerCase();
    if (blockedKpis.includes(title)) return false;
    if (kpi.aggregation === "quality_score") return false;
    if (kpi.metric && !kpi.metric.startsWith("__") && !schema.columns.some((c) => c.name === kpi.metric)) {
      return false;
    }
    if (kpi.metric && !kpi.metric.startsWith("__")) {
      const column = schema.columns.find((c) => c.name === kpi.metric);
      if (kpi.aggregation === "count_unique") return isDefaultAxisColumn(column);
      return isMetricColumn(column);
    }
    return true;
  });

  const cleanedCharts = (plan.charts || []).filter((chart) => {
    if (chart.xKey === "__row_index__") return false;
    if (/row index/i.test(chart.title || "")) return false;
    return validateChartSpec(chart, schema).valid;
  });

  return {
    ...plan,
    kpis: cleanedKpis,
    charts: dedupeCharts(cleanedCharts),
  };
}

function dedupeCharts(charts) {
  const seen = new Set();
  return charts.filter((chart) => {
    const key = `${chart.type}:${chart.xKey}:${chart.yKey}:${chart.aggregation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function templatePlanForStorage(plan = {}, profile) {
  const columnByName = new Map((profile.columns || []).map((column) => [column.name, column]));

  return {
    kpis: (plan.kpis || []).map((item) => {
      const column = columnByName.get(item.metric);
      return {
        title: item.title,
        metric: item.metric === "__row_count__" ? "__row_count__" : item.metric,
        metricRole: column?.role,
        aggregation: item.aggregation || "count",
        format: item.format,
        reason: item.reason || item.description,
      };
    }),
    charts: (plan.charts || []).map((item) => {
      const x = columnByName.get(item.xKey);
      const y = columnByName.get(item.yKey);
      return {
        title: item.title,
        type: item.type,
        xKey: item.xKey,
        xRole: x?.role,
        yKey: item.yKey || "count",
        yRole: y?.role,
        aggregation: item.aggregation || "count",
        limit: item.limit || 10,
        reason: item.reason,
      };
    }),
  };
}
