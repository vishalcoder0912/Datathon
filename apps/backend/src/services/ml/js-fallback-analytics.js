function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function numberOrNull(value) {
  if (isMissing(value)) return null;
  const parsed = Number(String(value).replace(/[,$₹€£%\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values) {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function std(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 2) return null;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / nums.length);
}

export function fallbackProfile(records = []) {
  const rows = Array.isArray(records) ? records : [];
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {})
        .filter((key) => !String(key).startsWith('__'))
        .forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  const missingValues = {};
  const numericSummary = {};
  const measures = [];
  const dimensions = [];

  for (const column of columns) {
    const values = rows.map((row) => row?.[column]);
    missingValues[column] = values.filter(isMissing).length;
    const numbers = values.map(numberOrNull).filter((value) => value !== null);

    if (numbers.length / Math.max(values.length, 1) >= 0.8) {
      measures.push(column);
      numericSummary[column] = {
        count: numbers.length,
        mean: mean(numbers),
        std: std(numbers),
        min: numbers.length ? Math.min(...numbers) : null,
        max: numbers.length ? Math.max(...numbers) : null,
      };
    } else {
      dimensions.push(column);
    }
  }

  const totalCells = Math.max(rows.length * Math.max(columns.length, 1), 1);
  const missingCells = Object.values(missingValues).reduce((sum, value) => sum + value, 0);

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: columns.map((name) => ({
      name,
      inferredType: measures.includes(name) ? 'numeric' : 'categorical',
    })),
    measures,
    dimensions,
    missingValues,
    numericSummary,
    qualityScore: Math.max(0, Math.round((100 - (missingCells / totalCells) * 70) * 100) / 100),
    fallback: true,
  };
}

export function fallbackCorrelations(records = []) {
  const profile = fallbackProfile(records);
  return {
    method: 'javascript-fallback',
    matrix: [],
    strongPairs: [],
    numericColumns: profile.measures,
    warning: 'Python service unavailable. Returned lightweight fallback profile only.',
    fallback: true,
  };
}
