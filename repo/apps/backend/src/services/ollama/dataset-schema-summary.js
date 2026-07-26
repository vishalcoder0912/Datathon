export function safeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const cleaned = String(value ?? '')
    .replace(/[,$%\s]/g, '')
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isDateLike(value) {
  if (value instanceof Date) return true;
  if (typeof value !== 'string') return false;
  if (!/\d/.test(value)) return false;

  return Number.isFinite(Date.parse(value));
}

function inferType(values = []) {
  const sample = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .slice(0, 100);

  if (!sample.length) return 'string';

  const numeric = sample.filter((value) => safeNumber(value) !== null).length;
  const date = sample.filter(isDateLike).length;

  if (numeric / sample.length >= 0.8) return 'number';
  if (date / sample.length >= 0.8) return 'date';

  return 'string';
}

function numericStats(values = []) {
  const numbers = values.map(safeNumber).filter((value) => value !== null);

  if (!numbers.length) return null;

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  const avg = sum / numbers.length;
  const mid = Math.floor(sorted.length / 2);

  const median =
    sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Number(avg.toFixed(2)),
    median: Number(median.toFixed(2)),
    validCount: numbers.length,
  };
}

function topValues(values = [], limit = 8) {
  const counts = new Map();

  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;

    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function cleanRows(rows = []) {
  return rows.filter((row) => {
    const keys = Object.keys(row || {}).map(normalizeName);
    const source = String(row?._sourceFile || row?.source || '').toLowerCase();

    const dictionaryRow =
      keys.includes('column') &&
      keys.includes('type') &&
      keys.includes('description');

    return !source.includes('dictionary') && !dictionaryRow;
  });
}

export function buildSchemaSummary(dataset = {}) {
  const rows = cleanRows(dataset.rows || []);

  const columnNames =
    Array.isArray(dataset.columns) && dataset.columns.length
      ? dataset.columns.map((column) => column.name || column)
      : Object.keys(rows[0] || {});

  const columns = columnNames
    .filter(Boolean)
    .filter((name) => !String(name).startsWith('__'))
    .map((name) => {
      const values = rows.map((row) => row[name]);
      const type = inferType(values);
      const present = values.filter(
        (value) => value !== null && value !== undefined && value !== '',
      );

      const role =
        type === 'number'
          ? 'metric'
          : type === 'date'
            ? 'date'
            : 'dimension';

      return {
        name,
        normalizedName: normalizeName(name),
        type,
        role,
        nullCount: rows.length - present.length,
        uniqueCount: new Set(present.map(String)).size,
        stats: type === 'number' ? numericStats(values) : null,
        topValues: role === 'dimension' ? topValues(values) : [],
      };
    });

  return {
    datasetName: dataset.name || dataset.fileName || 'Uploaded Dataset',
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    schemaOnly: true,
    rawRowsIncluded: false,
  };
}

export function findColumn(schema, aliases = [], role = null) {
  const normalizedAliases = aliases.map(normalizeName).filter(Boolean);

  const scored = schema.columns
    .map((column) => {
      let score = 0;

      for (const alias of normalizedAliases) {
        if (column.normalizedName === alias) score += 10;
        else if (column.normalizedName.includes(alias)) score += 6;
        else if (alias.includes(column.normalizedName)) score += 3;
      }

      if (role && column.role === role) score += 2;

      return { column, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]) return scored[0].column;

  if (role) {
    return schema.columns.find((column) => column.role === role) || null;
  }

  return null;
}

export function buildDatasetFacts(dataset = {}) {
  const schema = buildSchemaSummary(dataset);

  return {
    schema,
    rowCount: schema.rowCount,
    columnCount: schema.columnCount,
    facts: {
      rowCount: schema.rowCount,
      columnCount: schema.columnCount,
      numericColumns: schema.columns
        .filter((column) => column.role === 'metric')
        .map((column) => ({
          name: column.name,
          stats: column.stats,
        })),
      categoricalColumns: schema.columns
        .filter((column) => column.role === 'dimension')
        .map((column) => ({
          name: column.name,
          uniqueCount: column.uniqueCount,
          topValues: column.topValues,
        }))
        .slice(0, 8),
    },
  };
}
