import { randomUUID } from "node:crypto";
import { cleanDatasetRows, safeNumber } from "./schemaProfiler.js";

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function aggregate(values = [], aggregation = "count") {
  const present = values.filter((value) => !isMissing(value));

  if (aggregation === "count") return present.length;

  if (aggregation === "count_unique") {
    return new Set(present.map((value) => String(value))).size;
  }

  const numbers = present
    .map(safeNumber)
    .filter((value) => value !== null);

  if (!numbers.length) return 0;

  if (aggregation === "sum") {
    return numbers.reduce((total, value) => total + value, 0);
  }

  if (aggregation === "avg") {
    return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  }

  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function applyFilters(rows = [], filters = {}) {
  return rows.filter((row) => {
    for (const [key, value] of Object.entries(filters || {})) {
      if (!value) continue;

      if (typeof value === "object" && (value.start || value.end)) {
        const rowTime = Date.parse(row[key]);
        if (!Number.isFinite(rowTime)) return false;

        if (value.start && rowTime < Date.parse(value.start)) return false;
        if (value.end && rowTime > Date.parse(value.end)) return false;

        continue;
      }

      if (String(row[key] ?? "").toLowerCase() !== String(value).toLowerCase()) {
        return false;
      }
    }

    return true;
  });
}

export function groupByAggregate({
  rows,
  xKey,
  yKey,
  aggregation = "count",
  limit = 10,
}) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(aggregation === "count" ? label : row[yKey]);
  }

  const valueKey = aggregation === "count" ? "count" : yKey;

  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [valueKey]: round(aggregate(values, aggregation)),
    }))
    .sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]))
    .slice(0, limit);
}

export function buildHistogram({ rows, key, bins = 8 }) {
  const values = rows
    .map((row) => safeNumber(row[key]))
    .filter((value) => value !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: String(min), count: values.length }];
  }

  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, index) => ({
    start: min + index * step,
    end: index === bins - 1 ? max : min + (index + 1) * step,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), bins - 1);
    buckets[index].count += 1;
  }

  return buckets.map((bucket) => ({
    range: `${Math.round(bucket.start)}-${Math.round(bucket.end)}`,
    count: bucket.count,
  }));
}

export function buildScatter({ rows, xKey, yKey, limit = 250 }) {
  return rows
    .map((row) => ({
      [xKey]: safeNumber(row[xKey]),
      [yKey]: safeNumber(row[yKey]),
    }))
    .filter((row) => row[xKey] !== null && row[yKey] !== null)
    .slice(0, limit);
}

export function buildTimeTrend({
  rows,
  xKey,
  yKey,
  aggregation = "sum",
  limit = 30,
}) {
  const groups = new Map();

  for (const row of rows) {
    const time = Date.parse(row[xKey]);
    if (!Number.isFinite(time)) continue;

    const label = new Date(time).toISOString().slice(0, 10);

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row[yKey]);
  }

  return [...groups.entries()]
    .map(([date, values]) => ({
      [xKey]: date,
      [yKey]: round(aggregate(values, aggregation)),
    }))
    .sort((a, b) => String(a[xKey]).localeCompare(String(b[xKey])))
    .slice(-limit);
}

export function buildKpiFromSpec(rows = [], kpiSpec = {}) {
  const aggregation = kpiSpec.aggregation || "count";

  let value;

  if (aggregation === "count" && !kpiSpec.metric) {
    value = rows.length;
  } else {
    value = aggregate(
      rows.map((row) => row[kpiSpec.metric]),
      aggregation
    );
  }

  return {
    id: kpiSpec.id || randomUUID(),
    title: kpiSpec.title || "KPI",
    value: formatNumber(round(value)),
    subtitle: aggregation,
    metric: kpiSpec.metric || null,
    aggregation,
    format: kpiSpec.format || "number",
  };
}

export function buildChartFromSpec(rows = [], chartSpec = {}) {
  const type = chartSpec.type || "bar";
  const xKey = chartSpec.xKey;
  const yKey = chartSpec.yKey;
  const aggregation = chartSpec.aggregation || "count";
  const limit = chartSpec.limit || 10;

  let data = [];

  if (type === "histogram") {
    data = buildHistogram({
      rows,
      key: yKey || xKey,
      bins: limit,
    });

    return {
      id: chartSpec.id || randomUUID(),
      type,
      title: chartSpec.title || `${xKey} Distribution`,
      xKey: "range",
      yKey: "count",
      aggregation: "count",
      data,
    };
  }

  if (type === "scatter" && xKey && yKey) {
    data = buildScatter({
      rows,
      xKey,
      yKey,
      limit,
    });

    return {
      id: chartSpec.id || randomUUID(),
      type,
      title: chartSpec.title || `${xKey} vs ${yKey}`,
      xKey,
      yKey,
      aggregation: "raw",
      data,
    };
  }

  if ((type === "line" || type === "area") && xKey && yKey) {
    data = buildTimeTrend({
      rows,
      xKey,
      yKey,
      aggregation,
      limit,
    });

    return {
      id: chartSpec.id || randomUUID(),
      type,
      title: chartSpec.title || `${yKey} Trend`,
      xKey,
      yKey,
      aggregation,
      data,
    };
  }

  data = groupByAggregate({
    rows,
    xKey,
    yKey: yKey || xKey,
    aggregation,
    limit,
  });

  return {
    id: chartSpec.id || randomUUID(),
    type,
    title: chartSpec.title || `${aggregation} by ${xKey}`,
    xKey,
    yKey: aggregation === "count" ? "count" : yKey,
    aggregation,
    data,
  };
}

export function buildDashboardFromPlan({
  rows = [],
  filters = {},
  dashboardPlan = {},
}) {
  const cleanRows = cleanDatasetRows(rows);
  const filteredRows = applyFilters(cleanRows, filters);

  const kpis = (dashboardPlan.kpis || [])
    .map((spec) => buildKpiFromSpec(filteredRows, spec))
    .filter(Boolean);

  const charts = (dashboardPlan.charts || [])
    .map((spec) => buildChartFromSpec(filteredRows, spec))
    .filter((chart) => chart && chart.data && chart.data.length);

  return {
    rows: filteredRows,
    kpis,
    charts,
    filters,
  };
}
