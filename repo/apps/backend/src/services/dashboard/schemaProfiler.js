function normalizeName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

export function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Number(
    String(value ?? "")
      .replace(/[,$₹%\s]/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function isDateLike(value) {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  if (!/\d/.test(value)) return false;

  const time = Date.parse(value);
  return Number.isFinite(time);
}

export function cleanDatasetRows(rows = []) {
  return rows.filter((row) => {
    const keys = Object.keys(row || {}).map(normalizeName);
    const source = String(
      row?._sourceFile || row?.source || row?.fileName || ""
    ).toLowerCase();

    const dictionaryShape =
      keys.includes("column") &&
      keys.includes("type") &&
      keys.includes("description");

    return !source.includes("dictionary") && !dictionaryShape;
  });
}

function getDictionaryMap(dataDictionary = []) {
  const map = new Map();

  for (const row of dataDictionary || []) {
    const column =
      row.column ||
      row.Column ||
      row.name ||
      row.Name ||
      row.field ||
      row.Field;

    if (!column) continue;

    map.set(String(column), {
      description:
        row.description ||
        row.Description ||
        row.meaning ||
        row.Meaning ||
        "",
      type: row.type || row.Type || "",
    });
  }

  return map;
}

function inferRole(name, type, uniqueCount, rowCount) {
  const lower = name.toLowerCase();

  if (/id$|_id$|uuid|identifier/.test(lower)) return "id";
  if (type === "date") return "date";

  if (
    type === "number" &&
    !/age|score|salary|sales|amount|price|revenue|profit|income|hours|level|rating|quantity/i.test(
      name
    ) &&
    uniqueCount > rowCount * 0.7
  ) {
    return "id";
  }

  if (type === "number") return "metric";

  if (/comment|review|text|description|summary|message/i.test(name)) {
    return "text";
  }

  return "dimension";
}

export function generateSchemaProfile({
  rows = [],
  dataDictionary = [],
  datasetName = "Uploaded Dataset",
}) {
  const cleanRows = cleanDatasetRows(rows);
  const dictionary = getDictionaryMap(dataDictionary);

  const columnNames = [
    ...new Set(cleanRows.flatMap((row) => Object.keys(row || {}))),
  ].filter((key) => !key.startsWith("__"));

  const columns = columnNames.map((name) => {
    const values = cleanRows.map((row) => row[name]);
    const presentValues = values.filter((value) => !isMissing(value));
    const sample = presentValues.slice(0, 300);

    const numericCount = sample.filter((value) => safeNumber(value) !== null).length;
    const dateCount = sample.filter(isDateLike).length;

    let type = "string";

    if (sample.length && numericCount / sample.length >= 0.85) {
      type = "number";
    } else if (sample.length && dateCount / sample.length >= 0.85) {
      type = "date";
    }

    const uniqueValues = [
      ...new Set(presentValues.map((value) => String(value).trim())),
    ].filter(Boolean);

    const numbers = presentValues
      .map(safeNumber)
      .filter((value) => value !== null)
      .sort((a, b) => a - b);

    const stats =
      type === "number" && numbers.length
        ? {
            min: numbers[0],
            max: numbers[numbers.length - 1],
            avg:
              numbers.reduce((total, value) => total + value, 0) /
              numbers.length,
            median:
              numbers.length % 2
                ? numbers[Math.floor(numbers.length / 2)]
                : (numbers[numbers.length / 2 - 1] +
                    numbers[numbers.length / 2]) /
                  2,
          }
        : null;

    return {
      name,
      type,
      role: inferRole(name, type, uniqueValues.length, cleanRows.length),
      description: dictionary.get(name)?.description || "",
      uniqueCount: uniqueValues.length,
      missingPct: cleanRows.length
        ? Number(
            (((values.length - presentValues.length) / cleanRows.length) * 100).toFixed(2)
          )
        : 0,
      topValues: uniqueValues.slice(0, 12),
      stats,
    };
  });

  return {
    datasetName,
    rowCount: cleanRows.length,
    columnCount: columns.length,
    columns,
  };
}
