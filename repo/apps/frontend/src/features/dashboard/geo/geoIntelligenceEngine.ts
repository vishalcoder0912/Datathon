import type { Row } from "@/features/dashboard/utils/dashboardAnalytics";
import { normalizeLocation } from "./geoLocationNormalizer";

const GEO_FIELD_KEYWORDS = [
  "country", "countryname", "nation", "state", "city", "region", "territory",
  "province", "zone", "market", "latitude", "longitude",
  "location", "address", "postal", "zip",
];

const METRIC_PRIORITY = [
  "revenue", "profit", "sales", "billing_amount", "billingamount",
  "salary_usd", "salary", "orders", "customers", "patients",
  "review_count", "reviewcount", "rating", "risk_score", "riskscore",
  "amount", "price", "cost", "quantity",
];

const SUM_METRICS = [
  "revenue", "profit", "sales", "orders", "customers", "patients",
  "reviewcount", "review_count", "amount", "price", "cost", "quantity",
];

const AVERAGE_METRICS = [
  "billingamount", "billing_amount", "salaryusd", "salary_usd", "rating", "riskscore", "risk_score",
];

const REJECTED_METRIC_TERMS = [
  "name", "reviewername", "customername", "patientname", "doctor", "hospital",
  "email", "phone", "address", "profilelink", "link", "url", "title",
  "description", "text", "id",
];

const INVALID_LOCATION_VALUES = new Set([
  "unknown",
  "null",
  "undefined",
  "n/a",
  "na",
  "none",
  "-",
]);

export interface GeoLocationData {
  name: string;
  normalizedName: string;
  metricValue: number;
  recordCount: number;
  rank: number;
  kpiLabel: string;
  kpiFormatted: string;
  insight: string;
}

export interface GeoIntelligenceResult {
  enabled: boolean;
  geoField: string;
  metricField: string;
  aggregation: "avg" | "sum" | "count";
  activityLabel: string;
  locations: GeoLocationData[];
  totalLocations: number;
  topLocation: GeoLocationData | null;
  bottomLocation: GeoLocationData | null;
  averageMetric: number;
  totalRecords: number;
  summaryInsight: string;
}

export function detectGeoField(columns: string[]): string | null {
  const lower = columns.map((c) => c.toLowerCase().replace(/[_\s-]/g, ""));

  for (const kw of GEO_FIELD_KEYWORDS) {
    const idx = lower.findIndex(
      (c) => c === kw || c === kw + "s" || c.endsWith("_" + kw) || c.endsWith("_" + kw + "s")
    );
    if (idx >= 0) return columns[idx];
  }

  for (const kw of ["country", "state", "city", "region"]) {
    const idx = lower.findIndex((c) => c.includes(kw));
    if (idx >= 0) return columns[idx];
  }

  return null;
}

export function detectMetricField(columns: string[], rows: Row[]): string | null {
  const lower = columns.map((c) => c.toLowerCase().replace(/[_\s-]/g, ""));

  for (const mp of METRIC_PRIORITY) {
    const normalizedPriority = mp.replace(/_/g, "");
    const idx = lower.findIndex((c) => c.includes(normalizedPriority) || c.includes(mp));
    if (idx >= 0) {
      const col = columns[idx];
      const hasNumeric = rows.some(
        (r) => parseNumericValue(r[col]) !== null
      );
      if (hasNumeric) return col;
    }
  }

  const numericCols = columns.filter((c) =>
    !REJECTED_METRIC_TERMS.some((term) => c.toLowerCase().replace(/[_\s-]/g, "").includes(term)) &&
    rows.some((r) => {
      const v = r[c];
      return parseNumericValue(v) !== null;
    })
  );

  return numericCols[0] || null;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").replace(/,/g, "").match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeValidLocation(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (INVALID_LOCATION_VALUES.has(raw.toLowerCase())) return "";
  return normalizeLocation(raw);
}

function resolveAggregation(metricField: string): "avg" | "sum" | "count" {
  if (!metricField || metricField === "__count__") return "count";
  const normalized = metricField.toLowerCase().replace(/[_\s-]/g, "");
  if (AVERAGE_METRICS.some((term) => normalized.includes(term.replace(/_/g, "")))) return "avg";
  if (SUM_METRICS.some((term) => normalized.includes(term.replace(/_/g, "")))) return "sum";
  return "sum";
}

function formatMetric(value: number, field: string): string {
  if (!field || value === null || value === undefined) return "-";

  const fl = field.toLowerCase();
  if (
    fl.includes("salary") || fl.includes("revenue") || fl.includes("sales") ||
    fl.includes("profit") || fl.includes("income") || fl.includes("price") ||
    fl.includes("cost") || fl.includes("budget") || fl.includes("amount")
  ) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }

  if (fl.includes("percent") || fl.includes("rate") || fl.includes("ratio")) {
    return value.toFixed(2) + "%";
  }

  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function generateInsight(
  location: string,
  metricValue: number,
  metricField: string,
  rank: number,
  totalLocations: number,
  aggregation: string,
  averageMetric: number,
): string {
  const fl = metricField.toLowerCase().replace(/[_\s]/g, " ");

  if (rank === 1) {
    if (fl.includes("salary")) return `Highest paying ${fl} in this dataset.`;
    if (fl.includes("revenue")) return `Top revenue generating location.`;
    if (fl.includes("sales")) return `Highest sales location in this dataset.`;
    if (fl.includes("profit")) return `Most profitable location.`;
    return `Highest ${fl} location in this dataset.`;
  }

  if (rank === totalLocations && totalLocations > 1) {
    if (fl.includes("salary")) return `Lowest paying ${fl} in this dataset.`;
    if (fl.includes("revenue")) return `Lowest revenue generating location.`;
    return `Lowest ${fl} location in this dataset.`;
  }

  if (metricValue > averageMetric * 1.2) return `Above average ${fl} compared to other locations.`;
  if (metricValue < averageMetric * 0.8) return `Below average ${fl} compared to other locations.`;

  return `Average ${fl} consistent with dataset median.`;
}

export function computeGeoIntelligence(
  rows: Row[],
  geoField: string,
  metricField: string,
): GeoIntelligenceResult {
  const aggregation = resolveAggregation(metricField);

  const grouped = new Map<string, { values: number[]; count: number }>();

  for (const row of rows) {
    const raw = row[geoField];
    if (raw === null || raw === undefined || raw === "") continue;

    const location = normalizeValidLocation(raw);
    if (!location) continue;

    let metricVal = 1;

    if (aggregation === "avg" || aggregation === "sum") {
      const rawMetric = row[metricField];
      if (rawMetric !== null && rawMetric !== undefined && rawMetric !== "") {
        const num = parseNumericValue(rawMetric);
        if (num !== null) metricVal = num;
      }
    }

    if (!grouped.has(location)) grouped.set(location, { values: [], count: 0 });
    const entry = grouped.get(location)!;
    entry.values.push(metricVal);
    entry.count++;
  }

  const locations: GeoLocationData[] = [];

  for (const [name, data] of grouped) {
    const metricValue =
      aggregation === "avg"
        ? data.values.reduce((a, b) => a + b, 0) / data.values.length
        : aggregation === "sum"
          ? data.values.reduce((a, b) => a + b, 0)
          : data.count;

    locations.push({
      name,
      normalizedName: name,
      metricValue,
      recordCount: data.count,
      rank: 0,
      kpiLabel: "",
      kpiFormatted: "",
      insight: "",
    });
  }

  locations.sort((a, b) => b.metricValue - a.metricValue);
  locations.forEach((loc, index) => {
    loc.rank = index + 1;
    loc.kpiLabel = aggregation === "avg" ? `Avg ${metricField || "Count"}` : aggregation === "sum" ? `Total ${metricField || "Count"}` : "Record Count";
    loc.kpiFormatted = formatMetric(loc.metricValue, metricField);
  });

  const averageMetric =
    locations.length > 0
      ? locations.reduce((a, b) => a + b.metricValue, 0) / locations.length
      : 0;

  const activityLabel = metricField
    ? metricField.replace(/[_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Data Analysis";

  for (const loc of locations) {
    loc.insight = generateInsight(
      loc.name, loc.metricValue, metricField,
      loc.rank, locations.length, aggregation, averageMetric,
    );
  }

  const summaryInsight =
    locations.length > 0
      ? `Analyzing ${locations.length} locations with ${metricField || "record count"} as the primary metric. ` +
        `Top location is ${locations[0].name} (${locations[0].kpiFormatted}), ` +
        `followed by ${locations[1]?.name || "-"}.`
      : "No geographic data available for analysis.";

  return {
    enabled: locations.length > 0,
    geoField,
    metricField,
    aggregation,
    activityLabel,
    locations,
    totalLocations: locations.length,
    topLocation: locations[0] || null,
    bottomLocation: locations[locations.length - 1] || null,
    averageMetric,
    totalRecords: rows.length,
    summaryInsight,
  };
}
