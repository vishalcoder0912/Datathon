const NUMBER_KEYWORDS = [
  'salary', 'revenue', 'amount', 'price', 'cost', 'profit', 'sales',
  'income', 'score', 'rating', 'age', 'experience', 'count', 'quantity',
  'total', 'usd', 'inr'
];

const TARGET_KEYWORDS = [
  'salary', 'revenue', 'profit', 'sales', 'amount', 'price',
  'target', 'label', 'churn', 'risk', 'score'
];

const ID_KEYWORDS = ['id', 'uuid', 'email', 'phone', 'mobile'];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isEmpty(value) {
  return value === null || value === undefined || value === '' || Number.isNaN(value);
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[$,₹%]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isDateLike(value) {
  if (isEmpty(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && String(value).length >= 6;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function inferColumnRole(name, type, uniqueRatio) {
  const n = normalizeName(name);

  if (ID_KEYWORDS.some((k) => n === k || n.endsWith(`_${k}`) || n.includes(`${k}_`))) {
    return 'identifier';
  }

  if (type === 'number' && TARGET_KEYWORDS.some((k) => n.includes(k))) {
    return 'target';
  }

  if (type === 'number' && NUMBER_KEYWORDS.some((k) => n.includes(k))) {
    return 'measure';
  }

  if (type === 'number' && uniqueRatio > 0.9) {
    return 'measure';
  }

  if (type === 'date') return 'date';

  return 'dimension';
}

export function profileRows(rows, options = {}) {
  const datasetId = options.datasetId || null;
  const datasetName = options.datasetName || 'dataset';

  if (!Array.isArray(rows)) {
    throw new Error('profileRows expected rows to be an array of objects');
  }

  const rowCount = rows.length;
  const firstRow = rows[0] || {};
  const columnNames = Object.keys(firstRow);
  const sampleRows = rows.slice(0, Math.min(rowCount, options.sampleSize || 5000));

  const columns = columnNames.map((name) => {
    const values = sampleRows.map((row) => row[name]);
    const nonEmpty = values.filter((v) => !isEmpty(v));
    const missingCount = rows.reduce((acc, row) => acc + (isEmpty(row[name]) ? 1 : 0), 0);
    const uniqueValues = new Set(nonEmpty.map((v) => String(v)));
    const uniqueCount = uniqueValues.size;
    const uniqueRatio = rowCount ? uniqueCount / rowCount : 0;

    const numericValues = nonEmpty.map(toNumber).filter((v) => v !== null);
    const numericRatio = nonEmpty.length ? numericValues.length / nonEmpty.length : 0;
    const dateRatio = nonEmpty.length
      ? nonEmpty.filter(isDateLike).length / nonEmpty.length
      : 0;

    const multiValueCount = nonEmpty.filter(
      (v) => typeof v === 'string' && /[,;|]/.test(v)
    ).length;

    let detectedType = 'category';
    if (numericRatio >= 0.9) detectedType = 'number';
    else if (dateRatio >= 0.8) detectedType = 'date';

    const sorted = numericValues.slice().sort((a, b) => a - b);
    const numericSummary = detectedType === 'number'
      ? {
          min: sorted[0] ?? null,
          max: sorted[sorted.length - 1] ?? null,
          mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
          median: percentile(sorted, 0.5),
          p25: percentile(sorted, 0.25),
          p75: percentile(sorted, 0.75),
        }
      : null;

    const role = inferColumnRole(name, detectedType, uniqueRatio);

    return {
      name,
      normalizedName: normalizeName(name),
      detectedType,
      role,
      missingCount,
      missingRate: rowCount ? missingCount / rowCount : 0,
      uniqueCount,
      uniqueRatio,
      isMultiValue: multiValueCount / Math.max(nonEmpty.length, 1) > 0.2,
      numericSummary,
      examples: Array.from(uniqueValues).slice(0, 8),
    };
  });

  const missingValues = columns.reduce((acc, col) => acc + col.missingCount, 0);
  const totalCells = Math.max(rowCount * Math.max(columnNames.length, 1), 1);
  const duplicateRows = countDuplicateRows(rows);
  const completenessScore = 1 - missingValues / totalCells;
  const duplicatePenalty = rowCount ? duplicateRows / rowCount : 0;
  const qualityScore = Math.max(
    0,
    Math.round((completenessScore - duplicatePenalty * 0.25) * 100)
  );

  const measures = columns.filter((c) => c.role === 'measure' || c.role === 'target').map((c) => c.name);
  const targets = columns.filter((c) => c.role === 'target').map((c) => c.name);
  const dimensions = columns.filter((c) => c.role === 'dimension').map((c) => c.name);
  const dateColumns = columns.filter((c) => c.role === 'date').map((c) => c.name);
  const idColumns = columns.filter((c) => c.role === 'identifier').map((c) => c.name);
  const multiValueColumns = columns.filter((c) => c.isMultiValue).map((c) => c.name);

  return {
    datasetId,
    datasetName,
    generatedAt: new Date().toISOString(),
    rowCount,
    columnCount: columnNames.length,
    columns,
    measures,
    dimensions,
    targets,
    dateColumns,
    idColumns,
    multiValueColumns,
    quality: {
      missingValues,
      duplicateRows,
      qualityScore,
    },
  };
}

function countDuplicateRows(rows) {
  const seen = new Set();
  let duplicates = 0;

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }

  return duplicates;
}

export function schemaSignature(profile) {
  return profile.columns
    .map((c) => `${c.normalizedName}:${c.detectedType}:${c.role}`)
    .sort()
    .join('|');
}
