import { humanize, isDateLike, normalizeColumnName, safeNumber } from "./schema-fingerprint.js";

function byName(profile, name) {
  const wanted = normalizeColumnName(name || "");
  return (profile.columns || []).find((column) => column.name === name || column.normalizedName === wanted);
}

function isMetric(column) {
  return column && (column.type === "number" || /metric/.test(column.role || ""));
}

function isId(column) {
  return column && (column.role === "id" || /(^id$|_id$|uuid|identifier|key)$/i.test(column.name || ""));
}

function aggregate(values = [], aggregation = "count") {
  const present = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (aggregation === "count") return present.length;
  const numbers = present.map(safeNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (!numbers.length) return null;
  if (aggregation === "sum") return numbers.reduce((total, value) => total + value, 0);
  if (aggregation === "avg") return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  if (aggregation === "min") return numbers[0];
  if (aggregation === "max") return numbers[numbers.length - 1];
  if (aggregation === "median") {
    const mid = Math.floor(numbers.length / 2);
    return numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
  }
  return null;
}

function groupBy(rows, xKey, yKey, aggregation, limit = 10) {
  const groups = new Map();
  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(yKey ? row[yKey] : label);
  }
  return [...groups.entries()]
    .map(([label, values]) => ({ [xKey]: label, [aggregation === "count" ? "count" : yKey]: aggregate(values, aggregation) }))
    .filter((row) => Object.values(row).at(-1) !== null)
    .sort((a, b) => Number(Object.values(b).at(-1)) - Number(Object.values(a).at(-1)))
    .slice(0, limit);
}

function trend(rows, dateKey, metricKey, aggregation = "sum", limit = 24) {
  const groups = new Map();
  for (const row of rows) {
    if (!isDateLike(row[dateKey])) continue;
    const date = new Date(row[dateKey]);
    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row[metricKey]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-limit)
    .map(([label, values]) => ({ [dateKey]: label, [metricKey]: aggregate(values, aggregation) }))
    .filter((row) => row[metricKey] !== null);
}

function histogram(rows, key, bins = 10) {
  const values = rows.map((row) => safeNumber(row[key])).filter((value) => value !== null);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ range: String(min), count: values.length }];
  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, index) => ({ start: min + index * step, end: index === bins - 1 ? max : min + (index + 1) * step, count: 0 }));
  for (const value of values) buckets[Math.min(Math.floor((value - min) / step), bins - 1)].count += 1;
  return buckets.filter((bucket) => bucket.count).map((bucket) => ({ range: `${Math.round(bucket.start)}-${Math.round(bucket.end)}`, count: bucket.count }));
}

function scatter(rows, xKey, yKey, limit = 500) {
  return rows.map((row) => ({ [xKey]: safeNumber(row[xKey]), [yKey]: safeNumber(row[yKey]) }))
    .filter((row) => row[xKey] !== null && row[yKey] !== null)
    .slice(0, limit);
}

function chartSpec({ id, section, type, title, xKey, yKey = "count", aggregation = "count", limit = 10, reason }) {
  return { id, section, type, title, xKey, yKey, aggregation, limit, reason };
}

function calculateChart(rows, chart) {
  if (chart.type === "line") return { ...chart, data: trend(rows, chart.xKey, chart.yKey, chart.aggregation, chart.limit) };
  if (chart.type === "histogram") return { ...chart, xKey: "range", yKey: "count", data: histogram(rows, chart.xKey, chart.limit || 10) };
  if (chart.type === "scatter") return { ...chart, data: scatter(rows, chart.xKey, chart.yKey, chart.limit || 500) };
  return { ...chart, data: groupBy(rows, chart.xKey, chart.yKey === "count" ? null : chart.yKey, chart.aggregation, chart.limit || 10) };
}

export function buildSeniorDashboardPlan({ profile = {}, seniorAnalysisPlan = {}, maxCharts = 10 } = {}) {
  const ranked = seniorAnalysisPlan.rankedColumns || {};
  const metric = byName(profile, ranked.primaryMetric) ||
    (profile.columns || []).find((column) => isMetric(column) && !isId(column));
  const metric2 = (ranked.secondaryMetrics || []).map((name) => byName(profile, name)).find((column) => isMetric(column) && column.name !== metric?.name);
  const dimension = (ranked.dimensions || []).map((name) => byName(profile, name)).find((column) => column && !isId(column));
  const dimension2 = (ranked.dimensions || []).map((name) => byName(profile, name)).find((column) => column && !isId(column) && column.name !== dimension?.name);
  const date = (ranked.dateColumns || []).map((name) => byName(profile, name)).find(Boolean);
  const location = (ranked.locationColumns || []).map((name) => byName(profile, name)).find((column) => column && !isId(column));
  const charts = [];

  if (date && metric) charts.push(chartSpec({ id: "trend-primary", section: "Trend", type: "line", title: `${humanize(metric.name)} Trend`, xKey: date.name, yKey: metric.name, aggregation: metric.role === "money_metric" ? "sum" : "avg", limit: 24, reason: "Date plus metric requires a trend chart." }));
  if (dimension && metric) charts.push(chartSpec({ id: "segment-primary", section: "Segment comparison", type: "bar", title: `${humanize(metric.name)} by ${humanize(dimension.name)}`, xKey: dimension.name, yKey: metric.name, aggregation: metric.role === "money_metric" ? "sum" : "avg", limit: 10, reason: "Category plus metric uses a bar chart for comparison." }));
  if (dimension2 && metric) charts.push(chartSpec({ id: "ranking-secondary", section: "Ranking", type: "bar", title: `Top ${humanize(dimension2.name)} by ${humanize(metric.name)}`, xKey: dimension2.name, yKey: metric.name, aggregation: metric.role === "money_metric" ? "sum" : "avg", limit: 10, reason: "Ranking section shows top contributors." }));
  if (dimension && Number(dimension.uniqueCount || 0) <= 8) charts.push(chartSpec({ id: "share-primary", section: "Segment comparison", type: "donut", title: `${humanize(dimension.name)} Share`, xKey: dimension.name, yKey: "count", aggregation: "count", limit: 8, reason: "Pie/donut only used for low-cardinality category share." }));
  if (metric) charts.push(chartSpec({ id: "distribution-primary", section: "Distribution", type: "histogram", title: `${humanize(metric.name)} Distribution`, xKey: metric.name, yKey: "count", aggregation: "count", limit: 12, reason: "Numeric metric distribution uses a histogram." }));
  if (metric && metric2) charts.push(chartSpec({ id: "scatter-primary", section: "Distribution", type: "scatter", title: `${humanize(metric.name)} vs ${humanize(metric2.name)}`, xKey: metric2.name, yKey: metric.name, aggregation: "count", limit: 500, reason: "Two numeric columns use scatter." }));
  if (location && metric) charts.push(chartSpec({ id: "geo-primary", section: "Geo", type: "bar", title: `${humanize(metric.name)} by ${humanize(location.name)}`, xKey: location.name, yKey: metric.name, aggregation: metric.role === "money_metric" ? "sum" : "avg", limit: 12, reason: "Location plus metric enables geographic comparison." }));

  charts.push(chartSpec({ id: "data-quality-missing", section: "Data quality", type: "bar", title: "Missing Values by Column", xKey: "column", yKey: "missingPct", aggregation: "avg", limit: 10, reason: "Data quality section surfaces weakest columns." }));

  const seen = new Set();
  return {
    source: "senior-dashboard-planner",
    domain: seniorAnalysisPlan.domain || profile.domain,
    layout: ["Executive KPI row", "Trend section", "Segment comparison", "Ranking section", "Distribution section", ...(location ? ["Geo section"] : []), "Data quality section"],
    kpis: [],
    charts: charts.filter((chart) => {
      const x = chart.xKey === "column" ? null : byName(profile, chart.xKey);
      const y = chart.yKey === "count" || chart.yKey === "missingPct" ? null : byName(profile, chart.yKey);
      const key = `${chart.type}-${chart.xKey}-${chart.yKey}-${chart.aggregation}`;
      if (seen.has(key)) return false;
      if (x && isId(x)) return false;
      if (y && isId(y)) return false;
      if (["pie", "donut"].includes(chart.type) && x && Number(x.uniqueCount || 0) > 8) return false;
      seen.add(key);
      return true;
    }).slice(0, maxCharts),
  };
}

export function calculateSeniorCharts({ dataset = {}, profile = {}, charts = [] } = {}) {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  return charts.map((chart) => {
    if (chart.id === "data-quality-missing") {
      return {
        ...chart,
        data: (profile.columns || [])
          .map((column) => ({ column: column.name, missingPct: Number(column.missingPct || 0) }))
          .sort((a, b) => b.missingPct - a.missingPct)
          .slice(0, chart.limit || 10),
      };
    }
    return calculateChart(rows, chart);
  }).filter((chart) => Array.isArray(chart.data) && chart.data.length);
}

