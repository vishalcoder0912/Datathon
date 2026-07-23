import { humanize, normalizeColumnName } from "./schema-fingerprint.js";

const CHART_TYPES = new Set(["bar", "line", "area", "pie", "donut", "histogram", "scatter", "radar", "composed", "heatmap"]);
const AGGREGATIONS = new Set(["count", "sum", "avg", "min", "max", "median"]);

function byPriority(profile, roles, nameHints = []) {
  const columns = profile.columns || [];
  return columns.find((column) =>
    roles.includes(column.role) && nameHints.some((hint) => column.normalizedName.includes(hint))
  ) || columns.find((column) => roles.includes(column.role));
}

export function pickPrimaryMetric(profile) {
  return byPriority(
    profile,
    ["money_metric", "score_metric", "rate_metric", "count_metric", "continuous_metric"],
    ["salary", "revenue", "sales", "amount", "profit", "score", "stress", "anxiety", "depression", "performance"]
  );
}

export function pickSecondaryMetric(profile) {
  const primary = pickPrimaryMetric(profile);
  return (profile.columns || []).find((column) =>
    column.name !== primary?.name && ["continuous_metric", "score_metric", "count_metric", "rate_metric", "money_metric"].includes(column.role)
  );
}

export function pickPrimaryCategory(profile) {
  return byPriority(
    profile,
    ["location", "category", "target", "numeric_category"],
    ["country", "region", "education", "product", "department", "gender", "platform", "company_size", "status"]
  );
}

export function pickSecondaryCategory(profile) {
  const primary = pickPrimaryCategory(profile);
  return (profile.columns || []).find((column) =>
    column.name !== primary?.name && ["category", "location", "target", "numeric_category"].includes(column.role)
  );
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
  };
}

function chart(id, type, title, xKey, yKey, aggregation = "count", options = {}) {
  return sanitizeChartSpec({ id, type, title, xKey, yKey, aggregation, limit: options.limit || 10, ...options });
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
  };
}

export function buildRuleDashboardPlan(profile) {
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
  const validPlans = plans.filter(Boolean);
  const kpis = dedupeBy(validPlans.flatMap((plan) => plan.kpis || []), "title").map((item) => sanitizeKpiSpec(item, profile));
  const charts = dedupeBy(validPlans.flatMap((plan) => plan.charts || []), "title").map((item) => sanitizeChartSpec(item, profile));

  return {
    source: validPlans.map((plan) => plan.source).join("+"),
    domain: profile.domain,
    kpis: kpis.slice(0, 8),
    charts: charts.slice(0, 10),
  };
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
      };
    }),
  };
}
