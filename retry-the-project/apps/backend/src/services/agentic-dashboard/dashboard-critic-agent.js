import { DashboardPlanSchema } from "./dashboard-schemas.js";

function collectColumnNames(plan = {}) {
  return new Set((plan.semanticProfile?.columns || []).map((column) => column.name));
}

function isRealDateColumn(plan = {}, columnName) {
  const column = (plan.semanticProfile?.columns || []).find((item) => item.name === columnName);
  const role = column?.semanticRole || column?.role;
  return Boolean(column && (column.type === "date" || role === "date" || role === "date_dimension" || /date|time|month|year/i.test(column.name || "")));
}

function normalizeChart(chart) {
  return {
    ...chart,
    yKey: chart.yKey === "__count__" ? "count" : chart.yKey,
  };
}

export function runDashboardCriticAgent(plan = {}) {
  const issues = [];
  const names = collectColumnNames(plan);
  const columns = plan.semanticProfile?.columns || [];
  const columnByName = new Map(columns.map((column) => [column.name, column]));
  const kpiKeys = new Set();
  const chartKeys = new Set();
  const blockedKpis = new Set([
    "attributes / columns",
    "numeric columns",
    "categorical columns",
    "missing values",
    "data quality score",
  ]);

  const cleanedKpis = (plan.kpis || []).filter((kpi) => {
    const title = String(kpi.title || "").toLowerCase();
    const key = `${title}:${kpi.metric}:${kpi.aggregation}`;
    if (kpiKeys.has(key)) {
      issues.push({ type: "duplicate_kpi", title: kpi.title, reason: `Duplicate KPI ${kpi.title}.` });
      return false;
    }
    kpiKeys.add(key);

    if (blockedKpis.has(title)) return false;
    if (/efficiency score|ai revenue index|growth score/i.test(kpi.title || "")) {
      issues.push({ type: "fake_kpi", title: kpi.title, reason: `KPI ${kpi.title} is not grounded in a declared calculation.` });
      return false;
    }

    if (kpi.metric === "__row_count__") return true;
    if (kpi.sourceColumn && names.has(kpi.sourceColumn)) return true;
    if (names.has(kpi.metric)) return true;
    issues.push({ type: "invalid_kpi", title: kpi.title, reason: `Unknown metric ${kpi.metric}.` });
    return false;
  });

  const cleanedCharts = (plan.charts || []).map(normalizeChart).filter((chart) => {
    const key = `${chart.type}:${chart.xKey}:${chart.yKey}:${chart.aggregation}:${chart.intent}`.toLowerCase();
    if (chartKeys.has(key)) {
      issues.push({ type: "duplicate_chart", title: chart.title, reason: `Duplicate chart ${chart.title}.` });
      return false;
    }
    chartKeys.add(key);

    if (chart.xKey === "__row_index__" || /row index/i.test(chart.title || "")) {
      issues.push({ type: "invalid_chart", title: chart.title, reason: "Row index is not a real business dimension." });
      return false;
    }

    if ((chart.type === "line" || chart.intent === "trend") && !isRealDateColumn(plan, chart.xKey)) {
      issues.push({ type: "invalid_chart", title: chart.title, reason: "Trend charts require a real date/time column." });
      return false;
    }

    const xOk = !chart.xKey || names.has(chart.xKey);
    const yOk = !chart.yKey || chart.yKey === "count" || names.has(chart.yKey);
    if (xOk && yOk) {
      const x = columnByName.get(chart.xKey);
      const y = columnByName.get(chart.yKey);
      const xRole = x?.semanticRole || x?.role;
      const yRole = y?.semanticRole || y?.role;
      const xIsGeo = String(xRole || "").startsWith("geo_") || xRole === "location";
      const xIsNumeric = ["number", "integer", "float", "decimal", "currency"].includes(x?.type) || String(xRole || "").includes("metric");
      const yIsNumeric = chart.yKey === "count" || ["number", "integer", "float", "decimal", "currency"].includes(y?.type) || String(yRole || "").includes("metric");

      if (chart.intent === "geo" && !xIsGeo) {
        issues.push({ type: "invalid_chart", title: chart.title, reason: "Geo charts require a geographic field." });
        return false;
      }

      if (chart.type === "scatter" && !(xIsNumeric && yIsNumeric)) {
        issues.push({ type: "invalid_chart", title: chart.title, reason: "Scatter charts require two numeric fields." });
        return false;
      }

      return true;
    }
    issues.push({ type: "invalid_chart", title: chart.title, reason: "Chart references a column outside the schema." });
    return false;
  });

  const cleanedPlan = {
    ...plan,
    kpis: cleanedKpis.slice(0, 8),
    charts: cleanedCharts.slice(0, 10),
  };

  const validation = DashboardPlanSchema.safeParse(cleanedPlan);
  if (!validation.success) {
    issues.push({
      type: "schema_validation",
      reason: validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    });
  }

  const valid = validation.success && cleanedKpis.length > 0 && issues.length === 0;

  return {
    valid,
    cleanedPlan: validation.success ? validation.data : cleanedPlan,
    issues,
    warnings: issues.map((issue) => issue.reason),
    qualityScore: Math.max(0, 100 - issues.length * 15),
  };
}
