import type { Dataset, DatasetRow } from "@/features/data/model/dataStore";
import type {
  AgentReasoningStep,
  PremiumChart,
  PremiumChartDatum,
  PremiumDashboardModel,
  PremiumInsight,
  PremiumKpi,
  RagPipelineStep,
} from "@/features/dashboard/types/premiumDashboardTypes";

const NUMBER_HINTS = ["revenue", "sales", "profit", "amount", "price", "income", "salary", "score", "cost", "usd", "inr", "value"];
const DIMENSION_HINTS = ["category", "segment", "department", "product", "country", "state", "city", "region", "education", "company", "company_size"];
const MULTI_VALUE_HINTS = ["skills", "skill", "languages", "language", "frameworks", "framework", "tools"];
const NUMERIC_SAMPLE_SIZE = 1000;
const DUPLICATE_SAMPLE_SIZE = 5000;
const MAX_SCATTER_POINTS = 1200;

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type NumericSummary = {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
};

type AnalysisContext = {
  rows: DatasetRow[];
  columnNames: string[];
  numericColumns: string[];
  categoricalColumns: string[];
  metric: string | null;
  dimension: string | null;
  dateColumn: string | null;
  geoColumn: string | null;
  latitudeColumn: string | null;
  longitudeColumn: string | null;
  multiValueColumn: string | null;
  educationColumn: string | null;
  companySizeColumn: string | null;
  relationshipColumn: string | null;
  numericSummaries: Map<string, NumericSummary>;
  qualityScore: number;
};

const normalize = (value: string) => value.toLowerCase().replace(/[\s-]+/g, "_").trim();
const pretty = (value: string) => value.replace(/_/g, " ");

const formatNumber = (value: number | null | undefined, compact = false) => {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: value > 100 ? 0 : 1,
  }).format(value);
};

const formatMoney = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const medianFromSorted = (values: number[]) => {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
};

const splitMultiValue = (value: unknown) =>
  String(value ?? "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const createSummary = (): NumericSummary => ({
  count: 0,
  sum: 0,
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
  values: [],
});

const pushSummaryValue = (summary: NumericSummary, value: number) => {
  summary.count += 1;
  summary.sum += value;
  summary.min = Math.min(summary.min, value);
  summary.max = Math.max(summary.max, value);
  summary.values.push(value);
};

const uniqueCount = (rows: DatasetRow[], column: string) => {
  const values = new Set<string>();
  for (const row of rows) {
    const value = String(row[column] ?? "").trim();
    if (value) values.add(value);
  }
  return values.size;
};

const detectNumericColumns = (dataset: Dataset) => {
  const rowSample = dataset.rows.slice(0, NUMERIC_SAMPLE_SIZE);
  return dataset.columns
    .map((column) => column.name)
    .filter((name) => {
      const column = dataset.columns.find((item) => item.name === name);
      const normalizedName = normalize(name);
      if (/^(__rowid|row_id|id)$/i.test(normalizedName)) return false;
      if (["number", "currency", "percentage", "latitude", "longitude"].includes(column?.type || "")) return true;
      let valid = 0;
      for (const row of rowSample) {
        if (asNumber(row[name]) !== null) valid += 1;
      }
      return valid >= Math.max(3, rowSample.length * 0.6);
    });
};

const pickPrimaryMetricFromColumns = (numericColumns: string[]) => {
  const safeMetrics = numericColumns.filter((name) => !/lat|latitude|lng|lon|longitude|id|row/i.test(name));
  return safeMetrics.find((name) => NUMBER_HINTS.some((hint) => normalize(name).includes(hint))) || safeMetrics[0] || null;
};

const pickGeoMetricFromColumns = (numericColumns: string[], latitudeColumn: string | null, longitudeColumn: string | null, fallbackMetric: string | null) => {
  const candidates = numericColumns.filter((name) => name !== latitudeColumn && name !== longitudeColumn && !/id|row/i.test(name));
  return (fallbackMetric && candidates.includes(fallbackMetric) ? fallbackMetric : null) || candidates.find((name) => NUMBER_HINTS.some((hint) => normalize(name).includes(hint))) || candidates[0] || null;
};

const pickPrimaryDimensionFromColumns = (rows: DatasetRow[], categoricalColumns: string[]) =>
  categoricalColumns.find((name) => DIMENSION_HINTS.some((hint) => normalize(name).includes(hint))) ||
  categoricalColumns
    .map((name) => ({ name, count: uniqueCount(rows, name) }))
    .filter((item) => item.count > 1 && item.count <= 40)
    .sort((left, right) => left.count - right.count)[0]?.name ||
  categoricalColumns[0] ||
  null;

const pickMultiValueColumnFromColumns = (rows: DatasetRow[], categoricalColumns: string[]) =>
  categoricalColumns.find((name) => MULTI_VALUE_HINTS.some((hint) => normalize(name).includes(hint))) ||
  categoricalColumns.find((name) => rows.slice(0, 200).some((row) => /[,;|]/.test(String(row[name] ?? "")))) ||
  null;

type ParsedDate = { date: Date; label: string; time: number };

const parseDateValue = (value: unknown, columnName = ""): ParsedDate | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: value, label: value.toISOString().slice(0, 10), time: value.getTime() };
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase().replace(/[^a-z0-9\s/-]/g, "").trim();
  const monthOnly = MONTH_INDEX[lowered];
  if (monthOnly !== undefined && /month/i.test(columnName)) {
    const date = new Date(Date.UTC(2024, monthOnly, 1));
    return { date, label: MONTH_LABELS[monthOnly], time: date.getTime() };
  }

  const monthWithYear = lowered.match(/^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[\s/-]+(\d{2,4})$/);
  if (monthWithYear) {
    const month = MONTH_INDEX[monthWithYear[1]];
    const year = Number(monthWithYear[2].length === 2 ? `20${monthWithYear[2]}` : monthWithYear[2]);
    const date = new Date(Date.UTC(year, month, 1));
    return { date, label: `${MONTH_LABELS[month]} ${year}`, time: date.getTime() };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const isMonthColumn = /month/i.test(columnName);
  return {
    date,
    label: isMonthColumn ? `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : date.toISOString().slice(0, 10),
    time: date.getTime(),
  };
};

const detectDateColumns = (dataset: Dataset) => {
  const rowSample = dataset.rows.slice(0, NUMERIC_SAMPLE_SIZE);
  return dataset.columns
    .map((column) => column.name)
    .filter((name) => {
      const column = dataset.columns.find((item) => item.name === name);
      if (column?.type === "date" || column?.type === "datetime") return true;
      if (/date|month|year|time|created|updated|timestamp/i.test(name)) return true;
      let valid = 0;
      for (const row of rowSample) {
        if (parseDateValue(row[name], name)) valid += 1;
      }
      return valid >= Math.max(3, rowSample.length * 0.7);
    });
};

const pickMappableGeoColumnFromColumns = (columns: Dataset["columns"], categoricalColumns: string[]) => {
  const typed = columns.find((column) => column.type === "country" || column.type === "city")?.name || null;
  if (typed) return typed;

  return categoricalColumns.find((name) => {
    const normalizedName = normalize(name);
    if (/^(country|nation|city|state|province|territory|location|geo_location)$/.test(normalizedName)) return true;
    if (normalizedName.includes("country") || normalizedName.includes("city")) return true;
    if (normalizedName.includes("state") || normalizedName.includes("province") || normalizedName.includes("territory")) return true;
    return false;
  }) || null;
};

const pickCoordinateColumn = (columnNames: string[], kind: "latitude" | "longitude") => {
  const matcher = kind === "latitude" ? /^(lat|latitude)$/i : /^(lng|lon|long|longitude)$/i;
  return columnNames.find((name) => matcher.test(name.replace(/[^a-z0-9]+/gi, ""))) || null;
};

export const pickPrimaryMetric = (dataset: Dataset) => pickPrimaryMetricFromColumns(detectNumericColumns(dataset));

export const pickPrimaryDimension = (dataset: Dataset) => {
  const numericColumns = new Set(detectNumericColumns(dataset));
  const categoricalColumns = dataset.columns.map((column) => column.name).filter((name) => !numericColumns.has(name));
  return pickPrimaryDimensionFromColumns(dataset.rows || [], categoricalColumns);
};

const buildAnalysisContext = (dataset: Dataset): AnalysisContext => {
  const rows = dataset.rows || [];
  const columnNames = dataset.columns.map((column) => column.name);
  const numericColumns = detectNumericColumns(dataset);
  const numericColumnSet = new Set(numericColumns);
  const categoricalColumns = columnNames.filter((name) => !numericColumnSet.has(name));
  const latitudeColumn = pickCoordinateColumn(columnNames, "latitude");
  const longitudeColumn = pickCoordinateColumn(columnNames, "longitude");
  const metric = pickPrimaryMetricFromColumns(numericColumns);
  const dimension = pickPrimaryDimensionFromColumns(rows, categoricalColumns);
  const dateColumn = detectDateColumns(dataset)[0] || null;
  const geoColumn = pickMappableGeoColumnFromColumns(dataset.columns, categoricalColumns);
  const multiValueColumn = pickMultiValueColumnFromColumns(rows, categoricalColumns);
  const educationColumn = categoricalColumns.find((name) => /education|degree|qualification/i.test(name)) || null;
  const companySizeColumn = categoricalColumns.find((name) => /company.*size|size|category/i.test(name)) || null;
  const relationshipColumn =
    (metric && numericColumns.find((name) => name !== metric && name !== latitudeColumn && name !== longitudeColumn && /experience|years|age|tenure|units|quantity|sold/i.test(name))) ||
    (metric && numericColumns.find((name) => name !== metric && name !== latitudeColumn && name !== longitudeColumn)) ||
    null;

  const numericSummaries = new Map<string, NumericSummary>();
  for (const name of numericColumns) numericSummaries.set(name, createSummary());

  let missing = 0;
  const duplicateSample = new Set<string>();
  const sampleEvery = Math.max(1, Math.ceil(rows.length / DUPLICATE_SAMPLE_SIZE));

  rows.forEach((row, rowIndex) => {
    const duplicateParts: string[] = [];
    for (const columnName of columnNames) {
      const rawValue = row[columnName];
      if (rawValue == null || rawValue === "") missing += 1;
      if (rowIndex % sampleEvery === 0) duplicateParts.push(String(rawValue ?? ""));

      if (numericColumnSet.has(columnName)) {
        const value = asNumber(rawValue);
        const summary = numericSummaries.get(columnName);
        if (value !== null && summary) pushSummaryValue(summary, value);
      }
    }
    if (rowIndex % sampleEvery === 0) duplicateSample.add(duplicateParts.join("|"));
  });

  for (const summary of numericSummaries.values()) summary.values.sort((a, b) => a - b);

  const totalCells = Math.max(rows.length * Math.max(columnNames.length, 1), 1);
  const sampledRows = Math.ceil(rows.length / sampleEvery);
  const duplicatePenalty = sampledRows ? Math.max(0, 1 - duplicateSample.size / sampledRows) : 0;
  const qualityScore = Math.max(0, Math.round((1 - missing / totalCells - duplicatePenalty * 0.1) * 100));

  return {
    rows,
    columnNames,
    numericColumns,
    categoricalColumns,
    metric,
    dimension,
    dateColumn,
    geoColumn,
    latitudeColumn,
    longitudeColumn,
    multiValueColumn,
    educationColumn,
    companySizeColumn,
    relationshipColumn,
    numericSummaries,
    qualityScore,
  };
};

const groupAverage = (rows: DatasetRow[], dimension: string, metric: string, limit = 10) => {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const value = asNumber(row[metric]);
    if (value == null) continue;
    const bucket = buckets.get(label) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(label, bucket);
  }
  return [...buckets.entries()]
    .map(([label, bucket]) => ({ label, value: Number((bucket.sum / bucket.count).toFixed(2)), count: bucket.count }))
    .sort((left, right) => Number(right.value) - Number(left.value))
    .slice(0, limit);
};

const groupCount = (rows: DatasetRow[], dimension: string, limit = 10) => {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }
  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
};

const topCategoryForRows = (rows: DatasetRow[], categoricalColumns: string[], excludedColumn?: string | null) => {
  const column = categoricalColumns.find((name) => name !== excludedColumn && !/id|name|email|phone|address/i.test(name));
  if (!column) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[column] ?? "").trim();
    if (label) counts.set(label, (counts.get(label) || 0) + 1);
  }
  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return top ? `${top[0]} (${pretty(column)})` : null;
};

const geoAggregate = (context: AnalysisContext) => {
  const { rows, geoColumn, latitudeColumn, longitudeColumn, metric, numericColumns, categoricalColumns } = context;
  const metricOptions = numericColumns
    .filter((name) => name !== latitudeColumn && name !== longitudeColumn)
    .slice(0, 6)
    .map((key) => ({ key: `avg_${key}`, label: `Avg ${pretty(key)}` }));
  const geoMetric = pickGeoMetricFromColumns(numericColumns, latitudeColumn, longitudeColumn, metric);
  const selectedMetric = metricOptions.find((item) => item.key === `avg_${geoMetric}`)?.key || metricOptions[0]?.key || "count";
  const buckets = new Map<string, { rows: DatasetRow[]; lat: number | null; lng: number | null }>();

  for (const row of rows) {
    const lat = latitudeColumn ? asNumber(row[latitudeColumn]) : null;
    const lng = longitudeColumn ? asNumber(row[longitudeColumn]) : null;
    const label = (geoColumn && String(row[geoColumn] ?? "").trim()) || (lat !== null && lng !== null ? `${lat.toFixed(2)}, ${lng.toFixed(2)}` : "");
    if (!label) continue;

    const key = lat !== null && lng !== null ? `${label}-${lat.toFixed(3)}-${lng.toFixed(3)}` : label;
    const bucket = buckets.get(key) || { rows: [], lat, lng };
    bucket.rows.push(row);
    if (bucket.lat === null) bucket.lat = lat;
    if (bucket.lng === null) bucket.lng = lng;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([label, bucket]) => {
      const output: PremiumChartDatum = {
        label: label.replace(/-\d+\.\d{3}-[-\d.]+$/, ""),
        value: bucket.rows.length,
        count: bucket.rows.length,
        topCategory: topCategoryForRows(bucket.rows, categoricalColumns, geoColumn) || "Not available",
      };
      if (bucket.lat !== null && bucket.lng !== null) {
        output.lat = bucket.lat;
        output.lng = bucket.lng;
      }
      for (const metricName of numericColumns) {
        if (metricName === latitudeColumn || metricName === longitudeColumn) continue;
        let sum = 0;
        let count = 0;
        for (const row of bucket.rows) {
          const value = asNumber(row[metricName]);
          if (value === null) continue;
          sum += value;
          count += 1;
        }
        output[`avg_${metricName}`] = count ? Number((sum / count).toFixed(2)) : null;
      }
      output.value = Number(output[selectedMetric] ?? output.count ?? 0);
      return output;
    })
    .sort((left, right) => Number(right[selectedMetric] ?? right.count ?? 0) - Number(left[selectedMetric] ?? left.count ?? 0))
    .slice(0, 40);
};

const topMultiValue = (rows: DatasetRow[], column: string, metric?: string, limit = 8) => {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const values = splitMultiValue(row[column]);
    const metricValue = metric ? asNumber(row[metric]) : null;
    for (const item of values) {
      const bucket = buckets.get(item) || { sum: 0, count: 0 };
      bucket.sum += metricValue ?? 1;
      bucket.count += 1;
      buckets.set(item, bucket);
    }
  }
  return [...buckets.entries()]
    .map(([label, bucket]) => ({ label, value: metric ? Number((bucket.sum / bucket.count).toFixed(2)) : bucket.count, count: bucket.count }))
    .sort((left, right) => Number(right.value) - Number(left.value))
    .slice(0, limit);
};

const metricTrendByDate = (rows: DatasetRow[], dateColumn: string, metric: string, limit = 18) => {
  const buckets = new Map<string, { sum: number; count: number; time: number }>();
  for (const row of rows) {
    const parsed = parseDateValue(row[dateColumn], dateColumn);
    const value = asNumber(row[metric]);
    if (!parsed || value === null) continue;

    const bucket = buckets.get(parsed.label) || { sum: 0, count: 0, time: parsed.time };
    bucket.sum += value;
    bucket.count += 1;
    bucket.time = Math.min(bucket.time, parsed.time);
    buckets.set(parsed.label, bucket);
  }

  return [...buckets.entries()]
    .map(([label, bucket]) => ({ label, value: Number((bucket.sum / bucket.count).toFixed(2)), count: bucket.count, time: bucket.time }))
    .sort((left, right) => left.time - right.time)
    .slice(-limit)
    .map(({ label, value, count }) => ({ label, value, count }));
};

const topOutliers = (rows: DatasetRow[], metric: string, limit = 8) =>
  rows
    .map((row, index) => ({ label: String(row.name ?? row.id ?? `Row ${index + 1}`), value: asNumber(row[metric]) }))
    .filter((item): item is { label: string; value: number } => item.value !== null)
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);

const histogram = (summary: NumericSummary | undefined, bins = 7) => {
  if (!summary?.count) return [];
  const min = summary.min;
  const max = summary.max;
  const width = (max - min) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);

  for (const value of summary.values) {
    const index = Math.min(bins - 1, Math.floor((value - min) / width));
    counts[index] += 1;
  }

  return counts.map((value, index) => {
    const start = min + width * index;
    const end = index === bins - 1 ? max : min + width * (index + 1);
    const label = index === 0 ? `<${formatNumber(end, true)}` : index === bins - 1 ? `>${formatNumber(start, true)}` : `${formatNumber(start, true)}-${formatNumber(end, true)}`;
    return { label, value };
  });
};

const scatter = (rows: DatasetRow[], xKey: string, yKey: string) => {
  const step = Math.max(1, Math.ceil(rows.length / MAX_SCATTER_POINTS));
  const points: PremiumChartDatum[] = [];
  for (let index = 0; index < rows.length; index += step) {
    const row = rows[index];
    const x = asNumber(row[xKey]);
    const y = asNumber(row[yKey]);
    if (x !== null && y !== null) points.push({ x, y });
  }
  return points;
};

const correlation = (rows: DatasetRow[], xKey: string, yKey: string) => {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const row of rows) {
    const x = asNumber(row[xKey]);
    const y = asNumber(row[yKey]);
    if (x === null || y === null) continue;
    count += 1;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  if (count < 3) return null;
  const numerator = count * sumXY - sumX * sumY;
  const denominator = Math.sqrt((count * sumX2 - sumX * sumX) * (count * sumY2 - sumY * sumY));
  return denominator ? numerator / denominator : null;
};

const buildKpis = (context: AnalysisContext): PremiumKpi[] => {
  const { rows, metric, dimension, numericSummaries, qualityScore } = context;
  const summary = metric ? numericSummaries.get(metric) : undefined;
  const formatter = metric && /salary|revenue|sales|profit|amount|price|usd|inr/i.test(metric) ? formatMoney : formatNumber;
  const average = summary?.count ? summary.sum / summary.count : null;
  const median = medianFromSorted(summary?.values || []);
  const max = summary?.count ? summary.max : null;

  return [
    { id: "total-records", title: "Total Records", value: formatNumber(rows.length), rawValue: rows.length, subtitle: "Analyzed rows", delta: "Live data", icon: "rows" },
    { id: "average-metric", title: metric ? `Avg ${pretty(metric)}` : "Average Metric", value: formatter(average), rawValue: average ?? undefined, subtitle: "Primary metric", icon: "average" },
    { id: "median-metric", title: metric ? `Median ${pretty(metric)}` : "Median Metric", value: formatter(median), rawValue: median ?? undefined, subtitle: "Central tendency", icon: "median" },
    { id: "highest-metric", title: metric ? `Highest ${pretty(metric)}` : "Highest Metric", value: formatter(max), rawValue: max ?? undefined, subtitle: "Maximum value", icon: "max" },
    { id: "dimension-count", title: dimension ? `${pretty(dimension)} count` : "Segments", value: dimension ? formatNumber(uniqueCount(rows, dimension)) : "-", rawValue: dimension ? uniqueCount(rows, dimension) : undefined, subtitle: "Distinct segments", icon: "segments" },
    { id: "quality-score", title: "Data Quality", value: `${qualityScore}/100`, rawValue: qualityScore, subtitle: "Completeness score", icon: "quality" },
  ];
};

const buildCharts = (context: AnalysisContext): PremiumChart[] => {
  const { rows, metric, dimension, dateColumn, geoColumn, latitudeColumn, longitudeColumn, educationColumn, companySizeColumn, multiValueColumn, relationshipColumn, numericSummaries, numericColumns } = context;
  const charts: PremiumChart[] = [];

  if (metric && dimension) charts.push({ id: "avg-metric-by-dimension", title: `Average ${pretty(metric)} by ${pretty(dimension)}`, subtitle: "Segment comparison", type: "bar", xKey: "label", yKey: "value", data: groupAverage(rows, dimension, metric, 10) });
  if (metric) charts.push({ id: "metric-distribution", title: `${pretty(metric)} Distribution`, subtitle: "Histogram", type: "histogram", xKey: "label", yKey: "value", data: histogram(numericSummaries.get(metric), 7) });
  if (metric && relationshipColumn) charts.push({ id: "metric-vs-relationship", title: `${pretty(metric)} vs ${pretty(relationshipColumn)}`, subtitle: "Sampled scatter", type: "scatter", xKey: "x", yKey: "y", data: scatter(rows, relationshipColumn, metric) });
  if (educationColumn || dimension) charts.push({ id: "category-distribution", title: `${pretty(educationColumn || dimension || "Category")} Distribution`, subtitle: "Donut chart", type: "donut", xKey: "label", yKey: "value", data: groupCount(rows, educationColumn || dimension || "", 8) });
  if (metric && dimension) charts.push({ id: "top-dimension-ranking", title: `Top ${pretty(dimension)} by Avg ${pretty(metric)}`, subtitle: "Ranking table", type: "table", xKey: "label", yKey: "value", data: groupAverage(rows, dimension, metric, 10) });
  if (multiValueColumn) charts.push({ id: "top-multivalue", title: `Top ${pretty(multiValueColumn)} ${metric ? `by Avg ${pretty(metric)}` : "by Records"}`, subtitle: "Multi-value ranking", type: "table", xKey: "label", yKey: "value", data: topMultiValue(rows, multiValueColumn, metric || undefined, 8) });
  if (metric && dateColumn) {
    const trendData = metricTrendByDate(rows, dateColumn, metric);
    if (trendData.length) charts.push({ id: "metric-trend", title: `${pretty(metric)} Trend by ${pretty(dateColumn)}`, subtitle: "Time trend", type: "line", xKey: "label", yKey: "value", data: trendData });
  }
  if (metric) charts.push({ id: "metric-outliers", title: `Top ${pretty(metric)} Outliers`, subtitle: "Highest records", type: "table", xKey: "label", yKey: "value", data: topOutliers(rows, metric, 8) });
  if ((geoColumn || (latitudeColumn && longitudeColumn)) && metric) {
    const geoMetric = pickGeoMetricFromColumns(numericColumns, latitudeColumn, longitudeColumn, metric);
    const metricOptions = numericColumns
      .filter((name) => name !== latitudeColumn && name !== longitudeColumn)
      .slice(0, 6)
      .map((key) => ({ key: `avg_${key}`, label: `Avg ${pretty(key)}` }));
    const data = geoAggregate(context);
    if (data.length) {
      charts.push({
        id: "geo-analysis",
        title: geoColumn ? `Geo Analysis by ${pretty(geoColumn)}` : "Geo Analysis by coordinates",
        subtitle: geoMetric ? `Color by average ${pretty(geoMetric)}` : "Records by location",
        type: "map",
        xKey: "label",
        yKey: metricOptions.find((item) => item.key === `avg_${geoMetric}`)?.key || metricOptions[0]?.key || "count",
        metricOptions: [{ key: "count", label: "Record count" }, ...metricOptions],
        data,
      });
    }
  }
  if (metric && companySizeColumn && companySizeColumn !== dimension) charts.push({ id: "avg-metric-by-company-size", title: `Average ${pretty(metric)} by ${pretty(companySizeColumn)}`, subtitle: "Organization segment", type: "bar", xKey: "label", yKey: "value", data: groupAverage(rows, companySizeColumn, metric, 8) });

  return charts;
};

const buildInsights = (context: AnalysisContext, charts: PremiumChart[]): PremiumInsight[] => {
  const { rows, metric, dimension, relationshipColumn } = context;
  const topSegment = charts.find((chart) => chart.id === "avg-metric-by-dimension")?.data[0];
  const topSkill = charts.find((chart) => chart.id === "top-multivalue")?.data[0];
  const corr = metric && relationshipColumn ? correlation(rows, relationshipColumn, metric) : null;

  return [
    { id: "highest-segment", title: "Highest Performing Segment", message: topSegment ? `${topSegment.label} has the highest average ${pretty(metric || "metric")} in this dataset.` : "Upload a richer dataset to identify top performing segments.", tone: "gold", action: "View Details" },
    { id: "top-correlation", title: "Top Correlation", message: corr != null && relationshipColumn ? `${pretty(relationshipColumn)} and ${pretty(metric || "metric")} show ${Math.abs(corr) > 0.6 ? "strong" : "moderate"} ${corr >= 0 ? "positive" : "negative"} correlation (${corr.toFixed(2)}).` : "No reliable numeric correlation was detected yet.", tone: "cyan", action: "View Analysis" },
    { id: "top-signal", title: "In-Demand Skills", message: topSkill ? `${topSkill.label} is one of the strongest multi-value signals in this dataset.` : "No multi-value skill column was detected.", tone: "violet", action: "Explore Skills" },
    { id: "recommendation", title: "Recommendation", message: metric && dimension ? `Use ${pretty(dimension)} filters and ${pretty(metric)} segments to find high-value opportunities.` : "Add a numeric metric and categorical dimensions to unlock richer recommendations.", tone: "emerald", action: "View Roadmap" },
  ];
};

const buildReasoning = (hasDataset: boolean, hasAi: boolean): AgentReasoningStep[] => [
  { id: "understanding", label: "Understanding query", status: "completed" },
  { id: "retrieval", label: "Retrieving dataset summary", status: hasDataset ? "completed" : "pending" },
  { id: "analysis", label: "Planning analysis", status: hasDataset ? "completed" : "pending" },
  { id: "response", label: hasAi ? "Generating AI response" : "Generating local response", status: hasDataset ? "completed" : "pending" },
];

const buildRagPipeline = (status: { hasDataset: boolean; hasSchema: boolean; hasEmbedding: boolean; hasVector: boolean; hasLLM: boolean }): RagPipelineStep[] => [
  { id: "ingestion", title: "Data Ingestion", subtitle: "CSV / XLSX / PDF", status: status.hasDataset ? "completed" : "pending" },
  { id: "chunking", title: "Dataset Structure Review", subtitle: "Smart schema chunks", status: status.hasSchema ? "completed" : "pending" },
  { id: "embedding", title: "Data Understanding", subtitle: "nomic-embed-text", status: status.hasEmbedding ? "completed" : "skipped" },
  { id: "vector", title: "Knowledge Index", subtitle: "Schema RAG", status: status.hasVector ? "completed" : "skipped" },
  { id: "llm", title: "AI Analysis", subtitle: status.hasLLM ? "Active" : "Local Analytics", status: "completed" },
];

export const buildPremiumDashboardModel = (
  dataset: Dataset,
  options: { aiResult?: Record<string, unknown> | null; aiHealth?: Record<string, unknown> | null; warnings?: string[] } = {},
): PremiumDashboardModel => {
  const context = buildAnalysisContext(dataset);
  const charts = buildCharts(context);
  const hasAi = Boolean(options.aiResult?.success || options.aiResult?.dashboard || options.aiResult?.dashboardPlan);
  const rag = options.aiResult?.rag as { used?: boolean; matches?: unknown[] } | undefined;
  const ragEnabled = Boolean(rag?.used || rag?.matches?.length || options.aiHealth);

  return {
    generatedAt: new Date().toISOString(),
    primaryMetric: context.metric,
    primaryDimension: context.dimension,
    rows: context.rows,
    kpis: buildKpis(context),
    charts,
    insights: buildInsights(context, charts),
    reasoning: buildReasoning(context.rows.length > 0, hasAi),
    ragPipeline: buildRagPipeline({
      hasDataset: context.rows.length > 0,
      hasSchema: context.columnNames.length > 0,
      hasEmbedding: ragEnabled,
      hasVector: ragEnabled,
      hasLLM: hasAi,
    }),
    qualityScore: context.qualityScore,
    provider: String(options.aiResult?.provider || "schema-safe"),
    model: String(options.aiResult?.model || "local-rag"),
    warnings: options.warnings || [],
  };
};
