import {
  buildRuleDashboardPlan,
  sanitizeChartSpec,
  sanitizeKpiSpec,
} from "./dashboard-plan-engine.js";

const METRIC_ROLES = new Set([
  "money_metric",
  "score_metric",
  "rate_metric",
  "count_metric",
  "continuous_metric",
  "metric",
]);

const CATEGORY_ROLES = new Set([
  "location",
  "category",
  "target",
  "numeric_category",
  "dimension",
  "date",
]);

const CHART_TYPES = new Set([
  "bar",
  "horizontalBar",
  "line",
  "area",
  "pie",
  "donut",
  "histogram",
  "scatter",
  "radar",
  "composed",
  "heatmap",
]);

const AGGREGATIONS = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "median",
  "count_unique",
]);

function normalize(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getColumns(profile) {
  return Array.isArray(profile?.columns) ? profile.columns : [];
}

function getColumn(profile, name) {
  const wanted = normalize(name);
  return getColumns(profile).find((column) => {
    const ownName = normalize(column.name);
    const normalizedName = normalize(column.normalizedName || column.name);
    return ownName === wanted || normalizedName === wanted;
  });
}

function findColumn(profile, aliases = [], roles = []) {
  const normalizedAliases = aliases.map(normalize).filter(Boolean);

  const scored = getColumns(profile)
    .map((column) => {
      const name = normalize(column.name);
      const normalizedName = normalize(column.normalizedName || column.name);
      let score = 0;

      for (const alias of normalizedAliases) {
        if (name === alias || normalizedName === alias) score += 30;
        else if (name.includes(alias) || normalizedName.includes(alias)) score += 14;
        else if (alias.includes(name) || alias.includes(normalizedName)) score += 6;
      }

      if (roles.includes(column.role)) score += 10;
      if (roles.includes("metric") && METRIC_ROLES.has(column.role)) score += 5;
      if (roles.includes("category") && CATEGORY_ROLES.has(column.role)) score += 5;

      return { column, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.column || null;
}

function isMetricColumn(column) {
  return Boolean(column && (METRIC_ROLES.has(column.role) || column.type === "number"));
}

function isCategoryColumn(column) {
  return Boolean(
    column &&
      (CATEGORY_ROLES.has(column.role) ||
        ["string", "category", "boolean", "date"].includes(column.type))
  );
}

function isIdColumn(column) {
  if (!column) return false;
  return column.role === "id" || /(^id$|_id$|uuid|identifier)/i.test(column.name || "");
}

function isDateColumn(column) {
  return Boolean(column && (column.role === "date" || column.type === "date"));
}

function looksMultiValueColumn(column) {
  const name = normalize(column?.name || column?.normalizedName || "");
  return /(language|languages|framework|frameworks|skill|skills|tag|tags|categor|tools|technolog)/.test(name);
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const output = [];

  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function stripUnsafeChartData(chart) {
  if (!chart || typeof chart !== "object") return chart;
  const { data, value, values, rows, rawRows, sampleRows, calculatedValues, ...safe } = chart;
  return safe;
}

function stripUnsafeKpiData(kpi) {
  if (!kpi || typeof kpi !== "object") return kpi;
  const { value, values, data, rows, rawRows, sampleRows, calculatedValues, ...safe } = kpi;
  return safe;
}

function normalizeKpiSpec(profile, spec) {
  const input = stripUnsafeKpiData(spec || {});
  const safe = sanitizeKpiSpec(input, profile);
  if (!AGGREGATIONS.has(safe.aggregation)) safe.aggregation = "count";
  safe.reason = safe.reason || input.reason || `Tracks ${safe.aggregation} of ${safe.metric || "records"} to monitor performance.`;
  return safe;
}

function normalizeChartSpec(profile, spec) {
  const input = stripUnsafeChartData(spec || {});
  const safe = sanitizeChartSpec(input, profile);

  safe.type = CHART_TYPES.has(safe.type) ? safe.type : "bar";
  safe.aggregation = AGGREGATIONS.has(safe.aggregation) ? safe.aggregation : "count";
  safe.limit = Math.max(
    1,
    Math.min(Number(safe.limit || input.limit || 10), safe.type === "scatter" ? 1000 : 50)
  );

  const x = getColumn(profile, safe.xKey);
  if (input.splitValues === true || looksMultiValueColumn(x)) safe.splitValues = true;

  if (["pie", "donut"].includes(safe.type)) {
    safe.yKey = "count";
    safe.aggregation = "count";
  }

  if (safe.type === "histogram") {
    safe.yKey = safe.xKey;
    safe.aggregation = "count";
  }

  if (safe.type === "scatter") {
    safe.aggregation = "count";
    safe.limit = Math.max(safe.limit, 500);
  }

  // Top-N limit for high-cardinality dimension
  if (x && !isDateColumn(x) && (x.uniqueCount > 10 || (x.uniqueCount === undefined && ["string", "category"].includes(x.type)))) {
    if (["bar", "radar", "composed", "pie", "donut"].includes(safe.type)) {
      safe.limit = Math.min(safe.limit || 10, 10);
    }
  }

  // Every chart must have business reason
  safe.reason = safe.reason || input.reason || `Analyzes ${safe.yKey || "records"} by ${safe.xKey || "dimension"} to find business insights.`;

  delete safe.data;
  delete safe.rows;
  delete safe.rawRows;
  delete safe.sampleRows;

  return safe;
}

export function validateChartCombination(profile, chartSpec = {}) {
  const chart = normalizeChartSpec(profile, chartSpec);
  const x = getColumn(profile, chart.xKey);
  const y = (chart.yKey === "count" || !chart.yKey) ? null : getColumn(profile, chart.yKey);

  if (!CHART_TYPES.has(chart.type)) {
    return { ok: false, reason: `Unsupported chart type: ${chart.type}` };
  }

  if (!x) {
    return { ok: false, reason: `X-axis column "${chart.xKey}" does not exist.` };
  }

  if (chart.yKey && chart.yKey !== "count" && !y) {
    return { ok: false, reason: `Y-axis column "${chart.yKey}" does not exist.` };
  }

  if (x && isIdColumn(x) && ["sum", "avg"].includes(chart.aggregation)) {
    return { ok: false, reason: "ID columns cannot be summed or averaged." };
  }

  if (y && isIdColumn(y) && ["sum", "avg"].includes(chart.aggregation)) {
    return { ok: false, reason: "ID columns cannot be summed or averaged." };
  }

  if (chart.type === "histogram") {
    if (!isMetricColumn(x)) return { ok: false, reason: "Histogram needs one numeric metric column." };
    return { ok: true, chart };
  }

  if (chart.type === "scatter") {
    if (!isMetricColumn(x) || !y || !isMetricColumn(y)) {
      return { ok: false, reason: "Scatter chart needs two numeric metric columns." };
    }
    return { ok: true, chart };
  }

  if (["pie", "donut"].includes(chart.type)) {
    if (!isCategoryColumn(x)) return { ok: false, reason: "Pie/donut chart needs a category column." };
    if (x.uniqueCount !== undefined && x.uniqueCount > 6) {
      return { ok: false, reason: "Pie/donut chart max 6 categories." };
    }
    return { ok: true, chart };
  }

  if (["line", "area"].includes(chart.type)) {
    if (!isDateColumn(x)) {
      return { ok: false, reason: "Line/area chart needs date or time on X." };
    }
    if (chart.yKey !== "count" && (!y || !isMetricColumn(y))) {
      return { ok: false, reason: "Line/area chart needs numeric Y metric." };
    }
    return { ok: true, chart };
  }

  if (["bar", "horizontalBar", "radar", "composed", "heatmap"].includes(chart.type)) {
    if (!x) return { ok: false, reason: `Column ${chart.xKey} does not exist.` };
    if (chart.yKey !== "count" && (!y || !isMetricColumn(y))) {
      return { ok: false, reason: "This chart needs numeric metric on Y." };
    }
    return { ok: true, chart };
  }

  return { ok: true, chart };
}

function isWorkforceSalarySchema(profile) {
  const names = new Set(getColumns(profile).map((column) => normalize(column.name)));
  const hasSalary = [...names].some((name) => /salary|compensation|income|pay/.test(name));
  const hasWorkforceHints = ["experience", "country", "education", "languages", "frameworks", "company_size"]
    .some((hint) => names.has(hint));
  return hasSalary && hasWorkforceHints;
}

function workforceSalaryPlan(profile) {
  const salary = findColumn(profile, ["salary_usd", "salary", "annual_salary", "compensation", "income"], ["money_metric", "metric"]);
  const experience = findColumn(profile, ["experience", "years_experience", "years_coding", "exp"], ["continuous_metric", "metric"]);
  const country = findColumn(profile, ["country", "location", "region"], ["location", "category"]);
  const education = findColumn(profile, ["education", "degree", "qualification"], ["category"]);
  const companySize = findColumn(profile, ["company_size", "companysize", "organization_size", "org_size"], ["category"]);
  const languages = findColumn(profile, ["languages", "language", "programming_languages", "skills"], ["category"]);
  const frameworks = findColumn(profile, ["frameworks", "framework", "tools", "libraries"], ["category"]);

  if (!salary) return null;

  const kpis = [
    { title: "Total Records", metric: "__row_count__", aggregation: "count", format: "number", reason: "Shows the data volume behind the salary analysis." },
    { title: "Average Salary", metric: salary.name, metricRole: salary.role, aggregation: "avg", format: "currency", reason: `${salary.name} is the primary business success metric.` },
    { title: "Median Salary", metric: salary.name, metricRole: salary.role, aggregation: "median", format: "currency", reason: "Median salary reduces the effect of outliers in compensation data." },
    { title: "Highest Salary", metric: salary.name, metricRole: salary.role, aggregation: "max", format: "currency", reason: "Highest salary shows the top compensation ceiling." },
  ];

  if (country) {
    kpis.push({ title: "Countries", metric: country.name, metricRole: country.role, aggregation: "count_unique", format: "number", reason: "Country count shows geographic coverage for salary comparisons." });
  }

  const charts = [];
  if (country) charts.push({ title: "Average Salary by Country", type: "bar", xKey: country.name, yKey: salary.name, aggregation: "avg", limit: 10, reason: `${country.name} is a location dimension that can explain salary differences.` });
  charts.push({ title: "Salary Distribution", type: "histogram", xKey: salary.name, yKey: salary.name, aggregation: "count", limit: 12, reason: "Salary distribution reveals spread, skew, and outlier compensation." });
  if (experience) charts.push({ title: "Salary vs Experience", type: "scatter", xKey: experience.name, yKey: salary.name, aggregation: "count", limit: 500, reason: `${experience.name} is a numeric driver that may increase ${salary.name}.` });
  if (education) charts.push({ title: "Average Salary by Education", type: "bar", xKey: education.name, yKey: salary.name, aggregation: "avg", limit: 10, reason: `${education.name} helps test whether education level changes average salary.` });
  if (companySize) charts.push({ title: "Average Salary by Company Size", type: "bar", xKey: companySize.name, yKey: salary.name, aggregation: "avg", limit: 10, reason: `${companySize.name} can explain salary differences by employer scale.` });
  if (languages) charts.push({ title: "Average Salary by Language", type: "bar", xKey: languages.name, yKey: salary.name, aggregation: "avg", limit: 10, splitValues: true, reason: `${languages.name} identifies skills linked with higher salary.` });
  if (frameworks) charts.push({ title: "Average Salary by Framework", type: "bar", xKey: frameworks.name, yKey: salary.name, aggregation: "avg", limit: 10, splitValues: true, reason: `${frameworks.name} identifies tools linked with higher salary.` });

  return {
    source: "guardian-workforce-salary",
    domain: profile.domain || "workforce_salary",
    kpis,
    charts,
  };
}

function ensureRuleFallback(profile, dashboardPlan) {
  const rulePlan = buildRuleDashboardPlan(profile);
  return {
    source: [dashboardPlan?.source, "guardian-rules"].filter(Boolean).join("+"),
    domain: dashboardPlan?.domain || profile.domain,
    kpis: [...(dashboardPlan?.kpis || []), ...(rulePlan.kpis || [])],
    charts: [...(dashboardPlan?.charts || []), ...(rulePlan.charts || [])],
    filters: [...(dashboardPlan?.filters || []), ...(rulePlan.filters || [])],
  };
}

export function enforceDashboardQuality(profile, dashboardPlan = {}, options = {}) {
  const maxCharts = options.maxCharts || 7;
  const maxKpis = options.maxKpis || 8;

  let combined = ensureRuleFallback(profile, dashboardPlan);

  if (isWorkforceSalarySchema(profile)) {
    const salaryPlan = workforceSalaryPlan(profile);
    if (salaryPlan) {
      combined = {
        source: [salaryPlan.source, combined.source].filter(Boolean).join("+"),
        domain: combined.domain || salaryPlan.domain,
        kpis: [...salaryPlan.kpis, ...(combined.kpis || [])],
        charts: [...salaryPlan.charts, ...(combined.charts || [])],
        filters: combined.filters || [],
      };
    }
  }

  const safeKpis = uniqBy(
    (combined.kpis || [])
      .map((item) => normalizeKpiSpec(profile, item))
      .filter((kpi) => {
        if (!kpi) return false;
        if (kpi.metric === "__row_count__" || kpi.metric === "__column_count__") return true;
        const column = getColumn(profile, kpi.metric);
        if (!column) return false;
        if (isIdColumn(column) && ["sum", "avg"].includes(kpi.aggregation)) return false;
        if (["sum", "avg", "median", "min", "max"].includes(kpi.aggregation)) {
          return isMetricColumn(column);
        }
        return true;
      }),
    (kpi) => normalize(`${kpi.title}-${kpi.metric}-${kpi.aggregation}`)
  ).slice(0, maxKpis);

  const safeCharts = uniqBy(
    (combined.charts || [])
      .map((item) => normalizeChartSpec(profile, item))
      .map((chart) => validateChartCombination(profile, chart))
      .filter((result) => result.ok)
      .map((result) => result.chart),
    (chart) => normalize(`${chart.title}-${chart.type}-${chart.xKey}-${chart.yKey}-${chart.aggregation}`)
  ).slice(0, maxCharts);

  const isPriorityMetric = (name) => /revenue|sales|profit|amount/i.test(name || "");

  const sortedKpis = isWorkforceSalarySchema(profile) ? safeKpis : [...safeKpis].sort((a, b) => {
    const aPriority = isPriorityMetric(a.metric) ? 1 : 0;
    const bPriority = isPriorityMetric(b.metric) ? 1 : 0;
    return bPriority - aPriority;
  });

  const sortedCharts = isWorkforceSalarySchema(profile) ? safeCharts : [...safeCharts].sort((a, b) => {
    const aPriority = isPriorityMetric(a.yKey) || isPriorityMetric(a.xKey) ? 1 : 0;
    const bPriority = isPriorityMetric(b.yKey) || isPriorityMetric(b.xKey) ? 1 : 0;
    return bPriority - aPriority;
  });

  return {
    source: combined.source || "dashboard-quality-guardian",
    domain: combined.domain || profile.domain,
    schemaOnly: true,
    kpis: sortedKpis,
    charts: sortedCharts,
    filters: Array.isArray(combined.filters) ? combined.filters.slice(0, 8) : [],
    confidence: dashboardPlan.confidence,
    dashboardGoal: dashboardPlan.dashboardGoal,
    insightQuestions: dashboardPlan.insightQuestions,
    warnings: [...(dashboardPlan.warnings || []), ...(combined.warnings || [])],
    reasoningSummary: dashboardPlan.reasoningSummary,
    guardian: {
      enforced: true,
      chartCount: sortedCharts.length,
      kpiCount: sortedKpis.length,
      maxCharts,
      maxKpis,
      unsafeAiDataRemoved: true,
      schemaOnly: true,
      warnings: [],
      fixes: ["Removed unsafe AI values/data and validated dashboard specs."],
    },
    qualityGuard: {
      applied: true,
      expectedCharts: maxCharts,
      actualCharts: sortedCharts.length,
      schemaOnly: true,
      reason: isWorkforceSalarySchema(profile)
        ? "Strict workforce salary dashboard pattern enforced."
        : "Generic dashboard quality rules enforced.",
    },
  };
}

export function assessDashboardHealth(profile, dashboardPlan = {}) {
  const issues = [];
  const warnings = [];
  const charts = Array.isArray(dashboardPlan.charts) ? dashboardPlan.charts : [];
  const kpis = Array.isArray(dashboardPlan.kpis) ? dashboardPlan.kpis : [];

  if (!kpis.length) issues.push({ type: "missing_kpis", message: "Dashboard has no KPI cards." });
  if (!charts.length) issues.push({ type: "missing_charts", message: "Dashboard has no charts." });
  if (charts.some((chart) => Array.isArray(chart.data))) {
    issues.push({ type: "unsafe_chart_data", message: "Chart data exists in dashboard plan. AI must not provide chart.data." });
  }
  if (kpis.some((kpi) => Object.prototype.hasOwnProperty.call(kpi, "value"))) {
    issues.push({ type: "unsafe_kpi_value", message: "KPI values exist in dashboard plan. Values must be calculated locally." });
  }

  for (const chart of charts) {
    const result = validateChartCombination(profile, chart);
    if (!result.ok) issues.push({ type: "invalid_chart", chart: chart.title, message: result.reason });
  }

  if (isWorkforceSalarySchema(profile) && charts.length < 7) {
    warnings.push({ type: "incomplete_salary_dashboard", message: "Salary/workforce dataset should have up to 7 useful charts when columns exist." });
  }

  const score = Math.max(0, 100 - issues.length * 20 - warnings.length * 8);
  return {
    status: issues.length ? "failed" : warnings.length ? "warning" : "healthy",
    score,
    issues,
    warnings,
  };
}

export function getDashboardQualityIssues(profile, dashboardPlan = {}) {
  return assessDashboardHealth(profile, dashboardPlan).issues;
}

export function buildGuardianDashboardResponse(profile, dashboardPlan, options = {}) {
  const dashboard = enforceDashboardQuality(profile, dashboardPlan, options);
  return {
    dashboard,
    safePlan: dashboard,
    qualityScore: assessDashboardHealth(profile, dashboard).score,
    dashboardHealth: assessDashboardHealth(profile, dashboard),
    schemaOnly: true,
    warnings: dashboard.guardian?.warnings || [],
    fixes: dashboard.guardian?.fixes || [],
  };
}
