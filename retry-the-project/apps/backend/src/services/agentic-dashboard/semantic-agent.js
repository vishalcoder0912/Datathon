const MONEY_TERMS = ["revenue", "sales", "amount", "price", "profit", "income", "salary", "compensation", "ctc", "gmv"];
const GEO_TERMS = ["country", "state", "city", "region", "location", "market", "territory"];
const DATE_TERMS = ["date", "time", "month", "year", "created", "updated", "timestamp"];

function normalized(column = {}) {
  return String(column.normalizedName || column.name || "").toLowerCase();
}

function includesAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function semanticRole(column = {}) {
  const name = normalized(column);
  const role = column.role || "";

  if (includesAny(name, GEO_TERMS) || role === "location") {
    if (name.includes("country")) return "geo_country";
    if (name.includes("state")) return "geo_state";
    if (name.includes("city")) return "geo_city";
    return "geo_region";
  }

  if (column.type === "date" || role === "date" || includesAny(name, DATE_TERMS)) return "date_dimension";
  if (role === "money_metric" || includesAny(name, MONEY_TERMS)) return "money_metric";
  if (["continuous_metric", "count_metric", "score_metric", "rate_metric"].includes(role)) return role;
  if (["category", "target", "numeric_category"].includes(role)) return "category_dimension";
  if (role === "id") return "identifier";
  return role || column.type || "unknown";
}

export function runSemanticAgent(schemaProfile = {}) {
  const columns = (schemaProfile.columns || []).map((column) => ({
    ...column,
    semanticRole: column.semanticRole || semanticRole(column),
  }));

  return {
    datasetName: schemaProfile.datasetName,
    rowCount: schemaProfile.rowCount || 0,
    columnCount: schemaProfile.columnCount || columns.length,
    domain: schemaProfile.domain || "generic",
    columns,
    numericColumns: columns.filter((column) =>
      ["money_metric", "continuous_metric", "count_metric", "score_metric", "rate_metric"].includes(column.semanticRole) ||
      ["number", "integer", "float", "decimal", "currency"].includes(column.type)
    ).map((column) => column.name),
    categoricalColumns: columns.filter((column) =>
      ["category_dimension", "geo_country", "geo_state", "geo_city", "geo_region"].includes(column.semanticRole)
    ).map((column) => column.name),
    dateColumns: columns.filter((column) => column.semanticRole === "date_dimension").map((column) => column.name),
    geoColumns: columns.filter((column) => String(column.semanticRole).startsWith("geo_")).map((column) => column.name),
  };
}
