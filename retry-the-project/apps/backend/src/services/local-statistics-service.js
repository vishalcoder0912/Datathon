import { cleanRows, safeNumber } from './ollama/dataset-schema-summary.js';

export function aggregate(values = [], aggregation = 'count') {
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== '',
  );

  if (aggregation === 'count') return present.length;

  const numbers = present.map(safeNumber).filter((value) => value !== null);

  if (!numbers.length) return 0;

  if (aggregation === 'sum') return numbers.reduce((a, b) => a + b, 0);
  if (aggregation === 'avg') return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (aggregation === 'min') return Math.min(...numbers);
  if (aggregation === 'max') return Math.max(...numbers);

  if (aggregation === 'median') {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return present.length;
}

export function getCountByCategory(rows, xKey, limit = 10) {
  const groups = new Map();
  for (const row of rows) {
    const label = String(row[xKey] ?? 'Unknown').trim() || 'Unknown';
    groups.set(label, (groups.get(label) || 0) + 1);
  }
  return [...groups.entries()]
    .map(([label, count]) => ({ [xKey]: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getRatioByCategory(rows, xKey, limit = 10) {
  const counts = getCountByCategory(rows, xKey, limit);
  const total = rows.length || 1;
  return counts.map(item => ({
    ...item,
    ratio: Number((item.count / total).toFixed(4)),
    percentage: `${( (item.count / total) * 100 ).toFixed(2)}%`
  }));
}

export function getMetricByCategory(rows, xKey, yKey, aggregation = 'avg', limit = 10) {
  const groups = new Map();
  for (const row of rows) {
    const label = String(row[xKey] ?? 'Unknown').trim() || 'Unknown';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row[yKey]);
  }
  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [yKey]: aggregate(values, aggregation)
    }))
    .sort((a, b) => Number(b[yKey]) - Number(a[yKey]))
    .slice(0, limit);
}

export function getDistribution(rows, key, bins = 8) {
  const values = rows.map((row) => safeNumber(row[key])).filter((value) => value !== null);
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return [{ range: String(min), count: values.length }];

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
    range: `${Math.round(bucket.start).toLocaleString()}-${Math.round(bucket.end).toLocaleString()}`,
    count: bucket.count,
  }));
}

export function getScatterData(rows, xKey, yKey, limit = 100) {
  const points = rows
    .map(row => ({
      x: safeNumber(row[xKey]),
      y: safeNumber(row[yKey])
    }))
    .filter(p => p.x !== null && p.y !== null);

  // Simple sampling if there are too many points
  if (points.length <= limit) return points;
  const step = points.length / limit;
  const sampled = [];
  for (let i = 0; i < limit; i++) {
    sampled.push(points[Math.floor(i * step)]);
  }
  return sampled;
}

export function getMinMaxMedian(rows, key) {
  const values = rows.map(row => safeNumber(row[key])).filter(v => v !== null);
  if (!values.length) return null;
  return {
    min: aggregate(values, 'min'),
    max: aggregate(values, 'max'),
    avg: Number(aggregate(values, 'avg').toFixed(2)),
    median: aggregate(values, 'median'),
    count: values.length
  };
}

export function retrieveStatsContext(dataset, schema, { dimension, metric, metric2 }) {
  const rows = cleanRows(dataset.rows || []);
  const stats = {};

  if (dimension) {
    stats.count_by_category = getCountByCategory(rows, dimension);
    stats.ratio_by_category = getRatioByCategory(rows, dimension);
  }

  if (dimension && metric) {
    stats.avg_metric_by_category = getMetricByCategory(rows, dimension, metric, 'avg');
    stats.sum_metric_by_category = getMetricByCategory(rows, dimension, metric, 'sum');
    stats.top_n_by_metric = getMetricByCategory(rows, dimension, metric, 'sum', 5);
  }

  if (metric) {
    stats.distribution_metric = getDistribution(rows, metric);
    stats.min_max_median_metric = getMinMaxMedian(rows, metric);
  }

  if (metric && metric2) {
    stats.scatter_metric_pair = getScatterData(rows, metric, metric2);
  }

  return stats;
}
