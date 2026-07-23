import crypto from "node:crypto";

const MONEY_TERMS = ["revenue", "sales", "amount", "price", "profit", "income", "salary", "compensation", "ctc", "gmv", "order_value"];
const SALARY_TERMS = ["salary", "compensation", "ctc", "pay", "package"];
const REVENUE_TERMS = ["revenue", "sales", "amount", "gmv", "order_value"];
const PROFIT_TERMS = ["profit", "margin"];
const ORDER_TERMS = ["order", "orders", "quantity", "qty", "units"];

function hasAny(name, terms) {
  const n = String(name || "").toLowerCase();
  return terms.some((term) => n.includes(term));
}

function roleOf(col = {}) {
  return col.semanticRole || col.role;
}

function isNumeric(col = {}) {
  return ["number", "integer", "float", "decimal", "currency"].includes(col.type) ||
    ["money_metric", "continuous_metric", "count_metric", "score_metric", "rate_metric"].includes(roleOf(col));
}

function makeKpi(title, metric, aggregation, format = "number", confidence = 0.85) {
  return {
    id: crypto.randomUUID(),
    title,
    metric: metric?.name || "__row_count__",
    sourceColumn: metric?.name || null,
    aggregation,
    format,
    confidence,
    businessKpi: true,
  };
}

export function runKpiAgent({ schemaProfile, semanticProfile }) {
  const columns = semanticProfile?.columns || schemaProfile.columns || [];
  const numeric = columns.filter(isNumeric);
  const geo = columns.filter((column) =>
    ["geo_country", "geo_state", "geo_city", "geo_region"].includes(roleOf(column))
  );

  const kpis = [];
  const revenue = numeric.find((column) => hasAny(column.name, REVENUE_TERMS));
  const salary = numeric.find((column) => hasAny(column.name, SALARY_TERMS));
  const profit = numeric.find((column) => hasAny(column.name, PROFIT_TERMS));
  const orders = numeric.find((column) => hasAny(column.name, ORDER_TERMS));

  if (salary) {
    kpis.push(makeKpi(`Average ${salary.title || salary.name}`, salary, "avg", "currency", 0.95));
    kpis.push(makeKpi(`Median ${salary.title || salary.name}`, salary, "median", "currency", 0.9));
    kpis.push(makeKpi(`Highest ${salary.title || salary.name}`, salary, "max", "currency", 0.9));
  } else if (revenue) {
    kpis.push(makeKpi(`Total ${revenue.title || revenue.name}`, revenue, "sum", "currency", 0.95));
    kpis.push(makeKpi(`Average ${revenue.title || revenue.name}`, revenue, "avg", "currency", 0.9));
  }

  if (!salary && profit) {
    kpis.push(makeKpi(`Total ${profit.title || profit.name}`, profit, "sum", "currency", 0.88));
  }

  if (!salary && orders) {
    kpis.push(makeKpi(`Total ${orders.title || orders.name}`, orders, "sum", "number", 0.84));
  }

  if (!revenue && !salary && !profit && !orders && numeric[0]) {
    kpis.push(makeKpi(`Average ${numeric[0].title || numeric[0].name}`, numeric[0], "avg", "number", 0.82));
    kpis.push(makeKpi(`Maximum ${numeric[0].title || numeric[0].name}`, numeric[0], "max", "number", 0.78));
  }

  if (geo[0]) {
    kpis.push(makeKpi(`${geo[0].title || geo[0].name} Covered`, geo[0], "count_unique", "number", 0.88));
  }

  kpis.push(makeKpi("Total Records", null, "count", "number", 1));

  return dedupeKpis(kpis).slice(0, 6);
}

function dedupeKpis(kpis) {
  const seen = new Set();
  return kpis.filter((kpi) => {
    const key = `${kpi.title}:${kpi.metric}:${kpi.aggregation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
