import { aggregationLabel, dimensionColumn, findDimensionValue, metricColumn, primaryDimension, primaryMetric, titleForColumn } from "./chat-schema-utils.js";

const DEFAULT_LIMIT = 10;

function detectAggregation(message = "") {
  const lower = String(message).toLowerCase();
  if (/median/.test(lower)) return "median";
  if (/total|sum/.test(lower)) return "sum";
  if (/max|highest|largest/.test(lower)) return "max";
  if (/min|lowest|smallest/.test(lower)) return "min";
  if (/\b(count|records?|rows?)\b/.test(lower)) return "count";
  return "avg";
}

function extractLimit(message = "") {
  const match = String(message).match(/\btop\s+(\d{1,3})\b/i);
  return match ? Math.min(100, Math.max(1, Number(match[1]))) : DEFAULT_LIMIT;
}

function isGreeting(message = "") {
  return /^(hi|hello|hey|yo|namaste|good morning|good afternoon|good evening)[!. ]*$/i.test(String(message).trim());
}

function hasDateColumn(schema) {
  return (schema.columns || []).some((column) => column.role === "date" || column.type === "date");
}

function valueCandidate(message = "") {
  const match = String(message).match(/\b(?:kpi|card|metric)\s+(?:of|for|on|with)\s+(.+)$/i);
  if (!match) return "";
  return match[1]
    .replace(/[_-]+/g, " ")
    .replace(/\b(avg|average|mean|median|total|sum|max|min|highest|lowest|salary|usd|revenue|amount|kpi|card|metric)\b/ig, "")
    .trim();
}

function basePlan(intent, overrides = {}) {
  return {
    intent,
    metric: "",
    aggregation: "avg",
    dimension: "",
    filters: [],
    sort: { by: "value", direction: "desc" },
    limit: DEFAULT_LIMIT,
    chartType: "",
    needsCalculation: true,
    dashboardAction: "",
    ...overrides,
  };
}

export async function planChatCommand({ message, schema, activeFilters = [] } = {}) {
  const lower = String(message || "").toLowerCase().trim();
  const metric = metricColumn(schema, lower) || primaryMetric(schema);
  const dimension = dimensionColumn(schema, lower) || primaryDimension(schema);
  const aggregation = detectAggregation(lower);

  if (!lower) {
    return basePlan("unknown", { needsCalculation: false, answer: "Please enter a question or dashboard command." });
  }

  if (isGreeting(lower)) {
    return basePlan("greeting", {
      needsCalculation: false,
      answer: `Hi! I can help you analyze ${schema.datasetName}. Try asking: Compare ${titleForColumn(metric)} by ${titleForColumn(dimension)}.`,
    });
  }

  if (/clear\s+filters?|reset\s+filters?/.test(lower)) {
    return basePlan("filter_command", {
      needsCalculation: false,
      dashboardAction: "CLEAR_FILTER",
      answer: "Filters cleared.",
    });
  }

  if (/filter\s+to|show\s+only/.test(lower)) {
    const value = findDimensionValue(schema, lower);
    if (value) {
      return basePlan("filter_command", {
        needsCalculation: false,
        dimension: value.column.name,
        filters: [{ column: value.column.name, operator: "equals", value: value.value }],
        dashboardAction: "APPLY_FILTER",
        answer: `Applied filter ${value.column.title} = ${value.value}.`,
      });
    }
    return basePlan("unknown", { needsCalculation: false, answer: "I could not find that filter value in the dataset schema profile." });
  }

  if (/trend|over time|time series/.test(lower)) {
    if (!hasDateColumn(schema)) {
      return basePlan("trend", {
        needsCalculation: false,
        answer: `No date/time column is available, so trend over time cannot be calculated. I can compare ${titleForColumn(metric)} by ${titleForColumn(dimension)} instead.`,
      });
    }
  }

  if (/summari[sz]e|explain this data|what is this dataset about/.test(lower)) {
    return basePlan("dataset_summary", { needsCalculation: false });
  }

  if (/kpi|card/.test(lower)) {
    const resolvedValue = findDimensionValue(schema, lower);
    const candidate = valueCandidate(message);
    if (!resolvedValue && candidate) {
      return basePlan("unknown", {
        needsCalculation: false,
        answer: `I could not find '${candidate}' in available ${titleForColumn(dimension)} values.`,
      });
    }
    return basePlan("add_kpi", {
      metric: metric?.name || "__row_count__",
      aggregation,
      dimension: resolvedValue?.column?.name || "",
      filters: resolvedValue ? [{ column: resolvedValue.column.name, operator: "equals", value: resolvedValue.value }] : activeFilters,
      chartType: "KPI",
      dashboardAction: "ADD_KPI",
    });
  }

  if (/distribution|histogram/.test(lower)) {
    return basePlan("distribution", {
      metric: metric?.name,
      aggregation: "count",
      chartType: "histogram",
      limit: 20,
      dashboardAction: "ADD_CHART",
    });
  }

  if (/\btop\s+\d+/.test(lower)) {
    return basePlan("top_n", {
      metric: metric?.name,
      aggregation,
      dimension: dimension?.name,
      limit: extractLimit(lower),
      chartType: "horizontal_bar",
      dashboardAction: "ADD_CHART",
    });
  }

  if (/compare| by |chart|graph|bar chart|make a chart|create chart/.test(lower)) {
    return basePlan("compare_metric_by_dimension", {
      metric: metric?.name,
      aggregation,
      dimension: dimension?.name,
      chartType: "bar",
      dashboardAction: "ADD_CHART",
    });
  }

  if (/average|avg|mean|median|total|sum|max|min|salary|revenue|amount/.test(lower)) {
    return basePlan("metric_question", {
      metric: metric?.name,
      aggregation,
      chartType: "KPI",
      dashboardAction: "ADD_KPI",
    });
  }

  return basePlan("unknown", {
    needsCalculation: false,
    answer: `I can help with schema-safe analytics. Try: Compare ${titleForColumn(metric)} by ${titleForColumn(dimension)}.`,
  });
}

export function describePlan(plan = {}, schema = {}) {
  const metric = (schema.columns || []).find((column) => column.name === plan.metric);
  const dimension = (schema.columns || []).find((column) => column.name === plan.dimension);
  if (plan.intent === "dataset_summary") {
    return `${schema.datasetName} has ${schema.rowCount.toLocaleString()} rows and ${schema.columnCount} columns. Key fields include ${(schema.columns || []).slice(0, 6).map((column) => column.name).join(", ")}.`;
  }
  if (plan.intent === "filter_command") return plan.answer;
  return `${aggregationLabel(plan.aggregation)} ${titleForColumn(metric)}${dimension ? ` by ${titleForColumn(dimension)}` : ""}.`;
}
