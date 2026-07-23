import { INTENTS } from "./excel-analyst-brain.js";

export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/[₹$€£,%\s,]/g, "");
  const num = Number(cleaned);

  return Number.isFinite(num) ? num : null;
}

export function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;

  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregate(values = [], type = "sum") {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  const nums = values.map(safeNumber).filter((value) => value !== null);

  if (type === "count") return present.length;
  if (type === "count_unique") return new Set(present.map((value) => String(value).trim())).size;
  if (!nums.length) return 0;

  if (type === "sum") return nums.reduce((total, value) => total + value, 0);
  if (type === "avg") return nums.reduce((total, value) => total + value, 0) / nums.length;
  if (type === "median") return median(nums);
  if (type === "min") return Math.min(...nums);
  if (type === "max") return Math.max(...nums);
  if (type === "percentage") return nums.length ? (nums.filter((value) => value > 0).length / nums.length) * 100 : 0;

  return nums.reduce((total, value) => total + value, 0);
}

export function groupBy(rows = [], dimension, metric, aggregation = "sum") {
  if (!dimension) return [];

  const map = new Map();

  for (const row of rows) {
    const key = String(row?.[dimension] ?? "Unknown").trim() || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(metric ? row?.[metric] : 1);
  }

  return [...map.entries()]
    .map(([name, values]) => ({
      name,
      value: metric ? aggregate(values, aggregation) : values.length,
      count: values.length,
    }))
    .sort((left, right) => right.value - left.value);
}

export function pivot(rows = [], dimension, metric, aggregation = "sum") {
  return groupBy(rows, dimension, metric, aggregation);
}

export function topN(rows = [], dimension, metric, aggregation = "sum", limit = 10) {
  return groupBy(rows, dimension, metric, aggregation).slice(0, limit);
}

export function bottomN(rows = [], dimension, metric, aggregation = "sum", limit = 10) {
  return groupBy(rows, dimension, metric, aggregation)
    .sort((left, right) => left.value - right.value)
    .slice(0, limit);
}

export function distribution(rows = [], metric, binCount = 10) {
  const nums = rows.map((row) => safeNumber(row?.[metric])).filter((value) => value !== null);
  if (!nums.length) return [];

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const bins = Math.max(2, Math.min(50, Number(binCount) || 10));
  const step = (max - min) / bins || 1;

  const result = Array.from({ length: bins }, (_, index) => ({
    range: `${Math.round(min + index * step)} - ${Math.round(min + (index + 1) * step)}`,
    count: 0,
  }));

  for (const value of nums) {
    const index = Math.min(Math.floor((value - min) / step), bins - 1);
    result[index].count += 1;
  }

  return result;
}

export function correlation(rows = [], xKey, yKey) {
  const pairs = rows
    .map((row) => [safeNumber(row?.[xKey]), safeNumber(row?.[yKey])])
    .filter(([x, y]) => x !== null && y !== null);

  if (pairs.length < 2) return 0;

  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const meanX = aggregate(xs, "avg");
  const meanY = aggregate(ys, "avg");

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (const [x, y] of pairs) {
    numerator += (x - meanX) * (y - meanY);
    denomX += (x - meanX) ** 2;
    denomY += (y - meanY) ** 2;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator ? numerator / denominator : 0;
}

export function outliers(rows = [], metric, options = {}) {
  const threshold = Number(options.zScoreThreshold ?? 2.5);
  const nums = rows
    .map((row, index) => ({ index, row, value: safeNumber(row?.[metric]) }))
    .filter((item) => item.value !== null);

  if (nums.length < 3) return [];

  const values = nums.map((item) => item.value);
  const mean = aggregate(values, "avg");
  const variance = aggregate(values.map((value) => (value - mean) ** 2), "avg");
  const std = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  return nums
    .map((item) => ({
      rowIndex: item.index,
      value: item.value,
      zScore: std ? (item.value - mean) / std : 0,
      method: "z-score+iqr",
      row: item.row,
    }))
    .filter((item) => Math.abs(item.zScore) >= threshold || item.value < lowerFence || item.value > upperFence)
    .sort((left, right) => Math.abs(right.zScore) - Math.abs(left.zScore));
}

export function missingValues(rows = [], profile = {}) {
  return (profile.columns || []).map((column) => {
    const name = column.name;
    const missingCount = rows.filter((row) => row?.[name] === null || row?.[name] === undefined || row?.[name] === "").length;
    return {
      column: name,
      missingCount,
      missingPct: rows.length ? Math.round((missingCount / rows.length) * 10000) / 100 : 0,
    };
  });
}

export function duplicateRows(rows = []) {
  const duplicateMap = new Map();

  for (const row of rows) {
    const key = JSON.stringify(row);
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  }

  return [...duplicateMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({
      row: JSON.parse(key),
      count,
      extraCopies: count - 1,
    }));
}

export function dataQuality(rows = [], profile = {}) {
  const missing = missingValues(rows, profile);
  const duplicates = duplicateRows(rows);
  const duplicateCount = duplicates.reduce((sum, item) => sum + item.extraCopies, 0);
  const avgMissingPct = missing.reduce((sum, item) => sum + item.missingPct, 0) / Math.max(missing.length, 1);

  return {
    rowCount: rows.length,
    columnCount: profile.columns?.length || 0,
    missing,
    duplicateRows: duplicateCount,
    duplicates,
    qualityScore: Math.max(0, Math.round((100 - avgMissingPct - duplicateCount) * 100) / 100),
  };
}

export function timeTrend(rows = [], dateColumn, metric, aggregation = "sum") {
  if (!dateColumn) return [];

  const groups = new Map();

  for (const row of rows) {
    const raw = row?.[dateColumn];
    const date = raw ? new Date(raw) : null;
    const key =
      date && !Number.isNaN(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : String(raw || "Unknown");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(metric ? row?.[metric] : 1);
  }

  return [...groups.entries()]
    .map(([period, values]) => ({
      period,
      value: metric ? aggregate(values, aggregation) : values.length,
      count: values.length,
    }))
    .sort((left, right) => String(left.period).localeCompare(String(right.period)));
}

export function executeExcelAnalysis({ rows = [], plan } = {}) {
  const p = plan?.executionPlan || plan || {};
  const { intent, metric, dimension, dateColumn, aggregation = "sum", limit = 10 } = p;

  if (!Array.isArray(rows) || !rows.length) {
    return {
      ok: false,
      warning: "Dataset has no rows.",
      result: null,
    };
  }

  switch (intent) {
    case INTENTS.TOP_N:
      return { ok: true, type: intent, result: topN(rows, dimension, metric, aggregation, limit) };

    case INTENTS.BOTTOM_N:
      return { ok: true, type: intent, result: bottomN(rows, dimension, metric, aggregation, limit) };

    case INTENTS.PIVOT:
    case INTENTS.SEGMENT_COMPARISON:
      return { ok: true, type: intent, result: pivot(rows, dimension, metric, aggregation) };

    case INTENTS.TREND:
      return { ok: true, type: intent, result: timeTrend(rows, dateColumn, metric, aggregation) };

    case INTENTS.DISTRIBUTION:
      return { ok: true, type: intent, result: distribution(rows, metric) };

    case INTENTS.CORRELATION:
      return { ok: true, type: intent, result: correlation(rows, dimension, metric) };

    case INTENTS.OUTLIERS:
      return { ok: true, type: intent, result: outliers(rows, metric) };

    case INTENTS.DATA_QUALITY:
    case INTENTS.CLEANING:
      return { ok: true, type: intent, result: dataQuality(rows, plan?.profile || {}) };

    case INTENTS.FORECAST_READY:
      return {
        ok: true,
        type: intent,
        result: {
          ready: Boolean(dateColumn && metric && timeTrend(rows, dateColumn, metric, aggregation).length >= 3),
          dateColumn,
          metric,
          periods: dateColumn && metric ? timeTrend(rows, dateColumn, metric, aggregation).length : 0,
        },
      };

    case INTENTS.SUMMARY:
    case INTENTS.ASK_EXPLANATION:
    default:
      return {
        ok: true,
        type: intent || INTENTS.SUMMARY,
        result: {
          rowCount: rows.length,
          metric,
          total: metric ? aggregate(rows.map((row) => row?.[metric]), "sum") : rows.length,
          average: metric ? aggregate(rows.map((row) => row?.[metric]), "avg") : null,
          median: metric ? aggregate(rows.map((row) => row?.[metric]), "median") : null,
          maximum: metric ? aggregate(rows.map((row) => row?.[metric]), "max") : null,
          minimum: metric ? aggregate(rows.map((row) => row?.[metric]), "min") : null,
        },
      };
  }
}
