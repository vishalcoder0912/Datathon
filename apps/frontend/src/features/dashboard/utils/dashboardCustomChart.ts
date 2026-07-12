import type { Dataset, DatasetRow } from "@/features/data/model/dataStore";
import type { PremiumChart, PremiumChartDatum } from "@/features/dashboard/types/premiumDashboardTypes";

type Aggregation = "sum" | "avg" | "count" | "min" | "max" | "median";
type ChartType = PremiumChart["type"];

export type DashboardChartCommandParams = {
  query?: string;
  title?: string;
  chartType?: ChartType;
  type?: ChartType;
  x?: string;
  y?: string;
  xKey?: string;
  yKey?: string;
  aggregation?: Aggregation | "none";
};

const CHART_TYPES = new Set<ChartType>(["bar", "histogram", "scatter", "donut", "line", "table", "map"]);

const formatColumn = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const isNumericColumn = (rows: DatasetRow[], column: string, type?: string) => {
  if (["number", "currency", "percentage", "latitude", "longitude"].includes(type || "")) return true;
  const sample = rows.slice(0, 80).map((row) => asNumber(row[column])).filter((value) => value !== null);
  return sample.length >= Math.min(8, Math.max(2, Math.floor(rows.slice(0, 80).length * 0.35)));
};

const findColumn = (dataset: Dataset, requested?: unknown) => {
  if (!requested) return undefined;
  const target = normalize(requested);
  if (!target) return undefined;
  const columns = dataset.columns.map((column) => column.name);

  return (
    columns.find((column) => normalize(column) === target) ||
    columns.find((column) => normalize(column).includes(target) || target.includes(normalize(column))) ||
    columns.find((column) => target.split(" ").some((word) => word.length > 2 && normalize(column).includes(word)))
  );
};

const findColumnFromQuery = (dataset: Dataset, query: string, candidates: string[]) => {
  const normalizedQuery = normalize(query);
  return candidates.find((column) => {
    const normalizedColumn = normalize(column);
    return normalizedQuery.includes(normalizedColumn) || normalizedColumn.split(" ").some((word) => word.length > 2 && normalizedQuery.includes(word));
  });
};

const pickColumns = (dataset: Dataset, params: DashboardChartCommandParams) => {
  const numericColumns = dataset.columns
    .filter((column) => isNumericColumn(dataset.rows, column.name, column.type))
    .map((column) => column.name);
  const categoricalColumns = dataset.columns
    .filter((column) => !numericColumns.includes(column.name))
    .map((column) => column.name);
  const query = String(params.query || "");

  const requestedX = findColumn(dataset, params.xKey || params.x);
  const requestedY = findColumn(dataset, params.yKey || params.y);
  const metricFromQuery = findColumnFromQuery(dataset, query, numericColumns);
  const dimensionFromQuery = findColumnFromQuery(dataset, query, categoricalColumns);

  let xKey = requestedX || dimensionFromQuery || categoricalColumns[0] || numericColumns[0];
  let yKey = requestedY || metricFromQuery || numericColumns.find((column) => column !== xKey);

  if (/vs|versus/i.test(query) && requestedX && requestedY) {
    xKey = requestedX;
    yKey = requestedY;
  }

  return { xKey, yKey, numericColumns, categoricalColumns };
};

const detectAggregation = (params: DashboardChartCommandParams): Aggregation => {
  const query = String(params.query || "").toLowerCase();
  if (params.aggregation && params.aggregation !== "none") return params.aggregation;
  if (/\b(total|sum)\b/.test(query)) return "sum";
  if (/\b(count|records|frequency)\b/.test(query)) return "count";
  if (/\b(min|lowest|minimum)\b/.test(query)) return "min";
  if (/\b(max|highest|maximum|top)\b/.test(query)) return "max";
  if (/\b(median)\b/.test(query)) return "median";
  return "avg";
};

const aggregate = (values: number[], aggregation: Aggregation) => {
  if (aggregation === "count") return values.length;
  if (!values.length) return 0;
  if (aggregation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === "min") return Math.min(...values);
  if (aggregation === "max") return Math.max(...values);
  const sorted = [...values].sort((left, right) => left - right);
  if (aggregation === "median") {
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const groupByDimension = (
  rows: DatasetRow[],
  dimension: string,
  metric: string | undefined,
  aggregation: Aggregation,
  limit = 12,
) => {
  const groups = new Map<string, number[]>();

  rows.forEach((row) => {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const value = metric ? asNumber(row[metric]) : 1;
    if (value === null && aggregation !== "count") return;
    const values = groups.get(label) || [];
    values.push(value ?? 1);
    groups.set(label, values);
  });

  return [...groups.entries()]
    .map(([label, values]) => ({
      label,
      value: Number(aggregate(values, aggregation).toFixed(2)),
      count: values.length,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
};

const buildHistogram = (rows: DatasetRow[], metric: string, limit = 10) => {
  const values = rows.map((row) => asNumber(row[metric])).filter((value): value is number => value !== null);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(limit, Math.max(6, Math.ceil(Math.sqrt(values.length))));
  const width = max === min ? 1 : (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    label: `${Math.round(min + index * width).toLocaleString()}-${Math.round(min + (index + 1) * width).toLocaleString()}`,
    value: 0,
  }));

  values.forEach((value) => {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / width)));
    bins[index].value += 1;
  });

  return bins;
};

const buildScatter = (rows: DatasetRow[], xKey: string, yKey: string) => {
  const points = rows
    .map((row) => {
      const x = asNumber(row[xKey]);
      const y = asNumber(row[yKey]);
      return x !== null && y !== null ? { x, y } : null;
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));
  const step = Math.max(1, Math.ceil(points.length / 500));
  return points.filter((_, index) => index % step === 0);
};

const inferChartType = (
  params: DashboardChartCommandParams,
  xKey: string | undefined,
  yKey: string | undefined,
  numericColumns: string[],
): ChartType => {
  const requested = params.chartType || params.type;
  if (requested && CHART_TYPES.has(requested)) return requested;
  const query = String(params.query || "").toLowerCase();
  if (/map|geo|country|location|region/.test(query)) return "map";
  if (/scatter|vs|correlation|relationship/.test(query) && xKey && yKey && numericColumns.includes(xKey) && numericColumns.includes(yKey)) return "scatter";
  if (/distribution|histogram|spread/.test(query)) return "histogram";
  if (/pie|donut|share|mix|breakdown/.test(query)) return "donut";
  if (/trend|over time|month|year|date/.test(query)) return "line";
  if (/table|ranking|list/.test(query)) return "table";
  return "bar";
};

const buildTitle = (type: ChartType, aggregation: Aggregation, xKey?: string, yKey?: string) => {
  if (type === "scatter" && xKey && yKey) return `${formatColumn(yKey)} vs ${formatColumn(xKey)}`;
  if (type === "histogram" && (yKey || xKey)) return `${formatColumn(yKey || xKey || "Metric")} Distribution`;
  if (type === "donut" && xKey) return `${formatColumn(xKey)} Breakdown`;
  if (xKey && yKey) return `${formatColumn(aggregation === "avg" ? "Average" : aggregation)} ${formatColumn(yKey)} by ${formatColumn(xKey)}`;
  if (xKey) return `${formatColumn(xKey)} Breakdown`;
  return "Custom Chart";
};

export function buildDashboardChartFromCommand(
  dataset: Dataset,
  params: DashboardChartCommandParams,
  existingChart?: PremiumChart,
): PremiumChart | null {
  if (!dataset.rows.length || !dataset.columns.length) return null;

  const { xKey, yKey, numericColumns, categoricalColumns } = pickColumns(dataset, params);
  const aggregation = detectAggregation(params);
  const type = inferChartType(params, xKey, yKey, numericColumns);
  let data: PremiumChartDatum[] = [];
  let outputXKey = "label";
  let outputYKey = "value";

  if (type === "scatter") {
    const scatterX = numericColumns.includes(xKey || "") ? xKey : numericColumns[0];
    const scatterY = numericColumns.find((column) => column !== scatterX) || yKey;
    if (!scatterX || !scatterY) return null;
    data = buildScatter(dataset.rows, scatterX, scatterY);
    outputXKey = "x";
    outputYKey = "y";
  } else if (type === "histogram") {
    const metric = yKey || (xKey && numericColumns.includes(xKey) ? xKey : undefined) || numericColumns[0];
    if (!metric) return null;
    data = buildHistogram(dataset.rows, metric);
  } else {
    const dimension = xKey && !numericColumns.includes(xKey) ? xKey : categoricalColumns[0] || xKey;
    const metric = yKey && numericColumns.includes(yKey) ? yKey : numericColumns.find((column) => column !== dimension);
    if (!dimension) return null;
    data = groupByDimension(dataset.rows, dimension, metric, type === "donut" ? "count" : aggregation, type === "table" ? 20 : 12);
  }

  if (!data.length) return null;

  return {
    id: existingChart?.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(params.title || existingChart?.title || buildTitle(type, aggregation, xKey, yKey)),
    subtitle: existingChart?.subtitle || "Created by dashboard chatbot",
    type,
    xKey: outputXKey,
    yKey: outputYKey,
    data,
  };
}
