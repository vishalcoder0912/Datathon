import type { Dataset, DatasetRow } from "@/features/data/model/dataStore";
import type { PremiumChart, PremiumChartDatum, PremiumDashboardModel, PremiumInsight, PremiumKpi, RagPipelineStep } from "@/features/dashboard/types/premiumDashboardTypes";
import { extractGeoLocation } from "@/features/dashboard/utils/geoResolver";

const NUMERIC_HINTS = ["billing", "amount", "revenue", "sales", "profit", "price", "income", "salary", "score", "cost", "usd", "inr", "value"];
const DIMENSION_HINTS = ["gender", "blood", "condition", "category", "segment", "department", "type", "status", "region", "country", "state", "city"];
const ENTITY_HINTS = ["hospital", "facility", "clinic", "doctor", "provider", "company", "customer", "vendor", "branch"];
const MULTI_VALUE_HINTS = ["skills", "skill", "languages", "language", "frameworks", "framework", "tools", "tags", "interests"];
const EXCLUDED_DIMENSION_HINTS = /name|email|phone|address|url|link|id|date|time/i;
const EXCLUDED_MULTI_VALUE_HINTS = /hospital|facility|clinic|doctor|provider|name|address|company|llc|inc|ltd|center|centre/i;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value: number | null | undefined, compact = false) => {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { notation: compact ? "compact" : "standard", maximumFractionDigits: value > 100 ? 0 : 1 }).format(value);
};

const formatMoney = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
};

const isMoneyColumn = (name: string) => /billing|amount|sales|revenue|salary|income|price|cost|profit|total|usd|inr/i.test(name);
const metricFormatter = (name: string | null) => (name && isMoneyColumn(name) ? formatMoney : formatNumber);

type NumericSummary = { count: number; sum: number; min: number; max: number; values: number[] };

const summarizeNumbers = (rows: DatasetRow[], column: string): NumericSummary => {
  const summary: NumericSummary = { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, values: [] };
  for (const row of rows) {
    const value = asNumber(row[column]);
    if (value === null) continue;
    summary.count += 1;
    summary.sum += value;
    summary.min = Math.min(summary.min, value);
    summary.max = Math.max(summary.max, value);
    summary.values.push(value);
  }
  summary.values.sort((left, right) => left - right);
  return summary;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
};

const uniqueCount = (rows: DatasetRow[], column: string) => new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean)).size;

const detectNumericColumns = (dataset: Dataset) => {
  const sample = dataset.rows.slice(0, 1000);
  return dataset.columns.map((column) => column.name).filter((name) => {
    const column = dataset.columns.find((item) => item.name === name);
    if (["number", "currency", "percentage", "latitude", "longitude"].includes(column?.type || "")) return true;
    if (/^(__rowid|row_id|id)$/i.test(normalize(name))) return false;
    const valid = sample.filter((row) => asNumber(row[name]) !== null).length;
    return valid >= Math.max(3, sample.length * 0.6);
  });
};

const pickPrimaryMetric = (numericColumns: string[]) => {
  const safe = numericColumns.filter((name) => !/lat|latitude|lng|lon|longitude|id|row/i.test(name));
  return safe.find((name) => NUMERIC_HINTS.some((hint) => normalize(name).includes(hint))) || safe[0] || null;
};

const pickPrimaryDimension = (rows: DatasetRow[], categoricalColumns: string[]) => {
  const clean = categoricalColumns.filter((name) => !EXCLUDED_DIMENSION_HINTS.test(name));
  const preferred = clean.find((name) => DIMENSION_HINTS.some((hint) => normalize(name).includes(hint)) && uniqueCount(rows, name) <= 50);
  if (preferred) return preferred;
  return clean.map((name) => ({ name, count: uniqueCount(rows, name) })).filter((item) => item.count > 1 && item.count <= 50).sort((a, b) => a.count - b.count)[0]?.name || clean[0] || null;
};

const pickEntityColumn = (rows: DatasetRow[], categoricalColumns: string[], dimension: string | null) => {
  const preferred = categoricalColumns.find((name) => name !== dimension && ENTITY_HINTS.some((hint) => normalize(name).includes(hint)));
  if (preferred) return preferred;
  return categoricalColumns.map((name) => ({ name, count: uniqueCount(rows, name) })).filter((item) => item.name !== dimension && item.count > 50 && !EXCLUDED_DIMENSION_HINTS.test(item.name)).sort((a, b) => b.count - a.count)[0]?.name || null;
};

const pickMultiValueColumn = (rows: DatasetRow[], categoricalColumns: string[]) => {
  const named = categoricalColumns.find((name) => MULTI_VALUE_HINTS.some((hint) => normalize(name).includes(hint)) && !EXCLUDED_MULTI_VALUE_HINTS.test(name));
  if (named) return named;
  return categoricalColumns.find((name) => !EXCLUDED_MULTI_VALUE_HINTS.test(name) && rows.slice(0, 200).some((row) => /[,;|]/.test(String(row[name] ?? "")))) || null;
};

const pickDateColumn = (dataset: Dataset) => {
  const candidates = dataset.columns.filter((column) => column.type === "date" || column.type === "datetime" || /date|admission|discharge|created|updated|timestamp|month|year/i.test(column.name));
  return candidates.find((column) => dataset.rows.slice(0, 200).some((row) => parseDate(row[column.name], column.name)))?.name || null;
};

const parseDate = (value: unknown, columnName = "") => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/date|admission|discharge|created|updated|timestamp|month|year/i.test(columnName) && !/[/-]/.test(raw)) return null;
  if (/^\d{1,3}$/.test(raw)) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { label: date.toISOString().slice(0, 10), time: date.getTime() };
};

const pickRelationshipColumn = (numericColumns: string[], metric: string | null, latitude: string | null, longitude: string | null) => {
  if (!metric) return null;
  const candidates = numericColumns.filter((name) => name !== metric && name !== latitude && name !== longitude && !/id|row/i.test(name));
  return candidates.find((name) => /age|experience|years|tenure|quantity|count/i.test(name)) || candidates[0] || null;
};

const pickCoordinateColumn = (columns: string[], kind: "lat" | "lng") => {
  const matcher = kind === "lat" ? /^(lat|latitude)$/i : /^(lng|lon|long|longitude)$/i;
  return columns.find((name) => matcher.test(name.replace(/[^a-z0-9]/gi, ""))) || null;
};

const pickGeoColumn = (dataset: Dataset, categoricalColumns: string[]) => {
  const typed = dataset.columns.find((column) => ["country", "city"].includes(column.type))?.name || null;
  if (typed) return typed;
  const schema = categoricalColumns.find((name) => /country|nation|city|state|province|territory|location|geo/i.test(name));
  if (schema) return schema;
  return categoricalColumns.find((name) => {
    const sample = Array.from(new Set(dataset.rows.slice(0, 300).map((row) => String(row[name] ?? "").trim()).filter(Boolean))).slice(0, 80);
    if (!sample.length) return false;
    const hits = sample.filter((value) => extractGeoLocation(value)).length;
    return hits >= 2 && hits / sample.length >= 0.35;
  }) || null;
};

const groupAverage = (rows: DatasetRow[], dimension: string, metric: string, limit = 10): PremiumChartDatum[] => {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const value = asNumber(row[metric]);
    if (value === null) continue;
    const bucket = buckets.get(label) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(label, bucket);
  }
  return [...buckets.entries()].map(([label, bucket]) => ({ label, value: Number((bucket.sum / bucket.count).toFixed(2)), count: bucket.count })).sort((a, b) => Number(b.value) - Number(a.value)).slice(0, limit);
};

const groupCount = (rows: DatasetRow[], dimension: string, limit = 10): PremiumChartDatum[] => {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }
  return [...buckets.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => Number(b.value) - Number(a.value)).slice(0, limit);
};

const histogram = (summary: NumericSummary, bins = 7): PremiumChartDatum[] => {
  if (!summary.count) return [];
  const width = (summary.max - summary.min) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  for (const value of summary.values) counts[Math.min(bins - 1, Math.floor((value - summary.min) / width))] += 1;
  return counts.map((value, index) => {
    const start = summary.min + width * index;
    const end = index === bins - 1 ? summary.max : summary.min + width * (index + 1);
    const label = index === 0 ? `<${formatNumber(end, true)}` : index === bins - 1 ? `>${formatNumber(start, true)}` : `${formatNumber(start, true)}-${formatNumber(end, true)}`;
    return { label, value };
  });
};

const scatter = (rows: DatasetRow[], xKey: string, yKey: string): PremiumChartDatum[] => {
  const step = Math.max(1, Math.ceil(rows.length / 1200));
  const points: PremiumChartDatum[] = [];
  for (let index = 0; index < rows.length; index += step) {
    const x = asNumber(rows[index][xKey]);
    const y = asNumber(rows[index][yKey]);
    if (x !== null && y !== null) points.push({ x, y });
  }
  return points;
};

const correlation = (rows: DatasetRow[], xKey: string, yKey: string) => {
  let count = 0, sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const row of rows) {
    const x = asNumber(row[xKey]);
    const y = asNumber(row[yKey]);
    if (x === null || y === null) continue;
    count += 1; sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
  }
  const denominator = Math.sqrt((count * sumX2 - sumX * sumX) * (count * sumY2 - sumY * sumY));
  return count >= 3 && denominator ? (count * sumXY - sumX * sumY) / denominator : null;
};

const trend = (rows: DatasetRow[], dateColumn: string, metric: string): PremiumChartDatum[] => {
  const buckets = new Map<string, { sum: number; count: number; time: number }>();
  for (const row of rows) {
    const parsed = parseDate(row[dateColumn], dateColumn);
    const value = asNumber(row[metric]);
    if (!parsed || value === null) continue;
    const bucket = buckets.get(parsed.label) || { sum: 0, count: 0, time: parsed.time };
    bucket.sum += value;
    bucket.count += 1;
    bucket.time = Math.min(bucket.time, parsed.time);
    buckets.set(parsed.label, bucket);
  }
  return [...buckets.entries()].map(([label, bucket]) => ({ label, value: Number((bucket.sum / bucket.count).toFixed(2)), count: bucket.count, time: bucket.time })).sort((a, b) => Number(a.time) - Number(b.time)).slice(-18).map(({ label, value, count }) => ({ label, value, count }));
};

const outliers = (rows: DatasetRow[], metric: string, limit = 8): PremiumChartDatum[] => rows.map((row, index) => ({ label: String(row.Name ?? row.name ?? row.id ?? `Row ${index + 1}`), value: asNumber(row[metric]) })).filter((item): item is { label: string; value: number } => item.value !== null).sort((a, b) => b.value - a.value).slice(0, limit);

const geoAggregate = (rows: DatasetRow[], geoColumn: string, metric: string): PremiumChartDatum[] => {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const raw = String(row[geoColumn] ?? "").trim();
    const location = extractGeoLocation(raw);
    if (!location) continue;
    const value = asNumber(row[metric]);
    const bucket = buckets.get(location.name) || { sum: 0, count: 0 };
    bucket.sum += value ?? 0;
    bucket.count += 1;
    buckets.set(location.name, bucket);
  }
  return [...buckets.entries()].map(([label, bucket]) => ({ label, value: Number((bucket.sum / Math.max(bucket.count, 1)).toFixed(2)), count: bucket.count })).sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 40);
};

const buildQuality = (dataset: Dataset) => {
  const total = Math.max(dataset.rows.length * Math.max(dataset.columns.length, 1), 1);
  let missing = 0;
  for (const row of dataset.rows) for (const column of dataset.columns) if (row[column.name] == null || row[column.name] === "") missing += 1;
  return Math.max(0, Math.round((1 - missing / total) * 100));
};

export const buildPremiumDashboardModel = (dataset: Dataset, options: { aiResult?: Record<string, unknown> | null; aiHealth?: Record<string, unknown> | null; warnings?: string[] } = {}): PremiumDashboardModel => {
  const rows = dataset.rows || [];
  const columnNames = dataset.columns.map((column) => column.name);
  const numericColumns = detectNumericColumns(dataset);
  const numericSet = new Set(numericColumns);
  const categoricalColumns = columnNames.filter((name) => !numericSet.has(name));
  const metric = pickPrimaryMetric(numericColumns);
  const dimension = pickPrimaryDimension(rows, categoricalColumns);
  const entity = pickEntityColumn(rows, categoricalColumns, dimension);
  const multiValue = pickMultiValueColumn(rows, categoricalColumns);
  const dateColumn = pickDateColumn(dataset);
  const latitude = pickCoordinateColumn(columnNames, "lat");
  const longitude = pickCoordinateColumn(columnNames, "lng");
  const geoColumn = pickGeoColumn(dataset, categoricalColumns);
  const relationship = pickRelationshipColumn(numericColumns, metric, latitude, longitude);
  const qualityScore = buildQuality(dataset);
  const summary = metric ? summarizeNumbers(rows, metric) : null;
  const formatter = metricFormatter(metric);
  const avg = summary?.count ? summary.sum / summary.count : null;
  const med = summary ? median(summary.values) : null;

  const kpis: PremiumKpi[] = [
    { id: "total-records", title: "Total Records", value: formatNumber(rows.length), rawValue: rows.length, subtitle: "Analyzed rows", delta: "Live data", icon: "rows" },
    { id: "average-metric", title: metric ? `Avg ${pretty(metric)}` : "Average Metric", value: formatter(avg), rawValue: avg ?? undefined, subtitle: "Primary metric", icon: "average" },
    { id: "median-metric", title: metric ? `Median ${pretty(metric)}` : "Median Metric", value: formatter(med), rawValue: med ?? undefined, subtitle: "Central tendency", icon: "median" },
    { id: "highest-metric", title: metric ? `Highest ${pretty(metric)}` : "Highest Metric", value: formatter(summary?.count ? summary.max : null), rawValue: summary?.count ? summary.max : undefined, subtitle: "Maximum value", icon: "max" },
    { id: "dimension-count", title: dimension ? `${pretty(dimension)} count` : "Segments", value: dimension ? formatNumber(uniqueCount(rows, dimension)) : "-", rawValue: dimension ? uniqueCount(rows, dimension) : undefined, subtitle: "Distinct segments", icon: "segments" },
    { id: "quality-score", title: "Data Quality", value: `${qualityScore}/100`, rawValue: qualityScore, subtitle: "Completeness score", icon: "quality" },
  ];

  const charts: PremiumChart[] = [];
  if (metric && dimension) charts.push({ id: "avg-metric-by-dimension", title: `Average ${pretty(metric)} by ${pretty(dimension)}`, subtitle: "Segment comparison", type: "bar", xKey: "label", yKey: "value", data: groupAverage(rows, dimension, metric, 10) });
  if (metric && summary) charts.push({ id: "metric-distribution", title: `${pretty(metric)} Distribution`, subtitle: "Histogram", type: "histogram", xKey: "label", yKey: "value", data: histogram(summary, 7) });
  if (metric && relationship) charts.push({ id: "metric-vs-relationship", title: `${pretty(metric)} vs ${pretty(relationship)}`, subtitle: "Sampled scatter", type: "scatter", xKey: "x", yKey: "y", data: scatter(rows, relationship, metric) });
  if (dimension) charts.push({ id: "category-distribution", title: `${pretty(dimension)} Distribution`, subtitle: "Donut chart", type: "donut", xKey: "label", yKey: "value", data: groupCount(rows, dimension, 8) });
  if (metric && dimension) charts.push({ id: "top-dimension-ranking", title: `Top ${pretty(dimension)} by Avg ${pretty(metric)}`, subtitle: "Ranking table", type: "table", xKey: "label", yKey: "value", data: groupAverage(rows, dimension, metric, 10) });
  if (metric && entity) charts.push({ id: "top-entity-ranking", title: `Top ${pretty(entity)} by Avg ${pretty(metric)}`, subtitle: "Entity ranking", type: "table", xKey: "label", yKey: "value", data: groupAverage(rows, entity, metric, 8) });
  if (metric && multiValue) charts.push({ id: "top-multivalue", title: `Top ${pretty(multiValue)} by Avg ${pretty(metric)}`, subtitle: "Multi-value ranking", type: "table", xKey: "label", yKey: "value", data: groupAverage(rows, multiValue, metric, 8) });
  if (metric && dateColumn) charts.push({ id: "metric-trend", title: `${pretty(metric)} Trend by ${pretty(dateColumn)}`, subtitle: "Time trend", type: "line", xKey: "label", yKey: "value", data: trend(rows, dateColumn, metric) });
  if (metric) charts.push({ id: "metric-outliers", title: `Top ${pretty(metric)} Outliers`, subtitle: "Highest records", type: "table", xKey: "label", yKey: "value", data: outliers(rows, metric, 8) });
  if (metric && geoColumn) {
    const geoData = geoAggregate(rows, geoColumn, metric);
    if (geoData.length) charts.push({ id: "geo-analysis", title: `Geo Analysis by ${pretty(geoColumn)}`, subtitle: `Color by average ${pretty(metric)}`, type: "map", xKey: "label", yKey: "value", metricOptions: [{ key: "count", label: "Record count" }, { key: "value", label: `Avg ${pretty(metric)}` }], data: geoData });
  }

  const topSegment = charts.find((chart) => chart.id === "avg-metric-by-dimension")?.data[0];
  const topEntity = charts.find((chart) => chart.id === "top-entity-ranking")?.data[0];
  const corr = metric && relationship ? correlation(rows, relationship, metric) : null;
  const corrText = corr == null || Math.abs(corr) < 0.05 ? `${pretty(relationship || "Selected metric")} and ${pretty(metric || "metric")} show no meaningful correlation in the current view.` : `${pretty(relationship)} and ${pretty(metric)} show ${Math.abs(corr) > 0.6 ? "strong" : "moderate"} ${corr >= 0 ? "positive" : "negative"} correlation (${corr.toFixed(2)}).`;
  const insights: PremiumInsight[] = [
    { id: "highest-segment", title: "Highest Performing Segment", message: topSegment ? `${topSegment.label} has the highest average ${pretty(metric || "metric")} in this dataset.` : "Add a categorical field to identify top performing segments.", tone: "gold", action: "View Segment" },
    { id: "top-correlation", title: "Top Correlation", message: corrText, tone: "cyan", action: "Review Analysis" },
    { id: "top-signal", title: entity ? "Key Operational Signal" : "Key Data Signal", message: topEntity ? `${topEntity.label} is one of the strongest ${pretty(entity || "entity")} signals in this dataset.` : "No reliable operational signal was detected yet.", tone: "violet", action: "Review Signal" },
    { id: "recommendation", title: "Recommendation", message: metric && dimension ? `Use ${pretty(dimension)} filters and ${pretty(metric)} segments to find high-value records and patterns.` : "Add a numeric metric and categorical dimensions to unlock richer recommendations.", tone: "emerald", action: "Review Next Steps" },
  ];

  const hasAi = Boolean(options.aiResult?.success || options.aiResult?.dashboard || options.aiResult?.dashboardPlan);
  const rag = options.aiResult?.rag as { used?: boolean; matches?: unknown[] } | undefined;
  const ragEnabled = Boolean(rag?.used || rag?.matches?.length || options.aiHealth);
  const ragPipeline: RagPipelineStep[] = [
    { id: "ingestion", title: "Data Ingestion", subtitle: "CSV / XLSX / PDF", status: rows.length ? "completed" : "pending" },
    { id: "schema", title: "Dataset Structure Review", subtitle: "Smart schema chunks", status: columnNames.length ? "completed" : "pending" },
    { id: "understanding", title: "Data Understanding", subtitle: "Optional embeddings", status: ragEnabled ? "completed" : "skipped" },
    { id: "index", title: "Knowledge Index", subtitle: "Optional knowledge index", status: ragEnabled ? "completed" : "skipped" },
    { id: "analysis", title: "AI Analysis", subtitle: hasAi ? "AI analysis active" : "Local analysis ready", status: "completed" },
  ];

  return {
    generatedAt: new Date().toISOString(),
    primaryMetric: metric,
    primaryDimension: dimension,
    rows,
    kpis,
    charts,
    insights,
    reasoning: [
      { id: "understanding", label: "Understanding query", status: "completed" },
      { id: "retrieval", label: "Retrieving dataset summary", status: rows.length ? "completed" : "pending" },
      { id: "analysis", label: "Planning analysis", status: rows.length ? "completed" : "pending" },
      { id: "response", label: hasAi ? "Generating AI response" : "Generating local response", status: rows.length ? "completed" : "pending" },
    ],
    ragPipeline,
    qualityScore,
    provider: String(options.aiResult?.provider || "schema-safe"),
    model: String(options.aiResult?.model || "local-analytics"),
    warnings: options.warnings || [],
  };
};

export { pickPrimaryMetric, pickPrimaryDimension };
