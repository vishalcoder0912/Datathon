import crypto from 'node:crypto';

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function inferType(values) {
  const sample = values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 200);

  if (!sample.length) return 'empty';

  const numericRatio = sample.filter((value) => Number.isFinite(Number(value))).length / sample.length;
  const dateRatio = sample.filter((value) => !Number.isNaN(Date.parse(String(value)))).length / sample.length;

  if (numericRatio >= 0.9 && dateRatio < 0.8) return 'numeric';
  if (dateRatio >= 0.8) return 'date';
  return 'categorical';
}

export function createDatasetFingerprint(records = [], metadata = {}) {
  const rows = Array.isArray(records) ? records : [];
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {})
        .filter((key) => !String(key).startsWith('__'))
        .forEach((key) => set.add(key));
      return set;
    }, new Set()),
  ).sort();

  const schema = columns.map((column) => ({
    name: column,
    type: inferType(rows.map((row) => row?.[column])),
  }));

  const source = {
    version: 1,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    schema,
    sample: rows.slice(0, 100).concat(rows.slice(Math.max(0, rows.length - 100))),
    metadata,
  };

  return crypto.createHash('sha256').update(stableStringify(source)).digest('hex');
}

export function createCacheKey(datasetId, operation, fingerprint, params = {}) {
  return crypto
    .createHash('sha256')
    .update(stableStringify({ datasetId, operation, fingerprint, params }))
    .digest('hex');
}
