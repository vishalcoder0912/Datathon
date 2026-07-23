import { aggregationLabel, titleForColumn } from "./chat-schema-utils.js";

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildChartFromQueryResult({ plan, result, schema } = {}) {
  const metric = (schema.columns || []).find((column) => column.name === plan.metric);
  const dimension = (schema.columns || []).find((column) => column.name === plan.dimension);

  if (!result || !Array.isArray(result.rows) || !result.rows.length) return null;

  if (plan.chartType === "KPI" || plan.intent === "metric_question" || plan.intent === "add_kpi") {
    const first = result.rows[0] || {};
    return {
      kpi: {
        id: makeId("kpi"),
        title: plan.filters?.length
          ? `${aggregationLabel(plan.aggregation)} ${titleForColumn(metric)} - ${plan.filters[0].value}`
          : `${aggregationLabel(plan.aggregation)} ${titleForColumn(metric)}`,
        metric: plan.metric,
        aggregation: plan.aggregation,
        filters: plan.filters || [],
        rawValue: first.value,
        value: String(first.value ?? "N/A"),
        subtitle: `${aggregationLabel(plan.aggregation)} over ${first.records || result.rowsScanned || 0} records`,
        calculationSource: `${String(plan.aggregation).toUpperCase()}(${plan.metric})`,
      },
    };
  }

  const type = plan.intent === "top_n" ? "horizontal_bar" : plan.chartType || "bar";
  const chart = {
    id: makeId("chart"),
    title: plan.intent === "distribution"
      ? `${titleForColumn(metric)} Distribution`
      : `${aggregationLabel(plan.aggregation)} ${titleForColumn(metric)} by ${titleForColumn(dimension)}`,
    type,
    xKey: "label",
    yKey: "value",
    data: result.rows,
    metric: plan.metric,
    aggregation: plan.aggregation,
    dimension: plan.dimension,
    calculationSource: plan.dimension
      ? `${String(plan.aggregation).toUpperCase()}(${plan.metric}) grouped by ${plan.dimension}`
      : `${String(plan.aggregation).toUpperCase()}(${plan.metric})`,
    createdBy: "ai",
  };

  if (["pie", "donut"].includes(chart.type) && plan.aggregation !== "count") {
    chart.type = "bar";
  }

  if (chart.type === "line" && !dimension) return null;
  if (chart.xKey === "__row_index__") return null;

  return { chart };
}
