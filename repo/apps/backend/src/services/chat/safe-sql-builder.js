const AGG_SQL = {
  count: "COUNT",
  sum: "SUM",
  avg: "AVG",
  median: "MEDIAN",
  min: "MIN",
  max: "MAX",
};

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function columnExists(schema, columnName) {
  return (schema.columns || []).some((column) => column.name === columnName);
}

export function buildSafeAnalyticsSql({ plan, schema, tableName = "dataset" } = {}) {
  const aggregation = AGG_SQL[plan.aggregation || "avg"];
  if (!aggregation) throw new Error(`Unsupported aggregation '${plan.aggregation}'.`);

  const params = [];
  const where = [];
  for (const filter of plan.filters || []) {
    if (!columnExists(schema, filter.column)) throw new Error(`Unknown filter column '${filter.column}'.`);
    where.push(`${quoteIdentifier(filter.column)} = ?`);
    params.push(filter.value);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(100, Math.max(1, Number(plan.limit || 20)));
  const source = quoteIdentifier(tableName);

  if (plan.intent === "distribution") {
    if (!columnExists(schema, plan.metric)) throw new Error(`Unknown metric column '${plan.metric}'.`);
    return {
      sql: `SELECT ${quoteIdentifier(plan.metric)} AS value FROM ${source}${whereSql} LIMIT ${limit}`,
      params,
    };
  }

  if (plan.dimension) {
    if (!columnExists(schema, plan.dimension)) throw new Error(`Unknown dimension column '${plan.dimension}'.`);
    if (plan.metric !== "__row_count__" && !columnExists(schema, plan.metric)) throw new Error(`Unknown metric column '${plan.metric}'.`);
    const metricExpr = plan.metric === "__row_count__" || plan.aggregation === "count"
      ? "COUNT(*)"
      : `${aggregation}(${quoteIdentifier(plan.metric)})`;
    return {
      sql: `SELECT ${quoteIdentifier(plan.dimension)} AS label, ${metricExpr} AS value, COUNT(*) AS records FROM ${source}${whereSql} GROUP BY ${quoteIdentifier(plan.dimension)} ORDER BY value DESC LIMIT ${limit}`,
      params,
    };
  }

  if (plan.metric === "__row_count__" || plan.aggregation === "count") {
    return {
      sql: `SELECT COUNT(*) AS value FROM ${source}${whereSql} LIMIT 1`,
      params,
    };
  }

  if (!columnExists(schema, plan.metric)) throw new Error(`Unknown metric column '${plan.metric}'.`);
  return {
    sql: `SELECT ${aggregation}(${quoteIdentifier(plan.metric)}) AS value, COUNT(*) AS records FROM ${source}${whereSql} LIMIT 1`,
    params,
  };
}
