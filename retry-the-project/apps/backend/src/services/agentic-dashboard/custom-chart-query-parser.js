function normalize(text = "") {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function columnName(column = {}) {
  return column.name || column.key || column.id || "";
}

export function detectChartType(query = "") {
  const lower = normalize(query);
  if (/\bhorizontal\s+bar\b/.test(lower)) return "horizontal_bar";
  if (/\b(line|trend|over time|time series)\b/.test(lower)) return "line";
  if (/\b(pie|donut|breakdown|share)\b/.test(lower)) return lower.includes("donut") ? "donut" : "pie";
  if (/\b(scatter|correlation)\b/.test(lower)) return "scatter";
  if (/\b(histogram|distribution)\b/.test(lower)) return "histogram";
  if (/\b(area)\b/.test(lower)) return "area";
  if (/\b(bar|compare|by|vary)\b/.test(lower)) return "bar";
  return null;
}

export function detectAggregation(query = "") {
  const lower = normalize(query);
  if (/\b(avg|average|mean)\b/.test(lower)) return "avg";
  if (/\b(median)\b/.test(lower)) return "median";
  if (/\b(min|minimum|lowest)\b/.test(lower)) return "min";
  if (/\b(max|maximum|highest)\b/.test(lower)) return "max";
  if (/\b(unique|distinct)\b/.test(lower)) return "count_unique";
  if (/\b(count|number of|records)\b/.test(lower)) return "count";
  if (/\b(sum|total)\b/.test(lower)) return "sum";
  return null;
}

function roleOf(column = {}) {
  const name = normalize(columnName(column));
  const type = normalize(column.type || column.inferredType || column.role || "");
  const explicitRole = normalize(column.role || "");
  if (explicitRole.includes("metric")) return "metric";
  if (["category", "dimension", "location", "target", "numeric_category"].includes(explicitRole)) {
    return explicitRole === "category" ? "dimension" : explicitRole;
  }
  if (explicitRole === "date") return "date";
  if (explicitRole === "id") return "id";
  if (/date|time|timestamp|year|month/.test(name) || /date|time/.test(type)) return "date";
  if (/number|numeric|int|float|double|decimal|metric/.test(type)) return "metric";
  if (/country|state|city|region|market|location|geo/.test(name)) return "location";
  return "dimension";
}

function findMentionedColumn(query = "", columns = [], predicate = () => true) {
  const lower = normalize(query);
  const ranked = columns
    .filter(predicate)
    .map((column) => {
      const name = columnName(column);
      const normalizedName = normalize(name);
      const compactName = normalizedName.replace(/\s+/g, "");
      const compactQuery = lower.replace(/\s+/g, "");
      const score =
        lower === normalizedName ? 4 :
        lower.includes(normalizedName) ? 3 :
        compactQuery.includes(compactName) ? 2 :
        normalizedName.split(" ").some((part) => part.length > 2 && lower.includes(part)) ? 1 :
        0;
      return { column, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.column || null;
}

function firstByRole(columns = [], roles = []) {
  return columns.find((column) => roles.includes(roleOf(column))) || null;
}

export function categorizeSchemaColumns(schemaProfile = {}) {
  const columns = Array.isArray(schemaProfile.columns) ? schemaProfile.columns : [];
  return {
    metrics: columns.filter((column) => roleOf(column) === "metric").map(columnName).filter(Boolean),
    categories: columns.filter((column) => ["dimension", "location"].includes(roleOf(column))).map(columnName).filter(Boolean),
    dates: columns.filter((column) => roleOf(column) === "date").map(columnName).filter(Boolean),
  };
}

export function findColumnMatch(text = "", schemaProfile = {}, predicate = () => true) {
  const columns = Array.isArray(schemaProfile.columns) ? schemaProfile.columns : [];
  const match = findMentionedColumn(text, columns, predicate);
  return match ? columnName(match) : null;
}

export function normalizeChartAction(action = {}) {
  const x = action.x ?? action.xKey ?? action.dimension ?? action.chartSpec?.xKey;
  const y = action.y ?? action.yKey ?? action.metric ?? action.measure ?? action.chartSpec?.yKey;
  const chartType = action.chart_type ?? action.chartType ?? action.type ?? action.chartSpec?.type;

  return {
    ...action,
    ...(x ? { x, xKey: x } : {}),
    ...(y ? { y, yKey: y } : {}),
    ...(chartType ? { chart_type: chartType, chartType, type: action.type || chartType } : {}),
  };
}

function parseFilter(query = "", schemaProfile = {}) {
  const match = String(query).match(/filter\s+(.+?)\s*(?:=|is|to)\s*(.+)$/i);
  if (!match) return null;
  const column = findColumnMatch(match[1], schemaProfile);
  if (!column) return null;
  return {
    action: "filter",
    filters: {
      [column]: match[2].trim().replace(/^["']|["']$/g, ""),
    },
    schemaOnly: true,
  };
}

function parseKpi(query = "", schemaProfile = {}) {
  const aggregation = detectAggregation(query);
  if (!aggregation || !/\b(total|sum|average|avg|mean|median|min|max|count|unique|distinct)\b/i.test(query)) {
    return null;
  }
  const metric = findColumnMatch(query, schemaProfile, (column) => {
    const role = roleOf(column);
    return role === "metric" || (aggregation === "count_unique" && ["dimension", "location"].includes(role));
  });
  if (!metric) return null;
  return {
    action: "create_kpi",
    metric,
    aggregation,
    title: `${aggregation} ${metric}`,
    schemaOnly: true,
  };
}

function queryParts(query = "") {
  return normalize(query).split(/\s+(?:vs|by|over)\s+/).map((part) => part.trim()).filter(Boolean);
}

export function parseCustomChartQuery(query = "", schemaProfile = {}) {
  const columns = Array.isArray(schemaProfile.columns) ? schemaProfile.columns : [];
  if (!String(query).trim() || !columns.length) return null;

  const filter = parseFilter(query, schemaProfile);
  if (filter) return filter;

  const explicitChartType = detectChartType(query);
  const kpi = explicitChartType ? null : parseKpi(query, schemaProfile);
  if (kpi) return kpi;

  let chart_type = explicitChartType || "bar";
  const inferredAggregation = /\b(vary|relationship|compare)\b/i.test(query) ? "avg" : "sum";
  const aggregation = detectAggregation(query) || inferredAggregation;
  const parts = queryParts(query);
  const metric =
    findMentionedColumn(query, columns, (column) => roleOf(column) === "metric") ||
    firstByRole(columns, ["metric"]);
  const date = findMentionedColumn(query, columns, (column) => roleOf(column) === "date") || firstByRole(columns, ["date"]);
  const dimension =
    findMentionedColumn(query, columns, (column) => ["dimension", "location"].includes(roleOf(column))) ||
    firstByRole(columns, ["location", "dimension"]);

  const explicitDimensionRequest = String(query).match(/\b(?:of|by)\s+([a-z0-9_\s-]+)$/i);
  if (explicitDimensionRequest && ["pie", "donut"].includes(chart_type)) {
    const requestedDimension = findMentionedColumn(explicitDimensionRequest[1], columns, (column) =>
      ["dimension", "location"].includes(roleOf(column)),
    );
    if (!requestedDimension) return null;
  }

  let xColumn = dimension;
  let yColumn = metric;

  if (parts.length >= 2) {
    const left = findMentionedColumn(parts[0], columns);
    const right = findMentionedColumn(parts[1], columns);
    if (left && right) {
      const leftRole = roleOf(left);
      const rightRole = roleOf(right);
      if (!explicitChartType && /\bvs\b/i.test(query) && leftRole === "metric" && rightRole === "metric") {
        chart_type = "scatter";
        xColumn = left;
        yColumn = right;
      } else if (["dimension", "location", "date"].includes(leftRole) && rightRole === "metric") {
        xColumn = left;
        yColumn = right;
      } else if (leftRole === "metric" && ["dimension", "location", "date"].includes(rightRole)) {
        xColumn = right;
        yColumn = left;
      } else {
        xColumn = left;
        yColumn = right;
      }
    }
  }

  if (chart_type === "line" && date) {
    xColumn = date;
  }

  if (chart_type === "histogram" && metric) {
    xColumn = metric;
    yColumn = metric;
  }

  if (chart_type === "scatter") {
    const numericColumns = columns.filter((column) => roleOf(column) === "metric");
    const left = parts[0] ? findMentionedColumn(parts[0], numericColumns) : null;
    const right = parts[1] ? findMentionedColumn(parts[1], numericColumns) : null;
    if (left && right) {
      xColumn = left;
      yColumn = right;
    } else {
      const mentioned = numericColumns.filter((column) => normalize(query).includes(normalize(columnName(column)).split(" ")[0]));
      xColumn = mentioned[0] || findMentionedColumn(query, numericColumns) || numericColumns[0] || metric;
      yColumn = mentioned.find((column) => columnName(column) !== columnName(xColumn)) ||
        numericColumns.find((column) => columnName(column) !== columnName(xColumn)) ||
        metric;
    }
  }

  if (!explicitChartType && !/\b(show|create|make|chart|plot|graph|distribution|scatter|vary|average|avg|sum|total|compare|by|vs)\b/i.test(query)) {
    return null;
  }

  if (!xColumn && !yColumn) return null;

  const xKey = columnName(xColumn);
  let yKey = yColumn ? columnName(yColumn) : "count";

  if (["pie", "donut"].includes(chart_type) && roleOf(xColumn) !== "metric") {
    yKey = "count";
  }

  if (chart_type === "bar" && roleOf(yColumn) !== "metric") {
    yKey = yKey || "count";
  }

  const safeAggregation = yKey === "count" || yKey === "__row_count__" || roleOf(yColumn) !== "metric" ? "count" : aggregation;

  return normalizeChartAction({
    action: "create_chart",
    chart_type,
    chartType: chart_type,
    x: xKey,
    xKey,
    y: yKey,
    yKey,
    dimension: xKey,
    measure: yKey,
    aggregation: safeAggregation,
    title: `${yKey === "__row_count__" ? "Records" : yKey} by ${xKey}`,
    confidence: 0.9,
    schemaOnly: true,
  });
}

export default {
  parseCustomChartQuery,
  normalizeChartAction,
  categorizeSchemaColumns,
  findColumnMatch,
  detectChartType,
  detectAggregation,
};
