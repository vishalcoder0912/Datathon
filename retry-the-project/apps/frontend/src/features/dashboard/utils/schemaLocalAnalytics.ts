import type {
  SchemaAggregation,
  SchemaDashboardChartSpec,
  SchemaDashboardKpiSpec,
} from "../../data/api/schemaTrainedApi.additions";

export type DataRow = Record<string, unknown>;

export type LocalKpiResult = SchemaDashboardKpiSpec & {
  value: number | string;
  formattedValue: string;
};

export type LocalChartResult = SchemaDashboardChartSpec & {
  data: Array<Record<string, unknown>>;
};

export type DashboardFilter = {
  key: string;
  operator?: "equals" | "not_equals" | "contains" | "gt" | "lt" | "gte" | "lte";
  value: unknown;
};

function isMissing(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(/[₹$€£,%\s]/g, "")
    .replace(/,/g, "");

  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "nan") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function aggregate(rows: DataRow[], metric: string, aggregation: SchemaAggregation): number {
  if (metric === "__row_count__" || aggregation === "count") return rows.length;
  if (metric === "__column_count__") return rows[0] ? Object.keys(rows[0]).length : 0;

  const values = rows.map((row) => row[metric]).filter((value) => !isMissing(value));

  if (aggregation === "count_unique") {
    return new Set(values.map((value) => String(value))).size;
  }

  const numbers = values
    .map(toNumber)
    .filter((value): value is number => value !== null);

  if (!numbers.length) return 0;

  if (aggregation === "sum") return numbers.reduce((sum, value) => sum + value, 0);
  if (aggregation === "avg") return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);
  if (aggregation === "median") return median(numbers);

  return numbers.length;
}

function topGroupByAverage(rows: DataRow[], groupKey: string, metricKey = "salary_usd") {
  const groups = new Map<string, { total: number; count: number }>();

  rows.forEach((row) => {
    const group = row[groupKey];
    const metric = toNumber(row[metricKey]);
    if (isMissing(group) || metric === null) return;

    const key = String(group).trim();
    const current = groups.get(key) || { total: 0, count: 0 };
    current.total += metric;
    current.count += 1;
    groups.set(key, current);
  });

  return [...groups.entries()]
    .map(([name, stats]) => ({ name, average: stats.total / stats.count }))
    .sort((left, right) => right.average - left.average)[0]?.name || "N/A";
}

function formatValue(value: number | string, format?: string) {
  if (typeof value === "string") return value;

  if (format === "currency") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (format === "percent") {
    return `${Number(value).toFixed(1)}%`;
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function calculateKpi(rows: DataRow[], spec: SchemaDashboardKpiSpec): LocalKpiResult {
  if (spec.aggregation === "top_by_avg") {
    const value = topGroupByAverage(rows, spec.metric || "country");

    return {
      ...spec,
      value,
      formattedValue: value,
    };
  }

  const value = aggregate(rows, spec.metric || "__row_count__", spec.aggregation || "count");

  return {
    ...spec,
    value,
    formattedValue: formatValue(value, spec.format),
  };
}

export function calculateKpis(rows: DataRow[], specs: SchemaDashboardKpiSpec[] = []) {
  return specs.map((spec) => calculateKpi(rows, spec));
}

function groupRows(rows: DataRow[], key: string, spec?: SchemaDashboardChartSpec) {
  const groups = new Map<string, DataRow[]>();
  const splitValues = (spec as any)?.splitValues === true || (spec as any)?.multiValue === true;
  const delimiter = (spec as any)?.splitDelimiter || ",";

  for (const row of rows) {
    const raw = row[key];
    const labels = splitValues && !isMissing(raw)
      ? String(raw).split(delimiter).map((item) => item.trim()).filter(Boolean)
      : [isMissing(raw) ? "(Missing)" : String(raw)];

    labels.forEach((label) => {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(row);
    });
  }

  return groups;
}

function buildGroupedChart(rows: DataRow[], spec: SchemaDashboardChartSpec) {
  const groups = groupRows(rows, spec.xKey, spec);

  return [...groups.entries()]
    .map(([name, group]) => ({
      name,
      [spec.xKey]: name,
      value: aggregate(group, spec.yKey || "count", spec.aggregation || "count"),
      count: group.length,
    }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, spec.limit || 10);
}

function buildHistogram(rows: DataRow[], spec: SchemaDashboardChartSpec) {
  const numbers = rows
    .map((row) => toNumber(row[spec.xKey]))
    .filter((value): value is number => value !== null);

  if (!numbers.length) return [];

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const bins = Math.max(4, Math.min(24, Number(spec.limit || 12)));

  if (min === max) {
    return [{ name: String(min), min, max, value: numbers.length, count: numbers.length }];
  }

  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, index) => {
    const start = min + index * step;
    const end = index === bins - 1 ? max : start + step;
    return {
      name: `${Math.round(start)}-${Math.round(end)}`,
      min: start,
      max: end,
      value: 0,
      count: 0,
    };
  });

  for (const number of numbers) {
    const index = Math.min(bins - 1, Math.floor((number - min) / step));
    buckets[index].value += 1;
    buckets[index].count += 1;
  }

  return buckets;
}

function buildScatter(rows: DataRow[], spec: SchemaDashboardChartSpec) {
  return rows
    .map((row) => {
      const x = toNumber(row[spec.xKey]);
      const y = toNumber(row[spec.yKey]);
      if (x === null || y === null) return null;

      return {
        name: `${x}, ${y}`,
        [spec.xKey]: x,
        [spec.yKey]: y,
        x,
        y,
      };
    })
    .filter(Boolean)
    .slice(0, spec.limit || 500) as Array<Record<string, unknown>>;
}

function buildMissingValues(rows: DataRow[]) {
  const keys = Object.keys(rows[0] || {});
  return keys.map((key) => {
    const missing = rows.filter((row) => isMissing(row[key])).length;
    const pct = rows.length ? (missing / rows.length) * 100 : 0;
    return {
      name: key,
      value: Number(pct.toFixed(2)),
      missing,
      total: rows.length,
    };
  }).sort((a, b) => b.value - a.value);
}

export function calculateChart(rows: DataRow[], spec: SchemaDashboardChartSpec & { special?: string }): LocalChartResult {
  let data: Array<Record<string, unknown>> = [];

  if ((spec as any).special === "missing_values" || spec.xKey === "__column__") {
    data = buildMissingValues(rows);
  } else if (spec.type === "histogram") {
    data = buildHistogram(rows, spec);
  } else if (spec.type === "scatter") {
    data = buildScatter(rows, spec);
  } else {
    data = buildGroupedChart(rows, spec);
  }

  return {
    ...spec,
    data,
  };
}

export function calculateCharts(rows: DataRow[], specs: SchemaDashboardChartSpec[] = []) {
  return specs.map((spec) => calculateChart(rows, spec));
}

export function applyDashboardFilters(rows: DataRow[], filters: DashboardFilter[] = []) {
  if (!filters.length) return rows;

  return rows.filter((row) => filters.every((filter) => {
    if (!filter?.key) return true;

    const actual = row[filter.key];
    const expected = filter.value;
    const operator = filter.operator || "equals";

    if (operator === "equals") return String(actual) === String(expected);
    if (operator === "not_equals") return String(actual) !== String(expected);
    if (operator === "contains") return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());

    const actualNumber = toNumber(actual);
    const expectedNumber = toNumber(expected);
    if (actualNumber === null || expectedNumber === null) return false;

    if (operator === "gt") return actualNumber > expectedNumber;
    if (operator === "gte") return actualNumber >= expectedNumber;
    if (operator === "lt") return actualNumber < expectedNumber;
    if (operator === "lte") return actualNumber <= expectedNumber;

    return true;
  }));
}

export function validateChartSpecForRows(rows: DataRow[], spec: SchemaDashboardChartSpec) {
  const first = rows[0] || {};
  const keys = new Set(Object.keys(first));

  if (spec.xKey === "__row_index__") {
    return { ok: false, reason: "Row index is not a real business dimension." };
  }

  if ((spec.type === "line" || spec.intent === "trend") && !/date|time/i.test(spec.xKey)) {
    return { ok: false, reason: "Trend charts require a real date/time column." };
  }

  if (spec.xKey !== "__column__" && !keys.has(spec.xKey)) {
    return { ok: false, reason: `Column ${spec.xKey} does not exist in rows.` };
  }

  if (spec.yKey !== "count" && spec.yKey !== "__missingPct__" && !keys.has(spec.yKey)) {
    return { ok: false, reason: `Column ${spec.yKey} does not exist in rows.` };
  }

  if (spec.type === "scatter") {
    const sample = rows.slice(0, 50);
    const xNumeric = sample.some((row) => toNumber(row[spec.xKey]) !== null);
    const yNumeric = sample.some((row) => toNumber(row[spec.yKey]) !== null);
    if (!xNumeric || !yNumeric) {
      return { ok: false, reason: "Scatter chart needs numeric x and y columns." };
    }
  }

  if (spec.type === "histogram") {
    const sample = rows.slice(0, 50);
    const xNumeric = sample.some((row) => toNumber(row[spec.xKey]) !== null);
    if (!xNumeric) return { ok: false, reason: "Histogram needs a numeric column." };
  }

  return { ok: true };
}
