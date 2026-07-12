const ALLOWED_INTENTS = new Set([
  "greeting",
  "dataset_summary",
  "metric_question",
  "compare_metric_by_dimension",
  "top_n",
  "distribution",
  "filter_command",
  "add_kpi",
  "add_chart",
  "trend",
  "anomaly",
  "unknown",
]);

const ALLOWED_AGGREGATIONS = new Set(["count", "sum", "avg", "median", "min", "max"]);
const ALLOWED_CHART_TYPES = new Set(["bar", "horizontal_bar", "line", "histogram", "table", "scatter", "boxplot", "KPI"]);
const UNSAFE_SQL = /\b(select|insert|update|delete|drop|alter|truncate|attach|copy|pragma|join|union|;|--|\/\*)\b/i;

function schemaColumns(schema = {}) {
  return new Set((schema.columns || []).map((column) => column.name));
}

function availableColumns(schema = {}) {
  return (schema.columns || []).map((column) => column.name).join(", ");
}

export function validateChatPlan({ plan, schema, message } = {}) {
  const columns = schemaColumns(schema);
  const errors = [];

  if (UNSAFE_SQL.test(String(message || ""))) {
    errors.push("Raw SQL or unsafe database commands are not allowed in chat.");
  }

  if (!ALLOWED_INTENTS.has(plan.intent)) errors.push(`Unsupported intent '${plan.intent}'.`);
  if (plan.aggregation && !ALLOWED_AGGREGATIONS.has(plan.aggregation)) errors.push(`Unsupported aggregation '${plan.aggregation}'.`);
  if (plan.chartType && !ALLOWED_CHART_TYPES.has(plan.chartType)) errors.push(`Unsupported chart type '${plan.chartType}'.`);

  if (plan.metric && plan.metric !== "__row_count__" && !columns.has(plan.metric)) {
    errors.push(`Column '${plan.metric}' does not exist in this dataset.`);
  }

  if (plan.dimension && !columns.has(plan.dimension)) {
    errors.push(`Column '${plan.dimension}' does not exist in this dataset.`);
  }

  for (const filter of plan.filters || []) {
    if (!filter.column || !columns.has(filter.column)) {
      errors.push(`Filter column '${filter.column || "unknown"}' does not exist in this dataset.`);
    }
  }

  if (errors.length) {
    return {
      valid: false,
      message: `${errors[0]} Available columns are: ${availableColumns(schema)}.`,
      errors,
    };
  }

  return { valid: true, errors: [] };
}
