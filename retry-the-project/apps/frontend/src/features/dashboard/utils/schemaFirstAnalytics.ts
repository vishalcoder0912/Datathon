import type { Dataset, DatasetRow } from "@/features/data/model/dataStore";
import type { PremiumChart, PremiumChartDatum, PremiumDashboardModel, PremiumInsight, PremiumKpi, RagPipelineStep } from "@/features/dashboard/types/premiumDashboardTypes";
import { extractGeoLocation } from "@/features/dashboard/utils/geoResolver";

type Role = "metric" | "dimension" | "date" | "entity" | "geo" | "identifier" | "text" | "ignored";
type ColumnProfile = {
  name: string;
  declaredType?: string;
  role: Role;
  semanticType: string;
  nonNullCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  uniqueRatio: number;
  numericCount: number;
  dateCount: number;
  geoCount: number;
  examples: string[];
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
};

type SchemaProfile = {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  domain: string;
  qualityScore: number;
  primaryMetric: string | null;
  primaryDimension: string | null;
  primaryDate: string | null;
  primaryEntity: string | null;
  geoColumn: string | null;
  columns: ColumnProfile[];
  warnings: string[];
};

const moneyHints = /billing|amount|revenue|sales|profit|price|cost|salary|income|charge|payment|total|usd|inr/i;
const metricHints = /billing|amount|revenue|sales|profit|price|cost|salary|income|score|rate|value|total|age|quantity|count|duration|days/i;
const dimensionHints = /gender|blood|condition|category|segment|department|status|type|class|region|state|city|country/i;
const dateHints = /date|admission|discharge|created|updated|timestamp|month|year/i;
const entityHints = /hospital|facility|clinic|doctor|provider|customer|client|vendor|company|school|college|branch|store|product|name/i;
const idHints = /^(__rowid|row_id|id|uuid|guid|email|phone|mobile|url|link)$/i;
const ignoredMetricHints = /latitude|longitude|lat|lng|lon|id|pin|zip|postal|phone|mobile/i;

const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: unknown, columnName: string) => {
  const raw = String(value ?? "").trim();
  if (!raw || /^\d{1,3}$/.test(raw)) return null;
  if (!dateHints.test(columnName) && !/[/-]/.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatNumber = (value: number | null | undefined, compact = false) => {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { notation: compact ? "compact" : "standard", maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
};

const formatMetric = (column: string | null, value: number | null | undefined) => {
  if (column && moneyHints.test(column)) return value == null ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return formatNumber(value);
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function profileColumn(dataset: Dataset, columnName: string): ColumnProfile {
  const declaredType = dataset.columns.find((column) => column.name === columnName)?.type;
  const values = dataset.rows.map((row) => row[columnName]);
  const filled = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  const uniqueValues = Array.from(new Set(filled));
  const numbers = values.map(asNumber).filter((value): value is number => value !== null);
  const dates = values.map((value) => parseDate(value, columnName)).filter((value): value is Date => value !== null);
  const geoCount = uniqueValues.slice(0, 250).filter((value) => extractGeoLocation(value)).length;
  const uniqueRatio = uniqueValues.length / Math.max(filled.length, 1);
  const numericRatio = numbers.length / Math.max(filled.length, 1);
  const dateRatio = dates.length / Math.max(filled.length, 1);
  const normalized = columnName.toLowerCase();
  const missingCount = dataset.rows.length - filled.length;

  let role: Role = "text";
  let semanticType = declaredType || "text";

  if (idHints.test(normalized) || normalized.endsWith("_id")) {
    role = "identifier";
    semanticType = "identifier";
  } else if (["latitude", "longitude", "country", "city"].includes(declaredType || "") || /latitude|longitude|\blat\b|\blng\b|country|city|state|province|territory/i.test(columnName) || geoCount >= 2) {
    role = "geo";
    semanticType = declaredType || "location";
  } else if ((declaredType === "date" || declaredType === "datetime" || dateHints.test(columnName)) && dateRatio >= 0.6) {
    role = "date";
    semanticType = "date";
  } else if (!ignoredMetricHints.test(columnName) && (declaredType === "number" || declaredType === "currency" || numericRatio >= 0.7) && metricHints.test(columnName)) {
    role = "metric";
    semanticType = moneyHints.test(columnName) ? "currency" : "numeric";
  } else if (!ignoredMetricHints.test(columnName) && numericRatio >= 0.85 && uniqueValues.length > 8) {
    role = "metric";
    semanticType = "numeric";
  } else if (entityHints.test(columnName) && uniqueValues.length > 20) {
    role = "entity";
    semanticType = "entity";
  } else if ((declaredType === "category" || dimensionHints.test(columnName) || uniqueValues.length <= 50) && uniqueValues.length > 1) {
    role = "dimension";
    semanticType = declaredType || "category";
  }

  if (role === "metric" && /age/i.test(columnName)) semanticType = "numeric_relationship";
  if (filled.length === 0) role = "ignored";

  const sum = numbers.reduce((total, value) => total + value, 0);
  return {
    name: columnName,
    declaredType,
    role,
    semanticType,
    nonNullCount: filled.length,
    missingCount,
    missingPct: Math.round((missingCount / Math.max(dataset.rows.length, 1)) * 10000) / 100,
    uniqueCount: uniqueValues.length,
    uniqueRatio: Math.round(uniqueRatio * 10000) / 100,
    numericCount: numbers.length,
    dateCount: dates.length,
    geoCount,
    examples: uniqueValues.slice(0, 5),
    min: numbers.length ? Math.min(...numbers) : undefined,
    max: numbers.length ? Math.max(...numbers) : undefined,
    avg: numbers.length ? sum / numbers.length : undefined,
    median: numbers.length ? median(numbers) ?? undefined : undefined,
  };
}

function buildSchemaProfile(dataset: Dataset): SchemaProfile {
  const columns = dataset.columns.map((column) => profileColumn(dataset, column.name));
  const metricColumns = columns.filter((column) => column.role === "metric" && !/age/i.test(column.name));
  const relationshipMetrics = columns.filter((column) => column.role === "metric");
  const dimensions = columns.filter((column) => column.role === "dimension");
  const dates = columns.filter((column) => column.role === "date");
  const entities = columns.filter((column) => column.role === "entity");
  const geoColumns = columns.filter((column) => column.role === "geo");
  const totalCells = Math.max(dataset.rows.length * Math.max(dataset.columns.length, 1), 1);
  const missingCells = columns.reduce((sum, column) => sum + column.missingCount, 0);
  const domain = columns.some((column) => /hospital|doctor|medical|billing|blood|condition|admission/i.test(column.name)) ? "healthcare" : "general";
  const primaryMetric = metricColumns.find((column) => moneyHints.test(column.name))?.name || metricColumns[0]?.name || relationshipMetrics[0]?.name || null;
  const primaryDimension = dimensions.find((column) => /gender|blood|condition|category|segment/i.test(column.name))?.name || dimensions[0]?.name || null;
  const primaryDate = dates.find((column) => /admission|date|created|updated/i.test(column.name))?.name || dates[0]?.name || null;
  const primaryEntity = entities.find((column) => /hospital|facility|clinic|doctor/i.test(column.name))?.name || entities[0]?.name || null;
  const geoColumn = geoColumns.find((column) => /city|country|state|province|territory/i.test(column.name))?.name || geoColumns.find((column) => column.geoCount >= 2)?.name || null;
  const warnings: string[] = [];

  if (primaryEntity && !geoColumn && /hospital|facility|clinic/i.test(primaryEntity)) warnings.push("Hospital/entity fields are not map coordinates. Add City, State, Country, Latitude, or Longitude for real geo analysis.");
  if (columns.some((column) => /age/i.test(column.name) && column.role === "metric") && primaryDate !== "Age") warnings.push("Age is treated as a numeric relationship field, not a trend date.");
  if (!primaryMetric) warnings.push("No reliable primary numeric metric was detected.");
  if (!primaryDimension) warnings.push("No reliable categorical dimension was detected.");

  return {
    datasetName: dataset.name,
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    domain,
    qualityScore: Math.max(0, Math.round((1 - missingCells / totalCells) * 100)),
    primaryMetric,
    primaryDimension,
    primaryDate,
    primaryEntity,
    geoColumn,
    columns,
    warnings,
  };
}

const groupAverage = (rows: DatasetRow[], dimension: string, metric: string, limit = 10): PremiumChartDatum[] => {
  const buckets = new Map<string, { sum: number; count: number }>();
  rows.forEach((row) => {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const value = asNumber(row[metric]);
    if (value === null) return;
    const bucket = buckets.get(label) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(label, bucket);
  });
  return [...buckets.entries()].map(([label, bucket]) => ({ label, value: Number((bucket.sum / bucket.count).toFixed(2)), count: bucket.count })).sort((a, b) => Number(b.value) - Number(a.value)).slice(0, limit);
};

const groupCount = (rows: DatasetRow[], dimension: string, limit = 10): PremiumChartDatum[] => {
  const buckets = new Map<string, number>();
  rows.forEach((row) => {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });
  return [...buckets.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => Number(b.value) - Number(a.value)).slice(0, limit);
};

const histogram = (values: number[], bins = 7): PremiumChartDatum[] => {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((value) => counts[Math.min(bins - 1, Math.floor((value - min) / width))] += 1);
  return counts.map((value, index) => {
    const start = min + width * index;
    const end = index === bins - 1 ? max : min + width * (index + 1);
    const label = index === 0 ? `<${formatNumber(end, true)}` : index === bins - 1 ? `>${formatNumber(start, true)}` : `${formatNumber(start, true)}-${formatNumber(end, true)}`;
    return { label, value };
  });
};

const trend = (rows: DatasetRow[], dateColumn: string, metric: string): PremiumChartDatum[] => {
  const buckets = new Map<string, { sum: number; count: number; time: number }>();
  rows.forEach((row) => {
    const date = parseDate(row[dateColumn], dateColumn);
    const value = asNumber(row[metric]);
    if (!date || value === null) return;
    const label = date.toISOString().slice(0, 10);
    const bucket = buckets.get(label) || { sum: 0, count: 0, time: date.getTime() };
    bucket.sum += value;
    bucket.count += 1;
    bucket.time = Math.min(bucket.time, date.getTime());
    buckets.set(label, bucket);
  });
  return [...buckets.entries()].map(([label, bucket]) => ({ label, value: Number((bucket.sum / bucket.count).toFixed(2)), count: bucket.count, time: bucket.time })).sort((a, b) => Number(a.time) - Number(b.time)).slice(-18).map(({ label, value, count }) => ({ label, value, count }));
};

const scatter = (rows: DatasetRow[], xKey: string, yKey: string): PremiumChartDatum[] => {
  const step = Math.max(1, Math.ceil(rows.length / 1200));
  const data: PremiumChartDatum[] = [];
  for (let index = 0; index < rows.length; index += step) {
    const x = asNumber(rows[index][xKey]);
    const y = asNumber(rows[index][yKey]);
    if (x !== null && y !== null) data.push({ x, y });
  }
  return data;
};

const correlation = (rows: DatasetRow[], xKey: string, yKey: string) => {
  let n = 0, sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  rows.forEach((row) => {
    const x = asNumber(row[xKey]);
    const y = asNumber(row[yKey]);
    if (x === null || y === null) return;
    n += 1; sx += x; sy += y; sxy += x * y; sx2 += x * x; sy2 += y * y;
  });
  const denominator = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  return n >= 3 && denominator ? (n * sxy - sx * sy) / denominator : null;
};

export const buildPremiumDashboardModel = (dataset: Dataset): PremiumDashboardModel => {
  const schema = buildSchemaProfile(dataset);
  const rows = dataset.rows;
  const metric = schema.primaryMetric;
  const dimension = schema.primaryDimension;
  const dateColumn = schema.primaryDate;
  const entity = schema.primaryEntity;
  const relationship = schema.columns.find((column) => column.role === "metric" && column.name !== metric && /age|quantity|count|days|duration|years/i.test(column.name))?.name || null;
  const metricProfile = schema.columns.find((column) => column.name === metric);
  const metricValues = metric ? rows.map((row) => asNumber(row[metric])).filter((value): value is number => value !== null) : [];

  const kpis: PremiumKpi[] = [
    { id: "total-records", title: "Total Records", value: formatNumber(rows.length), rawValue: rows.length, subtitle: "Real uploaded rows", delta: "Live data", icon: "rows" },
    { id: "average-metric", title: metric ? `Avg ${titleCase(metric)}` : "Average Metric", value: formatMetric(metric, metricProfile?.avg), rawValue: metricProfile?.avg, subtitle: "Calculated from rows", icon: "average" },
    { id: "median-metric", title: metric ? `Median ${titleCase(metric)}` : "Median Metric", value: formatMetric(metric, metricProfile?.median), rawValue: metricProfile?.median, subtitle: "Calculated from rows", icon: "median" },
    { id: "highest-metric", title: metric ? `Highest ${titleCase(metric)}` : "Highest Metric", value: formatMetric(metric, metricProfile?.max), rawValue: metricProfile?.max, subtitle: "Maximum real value", icon: "max" },
    { id: "dimension-count", title: dimension ? `${titleCase(dimension)} count` : "Segments", value: dimension ? formatNumber(schema.columns.find((column) => column.name === dimension)?.uniqueCount) : "-", subtitle: "Distinct real values", icon: "segments" },
    { id: "quality-score", title: "Data Quality", value: `${schema.qualityScore}/100`, rawValue: schema.qualityScore, subtitle: "Completeness score", icon: "quality" },
  ];

  const charts: PremiumChart[] = [];
  if (metric && dimension) charts.push({ id: "avg-metric-by-dimension", title: `Average ${titleCase(metric)} by ${titleCase(dimension)}`, subtitle: "Real segment comparison", type: "bar", xKey: "label", yKey: "value", data: groupAverage(rows, dimension, metric, 10) });
  if (metric) charts.push({ id: "metric-distribution", title: `${titleCase(metric)} Distribution`, subtitle: "Real histogram", type: "histogram", xKey: "label", yKey: "value", data: histogram(metricValues, 7) });
  if (metric && relationship) charts.push({ id: "metric-vs-relationship", title: `${titleCase(metric)} vs ${titleCase(relationship)}`, subtitle: "Sampled real scatter", type: "scatter", xKey: "x", yKey: "y", data: scatter(rows, relationship, metric) });
  if (dimension) charts.push({ id: "dimension-distribution", title: `${titleCase(dimension)} Distribution`, subtitle: "Real category count", type: "donut", xKey: "label", yKey: "value", data: groupCount(rows, dimension, 8) });
  if (metric && dimension) charts.push({ id: "top-dimension-ranking", title: `Top ${titleCase(dimension)} by Avg ${titleCase(metric)}`, subtitle: "Real ranking table", type: "table", xKey: "label", yKey: "value", data: groupAverage(rows, dimension, metric, 10) });
  if (metric && entity) charts.push({ id: "top-entity-ranking", title: `Top ${titleCase(entity)} by Avg ${titleCase(metric)}`, subtitle: "Entity ranking", type: "table", xKey: "label", yKey: "value", data: groupAverage(rows, entity, metric, 8) });
  if (metric && dateColumn) charts.push({ id: "metric-trend", title: `${titleCase(metric)} Trend by ${titleCase(dateColumn)}`, subtitle: "Real date trend", type: "line", xKey: "label", yKey: "value", data: trend(rows, dateColumn, metric) });
  if (metric) charts.push({ id: "metric-outliers", title: `Top ${titleCase(metric)} Outliers`, subtitle: "Highest real records", type: "table", xKey: "label", yKey: "value", data: rows.map((row, index) => ({ label: String(row.Name ?? row.name ?? row.id ?? `Row ${index + 1}`), value: asNumber(row[metric]) })).filter((item): item is { label: string; value: number } => item.value !== null).sort((a, b) => b.value - a.value).slice(0, 8) });

  const topSegment = charts.find((chart) => chart.id === "avg-metric-by-dimension")?.data[0];
  const topEntity = charts.find((chart) => chart.id === "top-entity-ranking")?.data[0];
  const corr = metric && relationship ? correlation(rows, relationship, metric) : null;
  const insights: PremiumInsight[] = [
    { id: "schema-detected", title: "Schema Detected", message: `${schema.domain} dataset detected with ${schema.columns.filter((column) => column.role === "metric").length} metrics, ${schema.columns.filter((column) => column.role === "dimension").length} dimensions, and ${schema.columns.filter((column) => column.role === "entity").length} entity fields.`, tone: "violet", action: "Review Schema" },
    { id: "highest-segment", title: "Highest Performing Segment", message: topSegment && metric ? `${topSegment.label} has the highest average ${titleCase(metric)} from real row calculations.` : "A reliable top segment could not be calculated yet.", tone: "gold", action: "View Segment" },
    { id: "correlation", title: "Relationship Check", message: corr == null || Math.abs(corr) < 0.05 ? `${titleCase(relationship || "Selected numeric field")} and ${titleCase(metric || "metric")} show no meaningful relationship in the current data.` : `${titleCase(relationship || "Selected numeric field")} and ${titleCase(metric || "metric")} show ${corr > 0 ? "positive" : "negative"} relationship (${corr.toFixed(2)}).`, tone: "cyan", action: "Review Analysis" },
    { id: "entity-signal", title: "Key Operational Signal", message: topEntity && entity ? `${topEntity.label} is one of the strongest ${titleCase(entity)} signals based on average ${titleCase(metric || "metric")}.` : "No reliable operational entity signal was detected.", tone: "emerald", action: "Review Signal" },
  ];

  const ragPipeline: RagPipelineStep[] = [
    { id: "schema", title: "Schema Profiling", subtitle: `${schema.columnCount} columns classified`, status: "completed" },
    { id: "quality", title: "Data Quality", subtitle: `${schema.qualityScore}/100 completeness score`, status: "completed" },
    { id: "analytics", title: "Real Row Analytics", subtitle: `${rows.length.toLocaleString()} rows calculated locally`, status: "completed" },
    { id: "guardian", title: "Dashboard Guardian", subtitle: schema.warnings.length ? `${schema.warnings.length} warning checks` : "No blocking issues", status: "completed" },
    { id: "agent", title: "Agentic Explanation", subtitle: "Ollama/backend optional, local fallback ready", status: "active" },
  ];

  return {
    generatedAt: new Date().toISOString(),
    primaryMetric: schema.primaryMetric,
    primaryDimension: schema.primaryDimension,
    rows,
    kpis,
    charts,
    insights,
    reasoning: [
      { id: "profile", label: "Profiling schema", status: "completed" },
      { id: "calculate", label: "Calculating real data", status: "completed" },
      { id: "validate", label: "Validating dashboard logic", status: "completed" },
      { id: "explain", label: "Preparing agent explanation", status: "completed" },
    ],
    ragPipeline,
    qualityScore: schema.qualityScore,
    provider: "schema-first-real-analytics",
    model: "deterministic-engine + optional-ollama-agent",
    warnings: schema.warnings,
    schemaProfile: schema,
  } as PremiumDashboardModel;
};

export { buildSchemaProfile };
