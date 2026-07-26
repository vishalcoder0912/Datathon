import { aggregationLabel, formatValue, titleForColumn } from "./chat-schema-utils.js";

export async function generateChatAnswer({ message, plan, result, schema } = {}) {
  if (plan.answer) return plan.answer;

  const metric = (schema.columns || []).find((column) => column.name === plan.metric);
  const dimension = (schema.columns || []).find((column) => column.name === plan.dimension);

  if (plan.intent === "dataset_summary") {
    return `${schema.datasetName} contains ${schema.rowCount.toLocaleString()} rows and ${schema.columnCount} columns. Key fields include ${(schema.columns || []).slice(0, 7).map((column) => column.name).join(", ")}. I can compare metrics, build KPIs, filter categories, and create charts from aggregate results.`;
  }

  if (!result?.rows?.length) {
    return "I could not find aggregate results for that request.";
  }

  if (plan.dimension) {
    const top = result.rows[0];
    return `${top.label} has the highest ${aggregationLabel(plan.aggregation).toLowerCase()} ${titleForColumn(metric)} at ${formatValue(top.value, metric)} across ${Number(top.records || 0).toLocaleString()} records. I created a ${plan.chartType || "bar"} chart for ${titleForColumn(metric)} by ${titleForColumn(dimension)}.`;
  }

  const row = result.rows[0];
  return `${aggregationLabel(plan.aggregation)} ${titleForColumn(metric)} is ${formatValue(row.value, metric)} across ${Number(row.records || result.rowsScanned || 0).toLocaleString()} records.`;
}
