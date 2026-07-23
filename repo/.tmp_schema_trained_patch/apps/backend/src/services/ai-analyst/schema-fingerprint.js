import { createHash } from "node:crypto";

const MAX_TOP_VALUES = 15;

export function normalizeColumnName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^[\ufeff\s]+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function humanize(value = "") {
  return String(value)
    .replace(/^_+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);

  const cleaned = String(value ?? "")
    .replace(/[₹$€£,%\s]/g, "")
    .replace(/,/g, "");

  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "nan") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isDateLike(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;
  if (!/(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/.test(text)) return false;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed);
}

export function splitMultiValue(value) {
  if (isMissing(value)) return [];
  return String(value)
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function cleanDatasetRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || typeof row !== "object") return false;

    const keys = Object.keys(row).map(normalizeColumnName);
    const source = String(row._sourceFile || row.sourceFile || row.source || row.fileName || "").toLowerCase();

    const looksLikeDictionary =
      keys.includes("column") &&
      keys.includes("type") &&
      (keys.includes("description") || keys.includes("desc"));

    return !source.includes("dictionary") && !source.includes("data_dictionary") && !looksLikeDictionary;
  });
}

function inferColumnType(values = []) {
  const present = values.filter((value) => !isMissing(value)).slice(0, 500);
  if (!present.length) return "string";

  const numericCount = present.filter((value) => safeNumber(value) !== null).length;
  const dateCount = present.filter(isDateLike).length;

  if (dateCount / present.length >= 0.8) return "date";
  if (numericCount / present.length >= 0.8) return "number";
  if (new Set(present.map(String)).size <= Math.max(2, present.length * 0.2)) return "category";
  return "string";
}

function getStats(values = []) {
  const numbers = values.map(safeNumber).filter((value) => value !== null).sort((a, b) => a - b);
  if (!numbers.length) return null;

  const sum = numbers.reduce((total, value) => total + value, 0);
  const mid = Math.floor(numbers.length / 2);
  const median = numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;

  return {
    min: numbers[0],
    max: numbers[numbers.length - 1],
    mean: Math.round((sum / numbers.length) * 100) / 100,
    median: Math.round(median * 100) / 100,
  };
}

function inferRole(name, type, uniqueCount, rowCount) {
  const n = normalizeColumnName(name);

  if (/^(id|uuid|row_id|index|sr_no|serial|customer_code|user_id|student_id)$/.test(n) || n.endsWith("_id")) return "id";
  if (type === "date" || /date|time|year|month|day|created|updated|timestamp/.test(n)) return "date";
  if (/country|state|city|region|location|address|market|territory/.test(n)) return "location";
  if (/salary|revenue|sales|amount|price|cost|profit|income|spend|budget|value|gmv|arr|mrr/.test(n)) return "money_metric";
  if (/score|rating|marks|grade|performance|level|index|rank|gpa/.test(n)) return "score_metric";
  if (/age|experience|years|tenure|duration/.test(n)) return "continuous_metric";
  if (/quantity|qty|units|orders|count|visits|clicks|sessions/.test(n)) return "count_metric";
  if (/rate|ratio|percent|percentage|margin|conversion|churn/.test(n)) return "rate_metric";
  if (/target|label|outcome|class|status|result/.test(n)) return "target";
  if (/language|framework|skill|tag|category|product|education|gender|platform|segment|department|company_size/.test(n)) return "category";

  if (type === "number") return uniqueCount <= Math.max(20, rowCount * 0.03) ? "numeric_category" : "continuous_metric";
  if (type === "category") return "category";
  return "text";
}

function topValues(values = []) {
  const counts = new Map();
  for (const value of values) {
    if (isMissing(value)) continue;
    const parts = splitMultiValue(value);
    const items = parts.length > 1 ? parts : [String(value).trim()];
    for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_VALUES)
    .map(([value, count]) => ({ value, count }));
}

export function buildSchemaProfile(dataset = {}) {
  const rows = cleanDatasetRows(dataset.rows || []);
  const suppliedColumns = Array.isArray(dataset.columns) ? dataset.columns : [];
  const dictionaryRows = Array.isArray(dataset.dictionaryRows) ? dataset.dictionaryRows : [];

  const names = suppliedColumns.length
    ? suppliedColumns.map((column) => column.name || column.Column || column.column || column)
    : Object.keys(rows[0] || {});

  const dictionaryMap = new Map(
    dictionaryRows.map((item) => [
      normalizeColumnName(item.Column || item.column || item.name),
      {
        type: item.Type || item.type,
        description: item.Description || item.description || item.desc,
      },
    ])
  );

  const columns = names
    .filter(Boolean)
    .filter((name) => !String(name).startsWith("_"))
    .map((name) => {
      const normalized = normalizeColumnName(name);
      const values = rows.map((row) => row[name]);
      const present = values.filter((value) => !isMissing(value));
      const uniqueCount = new Set(present.map((value) => String(value).trim())).size;
      const dictionary = dictionaryMap.get(normalized) || {};
      const explicitType = suppliedColumns.find((column) => normalizeColumnName(column.name || column.Column || column) === normalized)?.type || dictionary.type;
      const type = explicitType ? normalizeColumnName(explicitType).replace("integer", "number").replace("float", "number") : inferColumnType(values);
      const role = inferRole(name, type, uniqueCount, rows.length);

      return {
        name: String(name),
        normalizedName: normalized,
        title: humanize(name),
        type,
        role,
        description: dictionary.description || "",
        uniqueCount,
        missingCount: values.length - present.length,
        missingPct: rows.length ? Math.round(((values.length - present.length) / rows.length) * 10000) / 100 : 0,
        topValues: type === "number" && !["numeric_category", "target"].includes(role) ? [] : topValues(values),
        stats: type === "number" ? getStats(values) : null,
      };
    });

  const domain = detectDomain(columns);
  const signature = getSchemaSignature(columns);

  return {
    datasetName: dataset.name || dataset.fileName || "Uploaded Dataset",
    rowCount: rows.length,
    columnCount: columns.length,
    domain,
    signature,
    columns,
    roleCounts: columns.reduce((acc, column) => {
      acc[column.role] = (acc[column.role] || 0) + 1;
      return acc;
    }, {}),
  };
}

export function detectDomain(columns = []) {
  const text = columns.map((column) => `${column.normalizedName} ${column.role}`).join(" ");

  if (/salary|experience|education|framework|language|company_size|developer|employee|hr|department/.test(text)) return "workforce_salary";
  if (/stress|anxiety|depression|sleep|mental|health|screen_time|social_media|addiction/.test(text)) return "health_wellness";
  if (/student|marks|grade|attendance|course|school|exam|gpa|academic/.test(text)) return "education";
  if (/revenue|sales|amount|product|customer|order|quantity|profit|market/.test(text)) return "sales_commerce";
  if (/sentiment|review|rating|text|comment|feedback/.test(text)) return "sentiment_text";
  if (/date|time|year|month/.test(text) && /revenue|sales|amount|price|temperature|traffic|demand|volume/.test(text)) return "time_series";
  return "generic";
}

export function getSchemaSignature(columns = []) {
  const compact = columns
    .map((column) => `${column.normalizedName}:${column.type}:${column.role}`)
    .sort()
    .join("|");

  return createHash("sha256").update(compact).digest("hex").slice(0, 24);
}

export function schemaSimilarity(a, b) {
  if (!a || !b) return 0;
  const colsA = a.columns || [];
  const colsB = b.columns || [];

  const nameA = new Set(colsA.map((column) => column.normalizedName));
  const nameB = new Set(colsB.map((column) => column.normalizedName));
  const roleA = new Set(colsA.map((column) => column.role));
  const roleB = new Set(colsB.map((column) => column.role));

  const jaccard = (set1, set2) => {
    const intersection = [...set1].filter((value) => set2.has(value)).length;
    const union = new Set([...set1, ...set2]).size || 1;
    return intersection / union;
  };

  const nameScore = jaccard(nameA, nameB);
  const roleScore = jaccard(roleA, roleB);
  const domainScore = a.domain && b.domain && a.domain === b.domain ? 1 : 0;

  return Math.round((nameScore * 0.5 + roleScore * 0.35 + domainScore * 0.15) * 1000) / 1000;
}

export function makeSchemaOnlyPacket(profile) {
  return {
    datasetName: profile.datasetName,
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    domain: profile.domain,
    signature: profile.signature,
    columns: profile.columns.map((column) => ({
      name: column.name,
      normalizedName: column.normalizedName,
      type: column.type,
      role: column.role,
      description: column.description,
      uniqueCount: column.uniqueCount,
      missingPct: column.missingPct,
      topValues: column.topValues?.slice(0, 10)?.map((item) => item.value) || [],
      stats: column.stats,
    })),
  };
}
