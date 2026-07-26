import { safeNumber } from "../ai-analyst/schema-fingerprint.js";

function matchesFilter(row, filter) {
  const actual = String(row[filter.column] ?? "").trim().toLowerCase();
  const expected = String(filter.value ?? "").trim().toLowerCase();
  const operator = String(filter.operator || "equals").toLowerCase();
  if (operator === "contains") return actual.includes(expected);
  if (operator === "not_equals") return actual !== expected;
  return actual === expected;
}

function filteredRows(dataset, filters = []) {
  if (!Array.isArray(dataset.rows)) return [];
  if (!filters.length) return dataset.rows;
  return dataset.rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

function aggregate(values, aggregation) {
  const nums = values.map(safeNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (aggregation === "count") return values.length;
  if (!nums.length) return null;
  if (aggregation === "sum") return nums.reduce((total, value) => total + value, 0);
  if (aggregation === "min") return nums[0];
  if (aggregation === "max") return nums[nums.length - 1];
  if (aggregation === "median") {
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }
  return nums.reduce((total, value) => total + value, 0) / nums.length;
}

function round(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(2)) : value;
}

function histogram(rows, metric, bins = 12) {
  const values = rows.map((row) => safeNumber(row[metric])).filter((value) => value !== null);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, index) => {
    const start = min + index * width;
    const end = index === bins - 1 ? max : start + width;
    return { label: `${Math.round(start)}-${Math.round(end)}`, value: 0, records: 0 };
  });
  for (const value of values) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor((value - min) / width)));
    buckets[index].value += 1;
    buckets[index].records += 1;
  }
  return buckets.filter((bucket) => bucket.records > 0);
}

export async function executeAnalyticsQuery({ dataset, plan } = {}) {
  const start = Date.now();
  const rows = filteredRows(dataset, plan.filters || []);
  const limit = Math.min(100, Math.max(1, Number(plan.limit || 20)));
  let resultRows = [];
  let columns = [];

  if (plan.intent === "distribution") {
    resultRows = histogram(rows, plan.metric, Math.min(30, limit));
    columns = ["label", "value", "records"];
  } else if (plan.dimension) {
    const groups = new Map();
    for (const row of rows) {
      const label = String(row[plan.dimension] ?? "Unknown") || "Unknown";
      if (!groups.has(label)) groups.set(label, { label, values: [], records: 0 });
      const group = groups.get(label);
      group.records += 1;
      group.values.push(plan.metric === "__row_count__" ? 1 : row[plan.metric]);
    }
    resultRows = [...groups.values()]
      .map((group) => ({
        label: group.label,
        value: round(aggregate(group.values, plan.aggregation)),
        records: group.records,
      }))
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, limit);
    columns = ["label", "value", "records"];
  } else {
    const values = plan.metric === "__row_count__" ? rows.map(() => 1) : rows.map((row) => row[plan.metric]);
    resultRows = [{ value: round(aggregate(values, plan.aggregation)), records: rows.length }];
    columns = ["value", "records"];
  }

  return {
    columns,
    rows: resultRows,
    rowCount: resultRows.length,
    executionMs: Date.now() - start,
    rowsScanned: rows.length,
  };
}
