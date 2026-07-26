import { buildSchemaProfile, isDateLike, isMissing, normalizeColumnName, safeNumber } from "./schema-fingerprint.js";

const DEFAULT_SAMPLE_SIZE = 5000;

function takeReservoirSample(rows = [], sampleSize = DEFAULT_SAMPLE_SIZE) {
  const limit = Math.max(1, Number(sampleSize || DEFAULT_SAMPLE_SIZE));
  const sample = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (sample.length < limit) {
      sample.push(row);
      continue;
    }

    const replacement = Math.floor(Math.random() * (index + 1));
    if (replacement < limit) sample[replacement] = row;
  }

  return sample;
}

function findStrataColumns(profile) {
  const date = profile.columns.find((column) => column.role === "date" || column.type === "date");
  const category = profile.columns.find((column) =>
    ["category", "location", "target", "numeric_category"].includes(column.role) &&
    Number(column.uniqueCount || 0) > 1 &&
    Number(column.uniqueCount || 0) <= 30
  );
  return { date, category };
}

function dateBucket(value) {
  const parsed = isDateLike(value) ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "unknown_date";
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function takeStratifiedSample(rows = [], profile, sampleSize = DEFAULT_SAMPLE_SIZE) {
  const { date, category } = findStrataColumns(profile);
  if (!date && !category) return [];

  const buckets = new Map();
  for (const row of rows) {
    const parts = [];
    if (category) parts.push(String(row[category.name] ?? "Unknown").trim() || "Unknown");
    if (date) parts.push(dateBucket(row[date.name]));
    const key = parts.join("|") || "all";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  const perBucket = Math.max(1, Math.ceil(sampleSize / Math.max(1, buckets.size)));
  return [...buckets.values()].flatMap((bucketRows) => takeReservoirSample(bucketRows, perBucket)).slice(0, sampleSize);
}

function numericStats(values = []) {
  const numbers = values.map(safeNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (!numbers.length) return null;

  const sum = numbers.reduce((total, value) => total + value, 0);
  const mid = Math.floor(numbers.length / 2);
  const median = numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
  return {
    min: numbers[0],
    max: numbers[numbers.length - 1],
    mean: sum / numbers.length,
    median,
    count: numbers.length,
  };
}

function topValues(values = [], limit = 10) {
  const counts = new Map();
  for (const value of values) {
    if (isMissing(value)) continue;
    const label = String(value).trim();
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function dateRange(values = []) {
  const dates = values
    .filter(isDateLike)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!dates.length) return null;
  return {
    min: new Date(dates[0]).toISOString(),
    max: new Date(dates[dates.length - 1]).toISOString(),
  };
}

function duplicateEstimate(sampleRows = []) {
  if (!sampleRows.length) return { duplicateRows: 0, duplicatePct: 0 };
  const seen = new Set();
  let duplicates = 0;

  for (const row of sampleRows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }

  return {
    duplicateRows: duplicates,
    duplicatePct: (duplicates / sampleRows.length) * 100,
  };
}

function mergeSamples(primary = [], secondary = [], maxRows = DEFAULT_SAMPLE_SIZE) {
  const seen = new Set();
  const merged = [];
  for (const row of [...secondary, ...primary]) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= maxRows) break;
  }
  return merged;
}

export function profileLargeDataset(dataset = {}, options = {}) {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const sampleSize = Math.min(Number(options.sampleSize || DEFAULT_SAMPLE_SIZE), Math.max(rows.length, 1));
  const reservoirSample = rows.length > sampleSize ? takeReservoirSample(rows, sampleSize) : rows.slice();
  const sampleProfile = buildSchemaProfile({ ...dataset, rows: reservoirSample });
  const stratifiedSample = rows.length > sampleSize ? takeStratifiedSample(rows, sampleProfile, Math.ceil(sampleSize / 2)) : [];
  const sampleRows = mergeSamples(reservoirSample, stratifiedSample, sampleSize);
  const profile = buildSchemaProfile({ ...dataset, rows: sampleRows });
  const duplicate = duplicateEstimate(sampleRows);

  const columns = profile.columns.map((column) => {
    const values = sampleRows.map((row) => row[column.name]);
    const present = values.filter((value) => !isMissing(value));
    const uniqueCount = new Set(present.map((value) => String(value).trim())).size;
    const metricLike = column.type === "number" || /metric/.test(column.role || "");
    const highCardinalityNoise =
      !metricLike &&
      ["text", "category", "location", "target"].includes(column.role) &&
      uniqueCount / Math.max(present.length, 1) > 0.92;

    return {
      ...column,
      cardinality: uniqueCount,
      cardinalityRatio: present.length ? uniqueCount / present.length : 0,
      missingPct: sampleRows.length ? ((values.length - present.length) / sampleRows.length) * 100 : 0,
      duplicateEstimate: duplicate.duplicatePct,
      numericStats: column.type === "number" ? numericStats(values) : null,
      categoryTopValues: ["category", "location", "target", "numeric_category", "text"].includes(column.role) ? topValues(values) : [],
      dateRange: column.role === "date" || column.type === "date" ? dateRange(values) : null,
      noisy: column.role === "id" || highCardinalityNoise || normalizeColumnName(column.name).startsWith("unnamed"),
    };
  });

  const missingAverage = columns.length
    ? columns.reduce((total, column) => total + Number(column.missingPct || 0), 0) / columns.length
    : 0;
  const noisyPenalty = columns.length
    ? (columns.filter((column) => column.noisy).length / columns.length) * 15
    : 0;
  const dataQualityScore = Math.max(0, Math.min(100, 100 - missingAverage * 0.7 - duplicate.duplicatePct * 0.5 - noisyPenalty));

  return {
    ...profile,
    rowCount: rows.length,
    sampledRowCount: sampleRows.length,
    sampling: {
      strategy: rows.length > sampleSize ? "reservoir+stratified" : "full",
      reservoirRows: reservoirSample.length,
      stratifiedRows: stratifiedSample.length,
      sampleSize: sampleRows.length,
      safeForMillionRows: true,
    },
    columns,
    duplicateEstimate: duplicate,
    dataQualityScore,
    warnings: [
      rows.length > sampleRows.length ? `Profiled ${sampleRows.length.toLocaleString()} sampled rows from ${rows.length.toLocaleString()} total rows.` : null,
      dataQualityScore < 70 ? "Data quality is weak; missing values, duplicate rows, or noisy columns may affect analysis." : null,
    ].filter(Boolean),
  };
}
