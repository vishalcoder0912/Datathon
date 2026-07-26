function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value)
    .replace(/[₹$,%]/g, "")
    .replace(/,/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateLike(value) {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  if (!/\d/.test(value)) return false;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function inferType(values = []) {
  const sample = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .slice(0, 100);

  if (!sample.length) return "string";

  const numeric = sample.filter((value) => safeNumber(value) !== null).length;
  const date = sample.filter(isDateLike).length;

  if (numeric / sample.length >= 0.8) return "number";
  if (date / sample.length >= 0.8) return "date";

  return "string";
}

function getStats(values = []) {
  const numbers = values.map(safeNumber).filter((value) => value !== null);

  if (!numbers.length) return null;

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  const avg = sum / numbers.length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Number(avg.toFixed(2)),
    validCount: numbers.length,
  };
}

export function buildSchemaProfile(dataset = {}) {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];

  const columnNames =
    Array.isArray(dataset.columns) && dataset.columns.length
      ? dataset.columns.map((column) => column.name || column)
      : Object.keys(rows[0] || {});

  const columns = columnNames
    .filter((name) => name && !String(name).startsWith("__"))
    .map((name) => {
      const values = rows.map((row) => row[name]);
      const type = inferType(values);
      const present = values.filter(
        (value) => value !== null && value !== undefined && value !== ""
      );
      const uniqueValues = [...new Set(present.map(String))];

      const role =
        type === "number" ? "metric" : type === "date" ? "date" : "dimension";

      return {
        name,
        normalizedName: normalizeName(name),
        type,
        role,
        uniqueCount: uniqueValues.length,
        nullCount: rows.length - present.length,
        topValues: role === "dimension" ? uniqueValues.slice(0, 12) : [],
        stats: type === "number" ? getStats(values) : null,
      };
    });

  const columnSignature = columns
    .map((column) => column.normalizedName)
    .sort()
    .join("|");

  return {
    datasetName: dataset.name || dataset.fileName || "Uploaded Dataset",
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    columnSignature,
    safePacket: {
      datasetName: dataset.name || dataset.fileName || "Uploaded Dataset",
      rowCount: rows.length,
      columnCount: columns.length,
      columns: columns.map((column) => ({
        name: column.name,
        type: column.type,
        role: column.role,
        uniqueCount: column.uniqueCount,
        nullCount: column.nullCount,
        topValues: column.topValues.slice(0, 8),
        stats: column.stats,
      })),
      rawRowsSentToAI: false,
    },
  };
}

export function findColumn(schema, aliases = [], role = null) {
  const normalizedAliases = aliases.map(normalizeName);

  const candidates = schema.columns
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

  if (candidates[0]) return candidates[0].column;

  if (role) {
    return schema.columns.find((column) => column.role === role) || null;
  }

  return null;
}
