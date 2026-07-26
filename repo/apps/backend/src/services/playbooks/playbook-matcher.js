import { DATA_ANALYTICS_PROJECT_PLAYBOOKS } from "./data-analytics-projects-playbooks.js";

export function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "")
    .replace(/[₹$,%]/g, "")
    .replace(/,/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isDateLike(value) {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  if (!/\d/.test(value)) return false;

  return Number.isFinite(Date.parse(value));
}

export function inferType(values = []) {
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

export function cleanRows(rows = []) {
  return rows.filter((row) => {
    const keys = Object.keys(row || {}).map(normalizeName);
    const source = String(row?._sourceFile || row?.source || "").toLowerCase();
    const dictionaryShape = keys.includes("column") && keys.includes("type") && keys.includes("description");

    return !source.includes("dictionary") && !dictionaryShape;
  });
}

export function buildSchema(dataset = {}) {
  const rows = cleanRows(dataset.rows || []);
  const rawColumns = dataset.columns?.length
    ? dataset.columns.map((column) => column.name || column)
    : Object.keys(rows[0] || {});

  const columns = rawColumns.map((name) => {
    const values = rows.map((row) => row[name]);
    const type = inferType(values);
    const present = values.filter((value) => value !== null && value !== undefined && value !== "");
    const uniqueValues = [...new Set(present.map(String))];

    let role = "category";
    if (type === "number") role = "metric";
    if (type === "date") role = "date";

    return {
      name,
      normalizedName: normalizeName(name),
      type,
      role,
      uniqueCount: uniqueValues.length,
      nullCount: rows.length - present.length,
      topValues: type === "string" ? uniqueValues.slice(0, 15) : [],
    };
  });

  return {
    name: dataset.name || dataset.fileName || "Uploaded Dataset",
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    rows,
    columnSignature: columns.map((column) => column.normalizedName).sort().join("|"),
    schemaOnlyPacket: {
      name: dataset.name || dataset.fileName || "Uploaded Dataset",
      rowCount: rows.length,
      columnCount: columns.length,
      columns: columns.map((column) => ({
        name: column.name,
        type: column.type,
        role: column.role,
        uniqueCount: column.uniqueCount,
        nullCount: column.nullCount,
        topValues: column.topValues.slice(0, 8),
      })),
      rawRowsSentToAI: false,
    },
  };
}

export function matchPlaybook(schema) {
  const names = schema.columns.map((column) => column.normalizedName).join(" ");

  const scored = DATA_ANALYTICS_PROJECT_PLAYBOOKS.map((playbook) => {
    let score = 0;

    for (const keyword of playbook.keywords) {
      const normalizedKeyword = normalizeName(keyword);
      if (names.includes(normalizedKeyword)) score += 2;
    }

    const hasDate = schema.columns.some((column) => column.role === "date");
    const hasMetric = schema.columns.some((column) => column.role === "metric");
    const hasCategory = schema.columns.some((column) => column.role === "category");

    if (playbook.domain === "time_series" && hasDate && hasMetric) score += 5;
    if (playbook.domain === "eda" && hasMetric && hasCategory) score += 3;
    if (playbook.domain === "market_basket" && /transaction|invoice|basket|item|product/.test(names)) score += 5;
    if (playbook.domain === "sentiment" && /review|comment|feedback|sentiment|rating/.test(names)) score += 5;
    if (playbook.domain === "recommendation" && /user|item|movie|product|rating/.test(names)) score += 5;

    return { playbook, score };
  }).sort((left, right) => right.score - left.score);

  const best = scored[0];

  if (!best || best.score <= 0) {
    return DATA_ANALYTICS_PROJECT_PLAYBOOKS.find((playbook) => playbook.domain === "eda");
  }

  return best.playbook;
}

export function findColumn(schema, options = {}) {
  const aliases = [
    ...(options.aliases || []),
    ...(options.metricAliases || []),
    ...(options.dimensionAliases || []),
  ].map(normalizeName);

  if (aliases.length) {
    const exact = schema.columns.find((column) =>
      aliases.some((alias) => column.normalizedName === alias)
    );

    if (exact) return exact;

    const partial = schema.columns.find((column) =>
      aliases.some((alias) => column.normalizedName.includes(alias) || alias.includes(column.normalizedName))
    );

    if (partial) return partial;
  }

  if (options.role) {
    return schema.columns.find((column) => column.role === options.role) || null;
  }

  return null;
}
