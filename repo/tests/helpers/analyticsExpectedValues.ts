export type Row = Record<string, any>;

export function sum(rows: Row[], field: string): number {
  return rows
    .map((r) => Number(r[field]))
    .filter((v) => !isNaN(v) && isFinite(v))
    .reduce((a, b) => a + b, 0);
}

export function avg(rows: Row[], field: string): number {
  const values = rows.map((r) => Number(r[field])).filter((v) => !isNaN(v) && isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function median(rows: Row[], field: string): number {
  const values = rows
    .map((r) => Number(r[field]))
    .filter((v) => !isNaN(v) && isFinite(v))
    .sort((a, b) => a - b);
  if (!values.length) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

export function count(rows: Row[]): number {
  return rows.length;
}

export function distinctCount(rows: Row[], field: string): number {
  const values = rows
    .map((r) => r[field])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  return new Set(values).size;
}

export function groupBy(rows: Row[], dimension: string): Record<string, Row[]> {
  const groups: Record<string, Row[]> = {};
  for (const row of rows) {
    const val = String(row[dimension] ?? "Unknown").trim();
    if (!groups[val]) groups[val] = [];
    groups[val].push(row);
  }
  return groups;
}

export function aggregateGroup(
  rows: Row[],
  dimension: string,
  metric: string,
  aggregation: "sum" | "avg" | "median" | "count"
): Array<{ name: string; value: number }> {
  const groups = groupBy(rows, dimension);
  return Object.entries(groups).map(([name, groupRows]) => {
    let value = 0;
    if (aggregation === "sum") {
      value = sum(groupRows, metric);
    } else if (aggregation === "avg") {
      value = avg(groupRows, metric);
    } else if (aggregation === "median") {
      value = median(groupRows, metric);
    } else {
      value = count(groupRows);
    }
    return { name, value: Number(value.toFixed(2)) };
  });
}

export function topN(
  groups: Array<{ name: string; value: number }>,
  n: number
): Array<{ name: string; value: number }> {
  return [...groups].sort((a, b) => b.value - a.value).slice(0, n);
}

export function missingValueCount(rows: Row[], field: string): number {
  return rows.filter((r) => r[field] === null || r[field] === undefined || String(r[field]).trim() === "").length;
}

export function duplicateRowCount(rows: Row[]): number {
  const stringified = rows.map((r) => JSON.stringify(r));
  const seen = new Set<string>();
  let duplicates = 0;
  for (const s of stringified) {
    if (seen.has(s)) {
      duplicates++;
    } else {
      seen.add(s);
    }
  }
  return duplicates;
}

export function detectNumericColumns(rows: Row[]): string[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.filter((key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== "");
    return vals.length > 0 && vals.every((v) => !isNaN(Number(v)));
  });
}

export function detectDateColumns(rows: Row[]): string[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.filter((key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== "");
    return (
      vals.length > 0 &&
      vals.every((v) => !isNaN(Date.parse(String(v))) && isNaN(Number(v))) // Check if it's parseable as date but not a plain number
    );
  });
}

export function detectGeoColumns(rows: Row[]): string[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const geoKeywords = ["country", "region", "city", "state", "location", "company_location"];
  return keys.filter((key) => geoKeywords.includes(key.toLowerCase()));
}

export function normalizeLocation(value: string): string {
  const norm = String(value || "").trim().toLowerCase();
  if (norm === "usa" || norm === "united states") return "United States";
  if (norm === "india") return "India";
  if (norm === "canada") return "Canada";
  if (norm === "uk" || norm === "united kingdom") return "United Kingdom";
  return value;
}
