import { humanize, isMissing, normalizeColumnName, safeNumber } from "./schema-fingerprint.js";

const MONEY = "currency";

function normalize(value = "") {
  return normalizeColumnName(value);
}

function findColumn(profile, aliases = [], roles = []) {
  const wanted = aliases.map(normalize).filter(Boolean);
  const columns = profile.columns || [];
  const scored = columns.map((column) => {
    const name = normalize(column.name);
    let score = 0;
    for (const alias of wanted) {
      if (name === alias) score += 50;
      else if (name.includes(alias) || alias.includes(name)) score += 20;
    }
    if (roles.includes(column.role)) score += 20;
    if (roles.includes("metric") && /metric/.test(column.role || "")) score += 10;
    if (column.role === "id" || column.noisy) score -= 100;
    return { column, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored[0]?.column || null;
}

function aggregate(rows, column, aggregation = "count") {
  if (aggregation === "count") return rows.length;
  if (!column) return null;
  const present = rows.map((row) => row[column.name]).filter((value) => !isMissing(value));
  if (aggregation === "count_unique") return new Set(present.map((value) => String(value).trim().toLowerCase())).size;

  const numbers = present.map(safeNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (!numbers.length) return null;
  if (aggregation === "sum") return numbers.reduce((total, value) => total + value, 0);
  if (aggregation === "avg") return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  if (aggregation === "max") return numbers[numbers.length - 1];
  if (aggregation === "min") return numbers[0];
  if (aggregation === "median") {
    const mid = Math.floor(numbers.length / 2);
    return numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
  }
  return null;
}

function formatValue(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (format === "percent") return `${Number(value).toFixed(1)}%`;
  if (format === MONEY) return `$${Math.round(Number(value)).toLocaleString("en-US")}`;
  if (Number.isInteger(value) || Math.abs(Number(value)) >= 1000) return Math.round(Number(value)).toLocaleString("en-US");
  return Number(value).toFixed(2);
}

function makeKpi({ id, title, column, aggregation, format = "number", value, reason }) {
  return {
    id,
    title,
    metric: column?.name || "__row_count__",
    aggregation,
    format,
    value,
    reason,
  };
}

function pushCalculated(kpis, rows, spec) {
  const raw = spec.rawValue !== undefined ? spec.rawValue : aggregate(rows, spec.column, spec.aggregation);
  if (raw === null || raw === undefined || Number.isNaN(raw)) return;
  kpis.push(makeKpi({ ...spec, value: formatValue(raw, spec.format) }));
}

function topSegment(rows, dimension, metric, aggregation = "sum") {
  if (!dimension || !metric) return null;
  const groups = new Map();
  for (const row of rows) {
    const label = String(row[dimension.name] ?? "").trim();
    const value = safeNumber(row[metric.name]);
    if (!label || value === null) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(value);
  }
  const ranked = [...groups.entries()].map(([label, values]) => {
    const value = aggregation === "avg"
      ? values.reduce((total, item) => total + item, 0) / values.length
      : values.reduce((total, item) => total + item, 0);
    return { label, value };
  }).sort((a, b) => b.value - a.value);
  return ranked[0] || null;
}

function firstRanked(plan, key, profile) {
  const raw = plan?.rankedColumns?.[key] || [];
  const names = Array.isArray(raw) ? raw : [raw];
  return names.map((name) => findColumn(profile, [name])).find(Boolean);
}

export function selectSeniorKpis({ dataset = {}, profile = {}, seniorAnalysisPlan = {}, maxKpis = 8 } = {}) {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const domain = seniorAnalysisPlan.domain || profile.domain || "generic";
  const primaryMetric = firstRanked(seniorAnalysisPlan, "primaryMetric", profile) ||
    findColumn(profile, ["revenue", "sales", "salary", "amount", "profit", "score", "marks", "gmv"], ["metric", "money_metric", "score_metric"]);
  const primaryDimension = firstRanked(seniorAnalysisPlan, "dimensions", profile);
  const kpis = [];

  const revenue = findColumn(profile, ["revenue", "sales", "amount", "gmv", "total_price", "order_value"], ["money_metric"]);
  const orders = findColumn(profile, ["order_id", "orders", "order"], ["id", "count_metric"]);
  const units = findColumn(profile, ["quantity", "qty", "units"], ["count_metric"]);
  const salary = findColumn(profile, ["salary", "salary_usd", "compensation", "pay"], ["money_metric"]);
  const expense = findColumn(profile, ["expense", "cost", "spend"], ["money_metric"]);
  const income = findColumn(profile, ["income", "revenue"], ["money_metric"]);
  const marks = findColumn(profile, ["marks", "score", "cgpa", "gpa"], ["score_metric"]);
  const stock = findColumn(profile, ["stock", "inventory", "quantity_on_hand"], ["count_metric", "continuous_metric"]);
  const price = findColumn(profile, ["price", "unit_price", "value", "cost"], ["money_metric"]);
  const impressions = findColumn(profile, ["impressions"], ["count_metric"]);
  const clicks = findColumn(profile, ["clicks"], ["count_metric"]);
  const conversions = findColumn(profile, ["conversions", "conversion"], ["count_metric", "rate_metric"]);

  if (["sales", "ecommerce"].includes(domain)) {
    if (revenue) pushCalculated(kpis, rows, { id: "total-revenue", title: domain === "ecommerce" ? "GMV" : "Total Revenue", column: revenue, aggregation: "sum", format: MONEY, reason: "Primary commercial value metric." });
    if (revenue && orders) {
      const orderCount = orders.role === "id" ? aggregate(rows, orders, "count_unique") : aggregate(rows, orders, "sum");
      const totalRevenue = aggregate(rows, revenue, "sum");
      if (orderCount) pushCalculated(kpis, rows, { id: "aov", title: "AOV", rawValue: totalRevenue / orderCount, aggregation: "avg", format: MONEY, column: revenue, reason: "Average order value from local revenue and order count." });
    }
    if (orders) pushCalculated(kpis, rows, { id: "orders", title: "Orders", column: orders, aggregation: orders.role === "id" ? "count_unique" : "sum", reason: "Actual order volume." });
    if (units) pushCalculated(kpis, rows, { id: "units", title: "Units", column: units, aggregation: "sum", reason: "Unit volume." });
    const top = topSegment(rows, primaryDimension, revenue, "sum");
    if (top) kpis.push(makeKpi({ id: "top-segment", title: "Top Segment", column: primaryDimension, aggregation: "top", value: top.label, reason: "Highest segment by primary revenue metric." }));
  } else if (domain === "HR/salary" || /salary/i.test(domain)) {
    if (salary) {
      pushCalculated(kpis, rows, { id: "avg-salary", title: "Average Salary", column: salary, aggregation: "avg", format: MONEY, reason: "Mean compensation." });
      pushCalculated(kpis, rows, { id: "median-salary", title: "Median Salary", column: salary, aggregation: "median", format: MONEY, reason: "Typical compensation less affected by outliers." });
      pushCalculated(kpis, rows, { id: "max-salary", title: "Max Salary", column: salary, aggregation: "max", format: MONEY, reason: "Upper compensation range." });
    }
  } else if (domain === "finance") {
    if (income) pushCalculated(kpis, rows, { id: "income", title: "Income", column: income, aggregation: "sum", format: MONEY, reason: "Total money inflow." });
    if (expense) pushCalculated(kpis, rows, { id: "expense", title: "Expense", column: expense, aggregation: "sum", format: MONEY, reason: "Total money outflow." });
    if (income && expense) {
      const profit = aggregate(rows, income, "sum") - aggregate(rows, expense, "sum");
      pushCalculated(kpis, rows, { id: "profit", title: "Profit", rawValue: profit, column: income, aggregation: "calculated", format: MONEY, reason: "Income minus expense." });
    }
  } else if (domain === "education") {
    if (marks) {
      pushCalculated(kpis, rows, { id: "avg-score", title: `Average ${humanize(marks.name)}`, column: marks, aggregation: "avg", reason: "Academic performance average." });
      pushCalculated(kpis, rows, { id: "top-score", title: "Topper Score", column: marks, aggregation: "max", reason: "Highest observed score." });
    }
    const pass = findColumn(profile, ["pass", "passed", "result", "status"], ["target", "category"]);
    if (pass) {
      const present = rows.filter((row) => !isMissing(row[pass.name]));
      const passed = present.filter((row) => /pass|yes|true|1/i.test(String(row[pass.name]))).length;
      if (present.length) pushCalculated(kpis, rows, { id: "pass-rate", title: "Pass Rate", rawValue: (passed / present.length) * 100, column: pass, aggregation: "calculated", format: "percent", reason: "Pass rate calculated from result/status values." });
    }
  } else if (domain === "inventory") {
    if (stock) pushCalculated(kpis, rows, { id: "stock-units", title: "Stock Units", column: stock, aggregation: "sum", reason: "Total available inventory." });
    if (stock && price) pushCalculated(kpis, rows, { id: "stock-value", title: "Stock Value", rawValue: rows.reduce((total, row) => total + (safeNumber(row[stock.name]) || 0) * (safeNumber(row[price.name]) || 0), 0), column: stock, aggregation: "calculated", format: MONEY, reason: "Quantity multiplied by value/price." });
    if (stock) pushCalculated(kpis, rows, { id: "low-stock", title: "Low Stock Items", rawValue: rows.filter((row) => (safeNumber(row[stock.name]) || 0) <= 5).length, column: stock, aggregation: "calculated", reason: "Items at or below low-stock threshold." });
  } else if (domain === "marketing") {
    if (impressions) pushCalculated(kpis, rows, { id: "impressions", title: "Impressions", column: impressions, aggregation: "sum", reason: "Ad exposure volume." });
    if (clicks) pushCalculated(kpis, rows, { id: "clicks", title: "Clicks", column: clicks, aggregation: "sum", reason: "Traffic volume from campaigns." });
    if (impressions && clicks) pushCalculated(kpis, rows, { id: "ctr", title: "CTR", rawValue: (aggregate(rows, clicks, "sum") / Math.max(aggregate(rows, impressions, "sum"), 1)) * 100, column: clicks, aggregation: "calculated", format: "percent", reason: "Clicks divided by impressions." });
    if (clicks && conversions) pushCalculated(kpis, rows, { id: "conversion-rate", title: "Conversion Rate", rawValue: (aggregate(rows, conversions, "sum") / Math.max(aggregate(rows, clicks, "sum"), 1)) * 100, column: conversions, aggregation: "calculated", format: "percent", reason: "Conversions divided by clicks." });
  }

  if (!kpis.length) {
    pushCalculated(kpis, rows, { id: "total-rows", title: "Total Rows", aggregation: "count", rawValue: rows.length, reason: "Dataset volume." });
    if (profile.dataQualityScore !== undefined) pushCalculated(kpis, rows, { id: "quality-score", title: "Quality Score", rawValue: profile.dataQualityScore, aggregation: "calculated", format: "percent", reason: "Profiler completeness and duplicate quality score." });
    if (primaryMetric) {
      pushCalculated(kpis, rows, { id: `avg-${normalize(primaryMetric.name)}`, title: `Average ${humanize(primaryMetric.name)}`, column: primaryMetric, aggregation: "avg", format: primaryMetric.role === "money_metric" ? MONEY : "number", reason: "Primary metric average." });
      pushCalculated(kpis, rows, { id: `max-${normalize(primaryMetric.name)}`, title: `Max ${humanize(primaryMetric.name)}`, column: primaryMetric, aggregation: "max", format: primaryMetric.role === "money_metric" ? MONEY : "number", reason: "Primary metric maximum." });
      pushCalculated(kpis, rows, { id: `median-${normalize(primaryMetric.name)}`, title: `Median ${humanize(primaryMetric.name)}`, column: primaryMetric, aggregation: "median", format: primaryMetric.role === "money_metric" ? MONEY : "number", reason: "Primary metric median." });
    }
  }

  const seen = new Set();
  return kpis.filter((kpi) => {
    const key = `${kpi.title}-${kpi.metric}`;
    if (!kpi.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, maxKpis);
}
