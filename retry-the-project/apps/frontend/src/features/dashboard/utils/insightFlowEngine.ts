import type { ChartType, ChartIntent } from "@/features/dashboard/types/dashboardTypes";
import type { Row } from "@/features/dashboard/utils/dashboardAnalytics";

/* ============================================================
   INSIGHTFLOW — Universal Dashboard Intelligence Engine
   Implements Master Prompt Steps 1-10 + Self-Critic Mode
   ============================================================ */

// --- Step 1: Schema Classification ---------------------------
export type ColumnClass =
  | "numeric"
  | "geo"
  | "date"
  | "category"
  | "person"
  | "identifier"
  | "text";

export interface ClassifiedColumn {
  name: string;
  class: ColumnClass;
  type: "number" | "string" | "date" | "boolean";
  uniqueCount: number;
  missingCount: number;
  sampleValues: string[];
}

export interface InsightFlowSchema {
  columns: ClassifiedColumn[];
  numeric: ClassifiedColumn[];
  geo: ClassifiedColumn[];
  dates: ClassifiedColumn[];
  categories: ClassifiedColumn[];
  persons: ClassifiedColumn[];
  identifiers: ClassifiedColumn[];
  texts: ClassifiedColumn[];
  rowCount: number;
}

// --- Step 2: Dataset Type ------------------------------------
export type DatasetType =
  | "Healthcare"
  | "HR"
  | "Sales"
  | "Finance"
  | "Marketing"
  | "Reviews"
  | "Ecommerce"
  | "Manufacturing"
  | "Education"
  | "Logistics"
  | "SaaS"
  | "General";

// --- Step 3: KPI ---------------------------------------------
export interface InsightFlowKPI {
  id: string;
  title: string;
  value: string;
  rawValue: number | string;
  subtitle: string;
  metric: string;
  aggregation: string;
  format: "number" | "currency" | "percent" | "text";
  businessValue: string;
  domain: string;
}

// --- Step 4: Chart -------------------------------------------
export interface InsightFlowChart {
  id: string;
  type: ChartType;
  title: string;
  subtitle: string;
  xKey: string;
  yKey: string;
  aggregation: string;
  intent: ChartIntent;
  data: Array<Record<string, string | number>>;
  businessValue: string;
  warning?: string;
}

// --- Step 5: Geo ---------------------------------------------
export interface GeoLocation {
  name: string;
  metricValue: number;
  recordCount: number;
  rank: number;
  formattedValue: string;
  highlight: "high" | "medium" | "low";
  contributionPct: number;
}

export interface GeoIntelligence {
  enabled: boolean;
  field: string;
  metricField: string;
  mapType: "marker" | "choropleth" | "regional" | "single" | "none";
  locations: GeoLocation[];
  totalLocations: number;
  topLocation: GeoLocation | null;
  totalRecords: number;
  globalAverage: number;
  mostCommonCategory: string;
  recommendation: string;
}

// --- Step 6: Filter ------------------------------------------
export interface InsightFlowFilter {
  key: string;
  label: string;
  type: "date" | "geo" | "category" | "business";
  values: string[];
  priority: number;
}

// --- Step 9: Insights ----------------------------------------
export interface InsightTier {
  executive: string;
  analyst: string;
  story: string;
}

// --- Step 10: Score ------------------------------------------
export interface DashboardScore {
  total: number;
  kpiRelevance: number;
  chartDiversity: number;
  geoRelevance: number;
  businessUsefulness: number;
  filterUsefulness: number;
  passed: boolean;
}

// --- Full Result ---------------------------------------------
export interface InsightFlowResult {
  valid: boolean;
  dashboardType: string;
  datasetType: DatasetType;
  qualityScore: DashboardScore;
  kpis: InsightFlowKPI[];
  charts: InsightFlowChart[];
  geoIntelligence: GeoIntelligence;
  filters: InsightFlowFilter[];
  insights: InsightTier;
}

// --- Self Critic Report --------------------------------------
export interface CriticReport {
  passed: boolean;
  issues: string[];
  replacements: Array<{ index: number; reason: string; replacement: InsightFlowChart }>;
  score: number;
}

/* ============================================================
   STEP 1: SCHEMA UNDERSTANDING
   ============================================================ */

const GEO_KEYWORDS = [
  "country", "country_code", "city", "state", "province",
  "region", "territory", "market", "latitude", "longitude",
  "location", "address",
];

const DATE_KEYWORDS = [
  "date", "created_at", "created", "order_date", "review_date",
  "admission_date", "invoice_date", "updated_at", "timestamp",
  "year", "month", "quarter", "period",
];

const PERSON_KEYWORDS = [
  "name", "customer_name", "employee_name", "patient_name",
  "reviewer_name", "doctor_name", "full_name", "first_name",
  "last_name",
];

const ID_KEYWORDS = [
  "id", "uuid", "transaction_id", "invoice_id", "order_id",
  "product_id", "customer_id", "employee_id", "patient_id",
  "review_id", "session_id",
];

const NUMERIC_HINTS = [
  "revenue", "profit", "sales", "salary", "billing_amount",
  "orders", "quantity", "customers", "patients", "rating",
  "review_count", "cost", "price", "risk_score", "amount",
  "income", "expense", "margin", "score", "count",
  "marks", "gpa", "cgpa", "percentage", "grade", "rank",
];

const TEXT_KEYWORDS = [
  "review_text", "description", "notes", "comments", "feedback",
  "message", "content", "body",
];

const CATEGORY_HINTS = [
  "gender", "department", "education", "product_category",
  "company_size", "admission_type", "insurance_provider",
  "category", "segment", "group", "type", "status", "level",
  "role", "position", "industry",
  "branch", "board", "stream", "specialization", "major",
];

/**
 * Normalize a column name by stripping underscores, spaces, dashes,
 * AND bracket notations like [10th], [12th], etc.
 */
function normalize(col: string): string {
  return col.toLowerCase().replace(/[_\s-[\]()0-9th]+/g, "");
}

function classifyColumn(name: string, values: unknown[]): ColumnClass {
  const n = normalize(name);

  if (ID_KEYWORDS.some((k) => normalize(k) === n || n.endsWith(normalize(k))))
    return "identifier";

  if (GEO_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k))))
    return "geo";

  if (DATE_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k))))
    return "date";

  if (PERSON_KEYWORDS.some((k) => normalize(k) === n || n.endsWith(normalize(k))))
    return "person";

  if (TEXT_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k))))
    return "text";

  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericCount = nonNull.filter((v) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))).length;
  const isNumeric = nonNull.length > 0 && numericCount / nonNull.length >= 0.85;

  if (isNumeric || NUMERIC_HINTS.some((k) => normalize(k) === n || n.includes(normalize(k))))
    return "numeric";

  if (CATEGORY_HINTS.some((k) => normalize(k) === n || n.includes(normalize(k))))
    return "category";

  const uniqueCount = new Set(nonNull.map((v) => String(v).trim())).size;
  const ratio = nonNull.length > 0 ? uniqueCount / nonNull.length : 0;

  if (ratio < 0.3 && nonNull.length > 0) return "category";

  return "text";
}

function inferValueType(values: unknown[]): "number" | "string" | "date" | "boolean" {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (!nonNull.length) return "string";

  const numericCount = nonNull.filter((v) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))).length;
  if (numericCount / nonNull.length >= 0.85) return "number";

  const dateCount = nonNull.filter((v) => v instanceof Date || (typeof v === "string" && !Number.isNaN(Date.parse(v)))).length;
  if (dateCount / nonNull.length >= 0.75) return "date";

  const boolValues = new Set(["true", "false", "yes", "no", "0", "1"]);
  const boolCount = nonNull.filter((v) => typeof v === "boolean" || (typeof v === "string" && boolValues.has(v.trim().toLowerCase()))).length;
  if (boolCount / nonNull.length >= 0.9) return "boolean";

  return "string";
}

export function buildInsightFlowSchema(rows: Row[]): InsightFlowSchema {
  if (!rows.length) {
    return { columns: [], numeric: [], geo: [], dates: [], categories: [], persons: [], identifiers: [], texts: [], rowCount: 0 };
  }

  const allKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {})).filter((k) => !k.startsWith("__"))));

  const columns: ClassifiedColumn[] = allKeys.map((name) => {
    const values = rows.map((r) => r[name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    return {
      name,
      class: classifyColumn(name, values),
      type: inferValueType(values),
      uniqueCount: new Set(nonNull.map((v) => String(v).trim())).size,
      missingCount: values.length - nonNull.length,
      sampleValues: Array.from(new Set(nonNull.map((v) => String(v).trim()))).slice(0, 5),
    };
  });

  return {
    columns,
    numeric: columns.filter((c) => c.class === "numeric"),
    geo: columns.filter((c) => c.class === "geo"),
    dates: columns.filter((c) => c.class === "date"),
    categories: columns.filter((c) => c.class === "category"),
    persons: columns.filter((c) => c.class === "person"),
    identifiers: columns.filter((c) => c.class === "identifier"),
    texts: columns.filter((c) => c.class === "text"),
    rowCount: rows.length,
  };
}

/* ============================================================
   STEP 2: DATASET TYPE DETECTION
   ============================================================ */

const DOMAIN_SIGNATURES: Array<{ type: DatasetType; keywords: string[]; required?: string[] }> = [
  { type: "Healthcare", keywords: ["patient", "diagnosis", "admission", "doctor", "hospital", "condition", "treatment", "billing_amount", "insurance"], required: ["patient"] },
  { type: "HR", keywords: ["employee", "salary", "department", "hire", "attrition", "promotion", "candidate", "payroll"], required: ["salary"] },
  { type: "Sales", keywords: ["revenue", "sales", "deal", "pipeline", "quota", "commission", "lead", "opportunity"], required: ["revenue"] },
  { type: "Finance", keywords: ["revenue", "profit", "expense", "income", "budget", "forecast", "transaction", "audit", "tax"] },
  { type: "Marketing", keywords: ["campaign", "click", "impression", "conversion", "acquisition", "traffic", "ctr", "roi"] },
  { type: "Reviews", keywords: ["review", "rating", "sentiment", "feedback", "comment", "score", "reviewer"], required: ["rating"] },
  // Education checked BEFORE Ecommerce so marks/branch/board beats product/category signals
  {
    type: "Education",
    keywords: [
      "student", "course", "enrollment", "grade", "exam", "attendance", "teacher", "subject",
      "marks", "branch", "board", "semester", "gpa", "cgpa", "rank", "stream",
      "specialization", "percentage", "college", "university", "faculty", "lecture",
    ],
  },
  { type: "Ecommerce", keywords: ["product", "order", "cart", "checkout", "sku", "inventory", "category", "customer", "purchase"] },
  { type: "Manufacturing", keywords: ["production", "defect", "quality", "inventory", "supply", "machine", "downtime", "yield"] },
  { type: "Logistics", keywords: ["shipment", "delivery", "warehouse", "route", "freight", "carrier", "dispatch"] },
  { type: "SaaS", keywords: ["subscription", "churn", "mrr", "arr", "trial", "user", "tenant", "plan", "license"] },
];

export function detectDatasetType(schema: InsightFlowSchema): DatasetType {
  const allNames = schema.columns.map((c) => normalize(c.name));
  const allNamesJoined = allNames.join(" ");

  const scores = DOMAIN_SIGNATURES.map((ds) => {
    let score = 0;
    for (const kw of ds.keywords) {
      const nkw = normalize(kw);
      if (allNames.some((n) => n.includes(nkw))) score += 2;
      if (allNames.some((n) => n === nkw)) score += 1;
    }

    if (ds.required) {
      const hasAll = ds.required.every((r) => allNames.some((n) => n.includes(normalize(r))));
      if (!hasAll) score = 0;
    }

    return { type: ds.type, score };
  });

  scores.sort((a, b) => b.score - a.score);
  if (scores[0]?.score && scores[0].score >= 3) return scores[0].type;

  if (schema.numeric.length >= 2) {
    const n = schema.numeric.map((c) => normalize(c.name)).join(" ");
    if (n.includes("revenue") || n.includes("profit") || n.includes("sales")) return "Sales";
    if (n.includes("salary")) return "HR";
    if (n.includes("rating") || n.includes("review")) return "Reviews";
    if (n.includes("patient") || allNamesJoined.includes("patient")) return "Healthcare";
  }

  return "General";
}

/* ============================================================
   STEP 3: KPI GENERATION
   ============================================================ */

function formatKpiValue(val: number, format: "number" | "currency" | "percent" | "text"): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
  }
  if (format === "percent") return `${val.toFixed(1)}%`;
  if (format === "number") return Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(val);
}

function sumColumn(rows: Row[], col: string): number {
  return rows.reduce((s, r) => {
    const v = typeof r[col] === "number" ? (r[col] as number) : Number(r[col]);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function avgColumn(rows: Row[], col: string): number {
  const vals = rows.map((r) => {
    const v = typeof r[col] === "number" ? (r[col] as number) : Number(r[col]);
    return Number.isFinite(v) ? v : null;
  }).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

function medianColumn(rows: Row[], col: string): number {
  const vals = rows
    .map((r) => typeof r[col] === "number" ? (r[col] as number) : Number(r[col]))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!vals.length) return 0;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
}

function topCategoryByAvg(rows: Row[], catCol: string, metricCol: string): string {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const label = String(row[catCol] ?? "").trim();
    const val = typeof row[metricCol] === "number" ? (row[metricCol] as number) : Number(row[metricCol]);
    if (!label || !Number.isFinite(val)) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(val);
  }
  let topLabel = "N/A", topAvg = -Infinity;
  for (const [label, vals] of groups) {
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (avg > topAvg) { topAvg = avg; topLabel = label; }
  }
  return topLabel;
}

function diversityIndex(rows: Row[], col: string): number {
  const groups = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[col] ?? "").trim();
    if (!label) continue;
    groups.set(label, (groups.get(label) || 0) + 1);
  }
  if (!groups.size) return 0;
  const counts = Array.from(groups.values());
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return max > 0 ? Math.round((min / max) * 100) : 0;
}

function maxColumn(rows: Row[], col: string): number {
  let max = -Infinity;
  for (const r of rows) {
    const v = typeof r[col] === "number" ? (r[col] as number) : Number(r[col]);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max === -Infinity ? 0 : max;
}

function minColumn(rows: Row[], col: string): number {
  let min = Infinity;
  for (const r of rows) {
    const v = typeof r[col] === "number" ? (r[col] as number) : Number(r[col]);
    if (Number.isFinite(v) && v < min) min = v;
  }
  return min === Infinity ? 0 : min;
}

function countUniqueColumn(rows: Row[], col: string): number {
  return new Set(rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean)).size;
}

function makeKpi(
  title: string, rawValue: number | string, metric: string, aggregation: string,
  format: "number" | "currency" | "percent" | "text", businessValue: string, domain: string
): InsightFlowKPI {
  return {
    id: crypto.randomUUID(),
    title,
    value: typeof rawValue === "number" ? formatKpiValue(rawValue, format) : rawValue,
    rawValue,
    subtitle: `${aggregation.toUpperCase()} - ${metric}`,
    metric,
    aggregation,
    format,
    businessValue,
    domain,
  };
}

const DOMAIN_KPI_DEFS: Record<DatasetType, Array<{
  title: string; metric: string; aggregation: string; format: "number" | "currency" | "percent" | "text"; businessValue: string
}>> = {
  Healthcare: [
    { title: "Total Patients", metric: "patient", aggregation: "count_unique", format: "number", businessValue: "Patient volume" },
    { title: "Avg Billing Amount", metric: "billing_amount", aggregation: "avg", format: "currency", businessValue: "Average revenue per patient" },
    { title: "Highest Billing", metric: "billing_amount", aggregation: "max", format: "currency", businessValue: "Maximum billing amount" },
    { title: "Conditions Covered", metric: "condition", aggregation: "count_unique", format: "number", businessValue: "Disease coverage breadth" },
  ],
  HR: [
    { title: "Total Employees", metric: "employee", aggregation: "count_unique", format: "number", businessValue: "Workforce size" },
    { title: "Avg Salary", metric: "salary", aggregation: "avg", format: "currency", businessValue: "Compensation benchmark" },
    { title: "Highest Salary", metric: "salary", aggregation: "max", format: "currency", businessValue: "Top compensation level" },
    { title: "Countries Covered", metric: "country", aggregation: "count_unique", format: "number", businessValue: "Global presence" },
  ],
  Sales: [
    { title: "Total Revenue", metric: "revenue", aggregation: "sum", format: "currency", businessValue: "Revenue performance" },
    { title: "Total Profit", metric: "profit", aggregation: "sum", format: "currency", businessValue: "Profitability" },
    { title: "Total Orders", metric: "orders", aggregation: "sum", format: "number", businessValue: "Sales volume" },
    { title: "Total Customers", metric: "customers", aggregation: "count_unique", format: "number", businessValue: "Customer base size" },
  ],
  Finance: [
    { title: "Total Revenue", metric: "revenue", aggregation: "sum", format: "currency", businessValue: "Revenue performance" },
    { title: "Total Profit", metric: "profit", aggregation: "sum", format: "currency", businessValue: "Profitability" },
    { title: "Avg Transaction", metric: "amount", aggregation: "avg", format: "currency", businessValue: "Average deal size" },
    { title: "Transaction Count", metric: "transaction", aggregation: "count_unique", format: "number", businessValue: "Transaction volume" },
  ],
  Marketing: [
    { title: "Total Campaigns", metric: "campaign", aggregation: "count_unique", format: "number", businessValue: "Marketing activity" },
    { title: "Total Conversions", metric: "conversion", aggregation: "sum", format: "number", businessValue: "Conversion performance" },
    { title: "Avg ROAS", metric: "roas", aggregation: "avg", format: "percent", businessValue: "Return on ad spend" },
    { title: "Total Clicks", metric: "click", aggregation: "sum", format: "number", businessValue: "Engagement volume" },
  ],
  Reviews: [
    { title: "Total Reviews", metric: "review", aggregation: "count_unique", format: "number", businessValue: "Review volume" },
    { title: "Avg Rating", metric: "rating", aggregation: "avg", format: "number", businessValue: "Customer satisfaction" },
    { title: "Review Count", metric: "review_count", aggregation: "sum", format: "number", businessValue: "Total reviews count" },
    { title: "Countries Covered", metric: "country", aggregation: "count_unique", format: "number", businessValue: "Geographic spread" },
  ],
  Ecommerce: [
    { title: "Total Revenue", metric: "revenue", aggregation: "sum", format: "currency", businessValue: "Revenue performance" },
    { title: "Total Products", metric: "product", aggregation: "count_unique", format: "number", businessValue: "Product catalog size" },
    { title: "Total Orders", metric: "order", aggregation: "sum", format: "number", businessValue: "Order volume" },
    { title: "Avg Order Value", metric: "amount", aggregation: "avg", format: "currency", businessValue: "Average transaction value" },
  ],
  Manufacturing: [
    { title: "Total Production", metric: "production", aggregation: "sum", format: "number", businessValue: "Output volume" },
    { title: "Avg Quality Score", metric: "quality", aggregation: "avg", format: "number", businessValue: "Product quality" },
    { title: "Total Defects", metric: "defect", aggregation: "sum", format: "number", businessValue: "Quality issues" },
    { title: "Inventory Value", metric: "inventory", aggregation: "sum", format: "currency", businessValue: "Stock value" },
  ],
  Education: [
    { title: "Total Students", metric: "student", aggregation: "count_unique", format: "number", businessValue: "Student enrollment" },
    { title: "Avg Marks (10th)", metric: "marks", aggregation: "avg", format: "number", businessValue: "10th grade performance benchmark" },
    { title: "Median Marks (10th)", metric: "marks", aggregation: "median", format: "number", businessValue: "Robust central tendency vs outliers" },
    { title: "Courses Offered", metric: "course", aggregation: "count_unique", format: "number", businessValue: "Curriculum breadth" },
    { title: "Avg GPA", metric: "gpa", aggregation: "avg", format: "number", businessValue: "Overall academic standing" },
    { title: "Pass Rate", metric: "pass", aggregation: "avg", format: "percent", businessValue: "Success rate" },
    { title: "Top Performing Branch", metric: "branch", aggregation: "top_category", format: "text", businessValue: "Highest average marks branch" },
    { title: "Gender Diversity Index", metric: "gender", aggregation: "diversity", format: "percent", businessValue: "Balance between gender groups" },
  ],
  Logistics: [
    { title: "Total Shipments", metric: "shipment", aggregation: "count_unique", format: "number", businessValue: "Logistics volume" },
    { title: "Deliveries On Time", metric: "delivery", aggregation: "count_unique", format: "number", businessValue: "Service reliability" },
    { title: "Avg Delivery Time", metric: "delivery_time", aggregation: "avg", format: "number", businessValue: "Delivery efficiency" },
    { title: "Warehouse Count", metric: "warehouse", aggregation: "count_unique", format: "number", businessValue: "Infrastructure scale" },
  ],
  SaaS: [
    { title: "Total Subscribers", metric: "subscription", aggregation: "count_unique", format: "number", businessValue: "Customer base" },
    { title: "MRR", metric: "mrr", aggregation: "sum", format: "currency", businessValue: "Monthly recurring revenue" },
    { title: "Churn Rate", metric: "churn", aggregation: "avg", format: "percent", businessValue: "Customer retention" },
    { title: "Active Users", metric: "user", aggregation: "count_unique", format: "number", businessValue: "Platform engagement" },
  ],
  General: [
    { title: "Total Records", metric: "__row_count__", aggregation: "count", format: "number", businessValue: "Data volume" },
    { title: "Unique Categories", metric: "__category__", aggregation: "count_unique", format: "number", businessValue: "Data diversity" },
  ],
};

function resolveMetricColumn(schema: InsightFlowSchema, hint: string): string | null {
  const n = normalize(hint);
  const found = schema.columns.find((c) => normalize(c.name).includes(n));
  if (found) return found.name;
  if (hint === "__row_count__") return "__row_count__";
  if (hint === "__category__") return schema.categories[0]?.name || null;
  // Special: resolve 'marks' ? first column containing 'marks'
  if (hint === "marks") {
    const marksCol = schema.columns.find((c) => normalize(c.name).includes("marks") || normalize(c.name).includes("mark"));
    return marksCol?.name || schema.numeric[0]?.name || null;
  }
  return null;
}

export function generateKPIs(rows: Row[], schema: InsightFlowSchema, datasetType: DatasetType): InsightFlowKPI[] {
  const kpis: InsightFlowKPI[] = [];

  kpis.push(makeKpi("Total Records", rows.length, "__row_count__", "count", "number", "Total data volume", datasetType));

  const defs = DOMAIN_KPI_DEFS[datasetType] || DOMAIN_KPI_DEFS.General;

  for (const def of defs) {
    const col = resolveMetricColumn(schema, def.metric);
    if (!col) continue;

    let rawValue: number | string = 0;

    if (def.aggregation === "sum" && col !== "__row_count__") rawValue = sumColumn(rows, col);
    else if (def.aggregation === "avg" && col !== "__row_count__") rawValue = avgColumn(rows, col);
    else if (def.aggregation === "median" && col !== "__row_count__") rawValue = medianColumn(rows, col);
    else if (def.aggregation === "max" && col !== "__row_count__") rawValue = maxColumn(rows, col);
    else if (def.aggregation === "min" && col !== "__row_count__") rawValue = minColumn(rows, col);
    else if (def.aggregation === "count_unique" && col !== "__row_count__") rawValue = countUniqueColumn(rows, col);
    else if (def.aggregation === "top_category" && col !== "__row_count__") {
      // Find primary numeric metric to rank categories by
      const metricCol = schema.numeric[0]?.name;
      rawValue = metricCol ? topCategoryByAvg(rows, col, metricCol) : "N/A";
    }
    else if (def.aggregation === "diversity" && col !== "__row_count__") rawValue = diversityIndex(rows, col);
    else rawValue = rows.length;

    kpis.push(makeKpi(
      def.title, rawValue, col, def.aggregation, def.format, def.businessValue, datasetType
    ));
  }

  // Fallback: ensure at least one avg KPI for primary numeric
  if (schema.numeric.length > 0 && !kpis.some((k) => k.aggregation === "avg" || k.aggregation === "median")) {
    const firstMetric = schema.numeric[0].name;
    kpis.push(makeKpi(
      `Average ${firstMetric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      avgColumn(rows, firstMetric), firstMetric, "avg", "number",
      "Key performance metric", datasetType
    ));
  }

  // Add secondary numeric avg KPI if we have enough room and a 2nd metric
  if (schema.numeric.length > 1 && kpis.length < 8) {
    const secondMetric = schema.numeric[1].name;
    if (!kpis.some((k) => k.metric === secondMetric)) {
      kpis.push(makeKpi(
        `Avg ${secondMetric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
        avgColumn(rows, secondMetric), secondMetric, "avg", "number",
        "Secondary performance metric", datasetType
      ));
    }
  }

  return kpis.slice(0, 8);
}

// --- KPI Breakdowns (for hover drill-down) --------------------------------
export interface KpiBreakdown {
  dimension: string;
  values: Array<{ label: string; formatted: string; raw: number }>;
}

export function computeKpiBreakdowns(
  rows: Row[], kpi: InsightFlowKPI, schema: InsightFlowSchema
): KpiBreakdown[] {
  const breakdowns: KpiBreakdown[] = [];
  if (!rows.length || kpi.metric === "__row_count__" || kpi.aggregation === "top_category" || kpi.aggregation === "diversity") {
    return breakdowns;
  }

  const metricCol = schema.columns.find((c) => c.name === kpi.metric);
  if (!metricCol || (metricCol.class !== "numeric" && kpi.aggregation !== "count_unique")) {
    return breakdowns;
  }

  // Build breakdown for up to 2 category columns
  const catCols = schema.categories.slice(0, 2);
  for (const cat of catCols) {
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const label = String(row[cat.name] ?? "").trim();
      if (!label) continue;
      const val = typeof row[kpi.metric] === "number" ? (row[kpi.metric] as number) : Number(row[kpi.metric]);
      if (!Number.isFinite(val)) continue;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(val);
    }

    const values = Array.from(groups.entries())
      .map(([label, vals]) => {
        const raw = kpi.aggregation === "sum"
          ? vals.reduce((s, v) => s + v, 0)
          : kpi.aggregation === "max" ? Math.max(...vals)
          : kpi.aggregation === "min" ? Math.min(...vals)
          : vals.reduce((s, v) => s + v, 0) / vals.length;
        return { label, formatted: raw.toLocaleString(undefined, { maximumFractionDigits: 1 }), raw };
      })
      .sort((a, b) => b.raw - a.raw)
      .slice(0, 6);

    if (values.length > 0) {
      breakdowns.push({ dimension: cat.name, values });
    }
  }

  return breakdowns;
}

/* ============================================================
   STEP 4: CHART PLANNER
   ============================================================ */

function buildGroupedData(rows: Row[], xKey: string, yKey: string, aggregation: string, limit = 10): Array<Record<string, string | number>> {
  const groups = new Map<string, number[]>();
  const isCount = aggregation === "count";

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";
    if (!groups.has(label)) groups.set(label, []);
    if (isCount) {
      groups.get(label)!.push(1);
    } else {
      const val = typeof row[yKey] === "number" ? (row[yKey] as number) : Number(row[yKey]);
      if (Number.isFinite(val)) groups.get(label)!.push(val);
    }
  }

  const valueKey = isCount ? "count" : yKey;

  return Array.from(groups.entries())
    .map(([label, vals]) => ({
      [xKey]: label,
      [valueKey]: aggregation === "sum" ? vals.reduce((s, v) => s + v, 0)
        : aggregation === "avg" ? (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0)
          : aggregation === "max" ? Math.max(...vals)
            : aggregation === "min" ? Math.min(...vals)
              : vals.length,
      __count: vals.length,
    }))
    .sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]))
    .slice(0, limit);
}

function buildTrendData(rows: Row[], xKey: string, yKey: string, aggregation = "sum"): Array<Record<string, string | number>> {
  const groups = new Map<string, number[]>();

  for (const row of rows) {
    const raw = row[xKey];
    const rawStr = String(raw ?? "");
    const label = rawStr && !Number.isNaN(Date.parse(rawStr))
      ? new Date(rawStr).toISOString().slice(0, 10)
      : rawStr;
    if (!label) continue;
    const val = typeof row[yKey] === "number" ? (row[yKey] as number) : Number(row[yKey]);
    if (!groups.has(label)) groups.set(label, []);
    if (Number.isFinite(val)) groups.get(label)!.push(val);
  }

  return Array.from(groups.entries())
    .map(([label, vals]) => ({
      [xKey]: label,
      [yKey]: aggregation === "sum" ? vals.reduce((s, v) => s + v, 0)
        : aggregation === "avg" ? (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0)
          : aggregation === "max" ? Math.max(...vals)
            : aggregation === "min" ? Math.min(...vals)
              : vals.length,
    }))
    .sort((a, b) => String(a[xKey]).localeCompare(String(b[xKey])))
    .slice(-30);
}

function buildHistogramData(rows: Row[], key: string, bins = 8): Array<Record<string, string | number>> {
  const values = rows
    .map((r) => typeof r[key] === "number" ? (r[key] as number) : Number(r[key]))
    .filter((v) => Number.isFinite(v));

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ range: String(min), count: values.length }];

  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    start: min + i * step,
    end: i === bins - 1 ? max : min + (i + 1) * step,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    buckets[idx].count += 1;
  }

  return buckets.map((b) => ({
    range: `${b.start.toFixed(1)}-${b.end.toFixed(1)}`,
    count: b.count,
  }));
}

function buildScatterData(rows: Row[], xKey: string, yKey: string, limit = 250): Array<Record<string, string | number>> {
  return rows
    .map((r, i) => ({
      [xKey]: Number(r[xKey]),
      [yKey]: Number(r[yKey]),
      _idx: i,
    }))
    .filter((d) => Number.isFinite(d[xKey]) && Number.isFinite(d[yKey]))
    .filter((_, i) => i % Math.max(1, Math.floor(rows.length / limit)) === 0)
    .slice(0, limit) as Array<Record<string, string | number>>;
}

const REJECTED_CHART_PATTERNS = [
  /name\s+(distribution|breakdown|count|by)/i,
  /reviewer\s+name/i,
  /customer\s+name/i,
  /patient\s+name/i,
  /doctor\s+(distribution|count)/i,
  /profile\s+link/i,
  /url\s+(distribution|count)/i,
  /email\s+(distribution|count)/i,
  /text\s+(distribution|count)/i,
  /description\s+(distribution|count)/i,
  /rating\s+vs\s+url/i,
  /sales\s+vs\s+name/i,
  /billing\s+vs\s+doctor/i,
];

function isRejectedChart(title: string, xKey: string, yKey: string): boolean {
  const check = `${title} ${xKey} ${yKey}`;
  return REJECTED_CHART_PATTERNS.some((p) => p.test(check));
}

export function generateCharts(rows: Row[], schema: InsightFlowSchema, datasetType: DatasetType): InsightFlowChart[] {
  const charts: InsightFlowChart[] = [];
  const usedIntents = new Set<string>();
  const usedPatterns = new Set<string>();
  const usedXKeys = new Set<string>();

  function addChart(
    type: ChartType, title: string, xKey: string, yKey: string,
    aggregation: string, intent: ChartIntent, businessValue: string,
    data: Array<Record<string, string | number>>, warning?: string
  ) {
    const pattern = `${intent}|${xKey}|${yKey}|${type}`;
    if (usedPatterns.has(pattern)) return;
    if (usedIntents.has(intent) && charts.length >= 4) return;
    if (isRejectedChart(title, xKey, yKey)) return;

    usedIntents.add(intent);
    usedPatterns.add(pattern);
    usedXKeys.add(xKey);

    // Issue #3: For scatter/correlation charts, replace "NONE" aggregation with "Correlation"
    const displayAggregation = aggregation === "none" && intent === "correlation"
      ? "Correlation"
      : aggregation.toUpperCase();

    charts.push({
      id: crypto.randomUUID(),
      type,
      title,
      subtitle: `${displayAggregation} - ${xKey} vs ${yKey}`,
      xKey,
      yKey,
      aggregation,
      intent,
      data,
      businessValue,
      warning,
    });
  }

  const primaryMetric = schema.numeric[0];
  const secondaryMetric = schema.numeric.length > 1 ? schema.numeric[1] : undefined;
  const primaryCat = schema.categories[0];
  const dateCol = schema.dates[0];
  const geoCol = schema.geo[0];

  // 1. Trend — Date vs Metric
  if (dateCol && primaryMetric) {
    addChart("line", `${primaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Over Time`,
      dateCol.name, primaryMetric.name, "sum", "trend",
      "Temporal trend analysis",
      buildTrendData(rows, dateCol.name, primaryMetric.name, "sum"));
  }

  // 2. Distribution — Histogram of primary metric
  if (primaryMetric) {
    addChart("histogram", `${primaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Distribution`,
      "range", primaryMetric.name, "count", "distribution",
      "Value distribution analysis",
      buildHistogramData(rows, primaryMetric.name));
  }

  // 2b. Distribution — Histogram of secondary metric (if exists)
  if (secondaryMetric && secondaryMetric.name !== primaryMetric?.name) {
    addChart("histogram",
      `${secondaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Distribution`,
      "range", secondaryMetric.name, "count", "distribution",
      "Secondary metric distribution",
      buildHistogramData(rows, secondaryMetric.name));
  }

  // 3. Comparison — Bar: primary cat × primary metric
  if (primaryCat && primaryMetric) {
    addChart("bar",
      `${primaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} by ${primaryCat.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      primaryCat.name, primaryMetric.name, "avg", "comparison",
      "Category performance comparison",
      buildGroupedData(rows, primaryCat.name, primaryMetric.name, "avg"));
  } else if (primaryMetric && secondaryMetric) {
    addChart("bar", `${primaryMetric.name} vs ${secondaryMetric.name}`,
      primaryMetric.name, secondaryMetric.name, "avg", "comparison",
      "Metric comparison",
      buildGroupedData(rows, primaryMetric.name, secondaryMetric.name, "avg"));
  }

  // 4. Correlation — Scatter
  if (primaryMetric && secondaryMetric) {
    addChart("scatter",
      `${primaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} vs ${secondaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      primaryMetric.name, secondaryMetric.name, "none", "correlation",
      "Correlation analysis between key metrics",
      buildScatterData(rows, primaryMetric.name, secondaryMetric.name));
  }

  // 5. Composition — Donut of primary category
  if (primaryCat) {
    addChart("donut", `Records by ${primaryCat.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      primaryCat.name, "count", "count", "composition",
      "Category composition breakdown",
      buildGroupedData(rows, primaryCat.name, primaryCat.name, "count"));
  }

  // 6. Geographic — Horizontal bar ranking
  if (geoCol && primaryMetric) {
    addChart("horizontalBar",
      `${primaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} by ${geoCol.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      geoCol.name, primaryMetric.name, "sum", "geo",
      "Geographic performance analysis",
      buildGroupedData(rows, geoCol.name, primaryMetric.name, "sum"));
  }

  // 7. Relationship — Domain-specific deep insight (horizontalBar top-N)
  if (primaryCat && primaryMetric) {
    const deepInsightTitle = getDeepInsightTitle(datasetType, primaryCat.name, primaryMetric.name);
    addChart("horizontalBar", deepInsightTitle,
      primaryCat.name, primaryMetric.name, "max", "relationship",
      "Deep domain insight",
      buildGroupedData(rows, primaryCat.name, primaryMetric.name, "max"));
  } else if (primaryMetric && schema.categories.length > 0) {
    addChart("bar", `Top Analysis by ${schema.categories[0].name}`,
      schema.categories[0].name, primaryMetric.name, "sum", "relationship",
      "Top performer analysis",
      buildGroupedData(rows, schema.categories[0].name, primaryMetric.name, "sum"));
  }

  // 8+. Extra category charts — iterate unused categories (Gender, Board, Category, etc.)
  //     Add a bar chart for each, plus a donut for the second category.
  if (primaryMetric) {
    for (let i = 1; i < schema.categories.length && charts.length < 9; i++) {
      const cat = schema.categories[i];
      if (usedXKeys.has(cat.name)) continue;

      // Donut for second category (composition)
      if (i === 1) {
        addChart("donut",
          `Distribution by ${cat.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
          cat.name, "count", "count", "composition",
          `Breakdown by ${cat.name}`,
          buildGroupedData(rows, cat.name, cat.name, "count"));
      }

      // Bar for remaining categories × primary metric
      if (charts.length < 9) {
        addChart("bar",
          `${primaryMetric.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} by ${cat.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
          cat.name, primaryMetric.name, "avg", "comparison",
          `Performance broken down by ${cat.name}`,
          buildGroupedData(rows, cat.name, primaryMetric.name, "avg"));
      }
    }
  }

  // Fallback: ensure we have at least 1 chart
  if (charts.length === 0 && schema.numeric.length > 0) {
    addChart("bar", "Data Overview",
      schema.numeric[0].name, schema.numeric[0].name, "count", "comparison",
      "Basic data overview",
      buildGroupedData(rows, schema.numeric[0].name, schema.numeric[0].name, "count"));
  }

  return charts.slice(0, 7);
}

function getDeepInsightTitle(datasetType: DatasetType, cat: string, metric: string): string {
  const titles: Record<DatasetType, string> = {
    Healthcare: `Top ${cat} by ${metric} (Critical Analysis)`,
    HR: `Top ${cat} by ${metric} (Talent Analysis)`,
    Sales: `Top ${cat} by ${metric} (Revenue Analysis)`,
    Finance: `Top ${cat} by ${metric} (Financial Analysis)`,
    Marketing: `Top ${cat} by ${metric} (Campaign Analysis)`,
    Reviews: `Top ${cat} by ${metric} (Sentiment Analysis)`,
    Ecommerce: `Top ${cat} by ${metric} (Product Analysis)`,
    Manufacturing: `Top ${cat} by ${metric} (Quality Analysis)`,
    Education: `Top ${cat} by ${metric} (Performance Analysis)`,
    Logistics: `Top ${cat} by ${metric} (Efficiency Analysis)`,
    SaaS: `Top ${cat} by ${metric} (Growth Analysis)`,
    General: `Top ${cat} by ${metric}`,
  };
  return titles[datasetType] || titles.General;
}

/* ============================================================
   STEP 5: GEO INTELLIGENCE
   ============================================================ */

export function buildGeoIntelligence(rows: Row[], schema: InsightFlowSchema): GeoIntelligence {
  const geoCol = schema.geo[0];
  if (!geoCol || !rows.length) {
    return {
      enabled: false, field: "", metricField: "", mapType: "none",
      locations: [], totalLocations: 0, topLocation: null,
      totalRecords: rows.length, globalAverage: 0,
      mostCommonCategory: "", recommendation: "",
    };
  }

  const metricCol = schema.numeric.find((c) => {
    const n = normalize(c.name);
    return ["revenue", "profit", "sales", "billing_amount", "salary", "orders", "customers", "patients", "review_count", "rating"].some((k) => n.includes(k));
  }) || schema.numeric[0];

  const metricField = metricCol?.name || "__count__";

  const grouped = new Map<string, { values: number[]; count: number }>();
  for (const row of rows) {
    const loc = String(row[geoCol.name] ?? "").trim();
    if (!loc) continue;
    if (!grouped.has(loc)) grouped.set(loc, { values: [], count: 0 });
    const entry = grouped.get(loc)!;
    if (metricField !== "__count__") {
      const v = typeof row[metricField] === "number" ? (row[metricField] as number) : Number(row[metricField]);
      if (Number.isFinite(v)) entry.values.push(v);
    }
    entry.count += 1;
  }

  const locations: GeoLocation[] = Array.from(grouped.entries()).map(([name, data]) => {
    const metricValue = metricField === "__count__" ? data.count
      : data.values.length ? data.values.reduce((s, v) => s + v, 0) / data.values.length : 0;
    return { name, metricValue, recordCount: data.count, rank: 0, formattedValue: "", highlight: "medium", contributionPct: 0 };
  });

  locations.sort((a, b) => b.metricValue - a.metricValue);
  const total = locations.reduce((s, l) => s + l.metricValue, 0) || 1;

  locations.forEach((loc, i) => {
    loc.rank = i + 1;
    loc.formattedValue = formatKpiValue(loc.metricValue, "number");
    loc.contributionPct = Math.round((loc.metricValue / total) * 100);

    const pct = i / locations.length;
    if (pct < 0.2) loc.highlight = "high";
    else if (pct < 0.6) loc.highlight = "medium";
    else loc.highlight = "low";
  });

  const globalAvg = locations.length ? locations.reduce((s, l) => s + l.metricValue, 0) / locations.length : 0;
  const mostCommonCat = schema.categories[0]?.name || "";
  const catValues = mostCommonCat ? new Set(rows.map((r) => String(r[mostCommonCat] ?? "").trim()).filter(Boolean)) : new Set<string>();

  // Map type selection
  let mapType: GeoIntelligence["mapType"] = "choropleth";
  if (locations.length === 1) mapType = "single";
  else if (schema.columns.some((c) => normalize(c.name).includes("lat") || normalize(c.name).includes("long"))) mapType = "marker";
  else if (schema.columns.some((c) => normalize(c.name).includes("state") || normalize(c.name).includes("province"))) mapType = "regional";

  const topLoc = locations[0] || null;
  const recommendation = topLoc
    ? `${topLoc.name} leads with ${topLoc.formattedValue} — consider benchmarking other locations against this.`
    : "Add location data for geo insights.";

  return {
    enabled: locations.length > 0,
    field: geoCol.name,
    metricField,
    mapType,
    locations,
    totalLocations: locations.length,
    topLocation: topLoc,
    totalRecords: rows.length,
    globalAverage: globalAvg,
    mostCommonCategory: mostCommonCat,
    recommendation,
  };
}

/* ============================================================
   STEP 6: FILTER INTELLIGENCE
   ============================================================ */

const USELESS_FILTER_TERMS = ["name", "id", "url", "email", "phone", "address", "profile", "link", "text", "description", "notes", "comment", "uuid"];

function isUselessFilter(col: string): boolean {
  const n = normalize(col);
  return USELESS_FILTER_TERMS.some((t) => n === t || n.endsWith(`_${t}`) || n.endsWith(t));
}

export function generateFilters(rows: Row[], schema: InsightFlowSchema): InsightFlowFilter[] {
  const filters: InsightFlowFilter[] = [];

  // Date filter
  if (schema.dates.length > 0) {
    filters.push({
      key: schema.dates[0].name,
      label: `Date Range`,
      type: "date",
      values: [],
      priority: 1,
    });
  }

  // Geo filter
  if (schema.geo.length > 0) {
    const geoCol = schema.geo[0];
    const vals = Array.from(new Set(rows.map((r) => String(r[geoCol.name] ?? "").trim()).filter(Boolean))).sort();
    if (vals.length > 1 && vals.length <= 200) {
      filters.push({
        key: geoCol.name,
        label: geoCol.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        type: "geo",
        values: vals.slice(0, 100),
        priority: 2,
      });
    }
  }

  // Category filters
  for (const cat of schema.categories) {
    if (isUselessFilter(cat.name)) continue;
    const vals = Array.from(new Set(rows.map((r) => String(r[cat.name] ?? "").trim()).filter(Boolean))).sort();
    if (vals.length > 1 && vals.length <= 100) {
      filters.push({
        key: cat.name,
        label: cat.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        type: "category",
        values: vals.slice(0, 50),
        priority: 3,
      });
    }
  }

  // Business dimensions
  const businessKeywords = ["department", "product", "segment", "region", "market", "channel", "platform", "status", "type", "category"];
  for (const col of schema.columns) {
    if (businessKeywords.some((k) => normalize(col.name).includes(k))) {
      if (filters.some((f) => f.key === col.name)) continue;
      if (isUselessFilter(col.name)) continue;
      const vals = Array.from(new Set(rows.map((r) => String(r[col.name] ?? "").trim()).filter(Boolean))).sort();
      if (vals.length > 1 && vals.length <= 50) {
        filters.push({
          key: col.name,
          label: col.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          type: "business",
          values: vals,
          priority: 4,
        });
      }
    }
  }

  return filters.sort((a, b) => a.priority - b.priority);
}

/* ============================================================
   STEP 8: CHART QUALITY RULES (used by self-critic)
   ============================================================ */

function validateChartQuality(
  chart: InsightFlowChart, allCharts: InsightFlowChart[], schema: InsightFlowSchema
): string[] {
  const issues: string[] = [];

  // Reject meaningless charts
  if (isRejectedChart(chart.title, chart.xKey, chart.yKey)) {
    issues.push("Chart title or axes match rejected meaningless patterns");
  }

  // Check if chart has data
  if (!chart.data || chart.data.length === 0) {
    issues.push("Chart has no data");
  }

  // Check redundancy: same xKey and yKey and intent as another chart
  const duplicate = allCharts.filter(
    (c) => c.id !== chart.id && c.xKey === chart.xKey && c.yKey === chart.yKey && c.intent === chart.intent
  );
  if (duplicate.length > 0) {
    issues.push("Redundant chart - same dimensions and intent as another chart");
  }

  // Person columns should never be chart axes
  const xCol = schema.columns.find((c) => c.name === chart.xKey);
  const yCol = schema.columns.find((c) => c.name === chart.yKey);
  if (xCol?.class === "person") issues.push(`X-axis "${chart.xKey}" is a person column - meaningless`);
  if (yCol?.class === "person") issues.push(`Y-axis "${chart.yKey}" is a person column - meaningless`);
  if (xCol?.class === "identifier") issues.push(`X-axis "${chart.xKey}" is an identifier - meaningless`);
  if (yCol?.class === "identifier") issues.push(`Y-axis "${chart.yKey}" is an identifier - meaningless`);

  // Scatter needs numeric columns
  if (chart.type === "scatter") {
    const xNumeric = schema.numeric.some((c) => c.name === chart.xKey);
    const yNumeric = schema.numeric.some((c) => c.name === chart.yKey);
    if (!xNumeric || !yNumeric) issues.push("Scatter chart requires numeric columns for both axes");
  }

  // Line/area need date x-axis
  if ((chart.type === "line" || chart.type === "area") && !schema.dates.some((c) => c.name === chart.xKey)) {
    issues.push("Trend chart requires a date/time column on the X axis");
  }

  return issues;
}

/* ============================================================
   SELF-CRITIC MODE — Dashboard Self-Critic
   ============================================================ */

export function runSelfCritic(
  charts: InsightFlowChart[], kpis: InsightFlowKPI[], schema: InsightFlowSchema, datasetType: DatasetType
): CriticReport {
  const issues: string[] = [];
  const replacements: CriticReport["replacements"] = [];

  // 1. Check if charts are meaningful
  if (charts.length === 0) {
    issues.push("No charts generated");
  }

  // 2. Check diversity of intents
  const intents = new Set(charts.map((c) => c.intent));
  if (intents.size < 3) {
    issues.push(`Low chart diversity: only ${intents.size} unique chart intents (need at least 3)`);
  }

  // Only require intents that make sense for this dataset:
  // - Skip "geo" requirement if the schema has no geo columns
  // - Skip "trend" requirement if schema has no date columns
  // - Skip "relationship" if there's only one category (no cross-dim comparison available)
  const hasGeo = schema.geo.length > 0;
  const hasDate = schema.dates.length > 0;
  const hasMultiCat = schema.categories.length > 1;

  const requiredIntents: ChartIntent[] = [
    "distribution",
    "comparison",
    "correlation",
    "composition",
    ...(hasDate ? ["trend" as ChartIntent] : []),
    ...(hasGeo ? ["geo" as ChartIntent] : []),
    ...(hasMultiCat ? ["relationship" as ChartIntent] : []),
  ];

  for (const ri of requiredIntents) {
    if (!intents.has(ri)) {
      issues.push(`Missing recommended chart intent: ${ri}`);
    }
  }

  // 3. Check KPI usefulness
  if (kpis.length < 3) issues.push("Too few KPIs generated");
  const uselessKpis = kpis.filter((k) => {
    const col = schema.columns.find((c) => c.name === k.metric);
    return col?.class === "person" || col?.class === "identifier";
  });
  if (uselessKpis.length > 0) issues.push(`${uselessKpis.length} KPI(s) use person/identifier columns`);

  // 4. Check geo metric correctness (only when geo chart exists)
  const geoChart = charts.find((c) => c.intent === "geo");
  if (geoChart) {
    const yCol = schema.columns.find((c) => c.name === geoChart.yKey);
    if (yCol && yCol.class !== "numeric") {
      issues.push(`Geo chart uses non-numeric metric: ${geoChart.yKey}`);
    }
  }

  // 5. Check chart quality (validate each)
  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i];
    const chartIssues = validateChartQuality(chart, charts, schema);
    if (chartIssues.length > 0) {
      issues.push(`Chart "${chart.title}": ${chartIssues.join("; ")}`);

      // Try to find replacement
      const replacement = findReplacementChart(chart, charts, schema, datasetType);
      if (replacement) {
        replacements.push({ index: i, reason: chartIssues.join("; "), replacement });
      }
    }
  }

  // 6. Score — denominator is adjusted required intents length
  const diversityScore = Math.min(100, (intents.size / Math.max(requiredIntents.length, 3)) * 100);
  const kpiScore = Math.min(100, (kpis.filter((k) => !uselessKpis.includes(k)).length / Math.max(kpis.length, 1)) * 100);
  const qualityScore = charts.length > 0
    ? Math.min(100, (charts.filter((c) => validateChartQuality(c, charts, schema).length === 0).length / charts.length) * 100)
    : 0;
  const finalScore = Math.round((diversityScore * 0.4 + kpiScore * 0.3 + qualityScore * 0.3));

  return {
    passed: issues.length === 0,
    issues,
    replacements,
    score: finalScore,
  };
}

function findReplacementChart(
  badChart: InsightFlowChart, _allCharts: InsightFlowChart[], schema: InsightFlowSchema, datasetType: DatasetType
): InsightFlowChart | null {
  const usedXKeys = new Set(_allCharts.map((c) => c.xKey));
  const usedYKeys = new Set(_allCharts.map((c) => c.yKey));
  const usedIntents = new Set(_allCharts.map((c) => c.intent));

  // Try to find unused combinations
  const unusedNumeric = schema.numeric.filter((c) => !usedYKeys.has(c.name));
  const unusedCats = schema.categories.filter((c) => !usedXKeys.has(c.name) && !["name", "id"].some((t) => normalize(c.name).includes(t)));

  if (unusedNumeric.length > 0 && unusedCats.length > 0 && !usedIntents.has("comparison")) {
    return {
      id: crypto.randomUUID(),
      type: "bar",
      title: `${unusedCats[0].name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Analysis by ${unusedNumeric[0].name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      subtitle: `AVG - ${unusedCats[0].name} vs ${unusedNumeric[0].name}`,
      xKey: unusedCats[0].name,
      yKey: unusedNumeric[0].name,
      aggregation: "avg",
      intent: "comparison",
      data: buildGroupedData([], unusedCats[0].name, unusedNumeric[0].name, "avg"),
      businessValue: "Comparison analysis",
    };
  }

  return null;
}

/* ============================================================
   STEP 9: INSIGHT ENGINE
   ============================================================ */

export function generateInsights(
  kpis: InsightFlowKPI[], charts: InsightFlowChart[], geo: GeoIntelligence, schema: InsightFlowSchema, datasetType: DatasetType
): InsightTier {
  const topKpi = kpis.slice(0, 3);
  const topGeo = geo.topLocation;

  // Executive Insight
  const executiveParts: string[] = [];
  if (topKpi.length > 0) {
    executiveParts.push(`Total Records: ${kpis[0]?.value || "—"}`);
  }
  if (topKpi.length > 1) {
    executiveParts.push(`${topKpi[1].title}: ${topKpi[1].value}`);
  }
  if (topGeo) {
    executiveParts.push(`Top Location: ${topGeo.name} (${topGeo.formattedValue}, ${topGeo.contributionPct}% contribution)`);
  }
  const executive = executiveParts.length
    ? `Executive Summary [${datasetType}]: ${executiveParts.join(" | ")}. The dataset covers ${schema.rowCount.toLocaleString()} records across ${schema.columns.length} dimensions.`
    : `Dataset loaded with ${schema.rowCount.toLocaleString()} records. Configure AI for deeper insights.`;

  // Analyst Insight
  const analystParts: string[] = [];
  const topChart = charts[0];
  if (topChart && topChart.data.length > 0) {
    const topItem = topChart.data[0];
    const topLabel = topItem[topChart.xKey];
    const topVal = topItem[topChart.yKey];
    if (topLabel !== undefined && topVal !== undefined) {
      analystParts.push(`${String(topLabel)} leads with ${formatKpiValue(Number(topVal), "number")} in ${topChart.yKey}`);
    }
  }
  if (geo.locations.length > 0) {
    analystParts.push(`Geographic analysis covers ${geo.totalLocations} locations with an average of ${formatKpiValue(geo.globalAverage, "number")}`);
  }
  const analyst = analystParts.length
    ? `Analyst Insight: ${analystParts.join(". ")}. ${charts.length} charts generated with ${charts.filter((c) => c.data.length > 0).length} populated.`
    : "Analyst mode ready. Charts will populate with sufficient data dimensions.";

  // Story Insight
  const storyParts: string[] = [];
  if (topGeo) {
    const topCat = geo.mostCommonCategory
      ? `The most common category across locations is ${geo.mostCommonCategory}.`
      : "";
    storyParts.push(`${topGeo.name} emerges as the top ${datasetType.toLowerCase()} location with ${topGeo.formattedValue} in ${geo.metricField}. ${topCat}`);
  }
  if (charts.length >= 3) {
    const trendChart = charts.find((c) => c.intent === "trend");
    const compChart = charts.find((c) => c.intent === "comparison");
    if (trendChart && trendChart.data.length > 0) {
      const first = trendChart.data[0];
      const last = trendChart.data[trendChart.data.length - 1];
      storyParts.push(`Over time, ${trendChart.yKey} moved from ${String(first[trendChart.yKey] ?? "—")} to ${String(last[trendChart.yKey] ?? "—")}.`);
    }
    if (compChart && compChart.data.length > 1) {
      storyParts.push(`${compChart.title} reveals performance variations across segments.`);
    }
  }
  storyParts.push(`This ${datasetType} dataset tells a story of ${schema.numeric.length} key metrics across ${schema.categories.length} categorical dimensions.`);
  const story = storyParts.length ? storyParts.join(" ") : "Story mode ready. Upload more dimensional data for richer narratives.";

  return { executive, analyst, story };
}

/* ============================================================
   STEP 10: DASHBOARD SCORING
   ============================================================ */

export function scoreDashboard(
  kpis: InsightFlowKPI[], charts: InsightFlowChart[], geo: GeoIntelligence, filters: InsightFlowFilter[], schema: InsightFlowSchema, datasetType: DatasetType
): DashboardScore {
  // KPI relevance: 0-100
  let kpiRelevance = 55;
  if (kpis.length >= 3) kpiRelevance += 15;
  if (kpis.length >= 5) kpiRelevance += 10;
  // Domain-aware: give credit if KPI titles use column names that exist in schema
  const schemaNames = new Set(schema.columns.map((c) => normalize(c.name)));
  const relevantKpis = kpis.filter((k) => k.metric === "__row_count__" || schemaNames.has(normalize(k.metric)));
  if (relevantKpis.length >= 2) kpiRelevance += 20;

  // Chart diversity: 0-100
  const intents = new Set(charts.map((c) => c.intent));
  let chartDiversity = intents.size * 16;
  if (charts.length >= 5) chartDiversity = Math.min(100, chartDiversity + 10);
  const dataPopulated = charts.filter((c) => c.data.length > 0).length;
  if (dataPopulated >= 4) chartDiversity += 10;

  // Geo relevance: 0-100
  // Issue #2: Datasets without geo columns should not be penalized
  let geoRelevance = 0;
  if (geo.enabled) {
    geoRelevance = 70;
    if (geo.locations.length >= 3) geoRelevance += 15;
    if (geo.topLocation) geoRelevance += 15;
  } else {
    // No geo columns = full credit (geo is optional for Education/HR/etc)
    geoRelevance = schema.geo.length === 0 ? 100 : 30;
  }

  // Business usefulness: 0-100
  let businessUsefulness = 45;
  if (schema.numeric.length >= 2) businessUsefulness += 15;
  if (schema.categories.length >= 2) businessUsefulness += 15;
  if (datasetType !== "General") businessUsefulness += 15;
  if (charts.some((c) => c.intent === "comparison")) businessUsefulness += 10;

  // Filter usefulness: 0-100
  let filterUsefulness = 20;
  if (filters.length > 0) filterUsefulness = 50;
  if (filters.some((f) => f.type === "category")) filterUsefulness += 25;
  if (filters.some((f) => f.type === "geo" || f.type === "date")) filterUsefulness += 15;
  const uselessCount = filters.filter((f) => isUselessFilter(f.key)).length;
  if (uselessCount === 0) filterUsefulness = Math.min(100, filterUsefulness + 10);

  const total = Math.round(
    kpiRelevance * 0.25 +
    chartDiversity * 0.30 +
    geoRelevance * 0.10 +
    businessUsefulness * 0.20 +
    filterUsefulness * 0.15
  );

  return {
    total: Math.min(100, total),
    kpiRelevance,
    chartDiversity,
    geoRelevance,
    businessUsefulness,
    filterUsefulness,
    passed: total >= 80,
  };
}

/* ============================================================
   MAIN ENTRY POINT — Full Pipeline
   ============================================================ */

export function runInsightFlow(rows: Row[]): InsightFlowResult {
  if (!rows.length) {
    return {
      valid: false,
      dashboardType: "Empty Dataset",
      datasetType: "General",
      qualityScore: {
        total: 0, kpiRelevance: 0, chartDiversity: 0,
        geoRelevance: 0, businessUsefulness: 0, filterUsefulness: 0, passed: false,
      },
      kpis: [],
      charts: [],
      geoIntelligence: {
        enabled: false, field: "", metricField: "", mapType: "none",
        locations: [], totalLocations: 0, topLocation: null,
        totalRecords: 0, globalAverage: 0, mostCommonCategory: "", recommendation: "",
      },
      filters: [],
      insights: { executive: "", analyst: "", story: "" },
    };
  }

  // Step 1: Schema Understanding
  const schema = buildInsightFlowSchema(rows);

  // Step 2: Dataset Type Detection
  const datasetType = detectDatasetType(schema);

  // Step 3: KPI Generation
  let kpis = generateKPIs(rows, schema, datasetType);

  // Step 4: Chart Planner
  let charts = generateCharts(rows, schema, datasetType);

  // Step 5: Geo Intelligence
  const geoIntelligence = buildGeoIntelligence(rows, schema);

  // Step 6: Filter Intelligence
  const filters = generateFilters(rows, schema);

  // Step 8-9: Self Critic + Quality Validation
  const critic = runSelfCritic(charts, kpis, schema, datasetType);

  // Apply critic replacements
  if (critic.replacements.length > 0) {
    for (const rep of critic.replacements) {
      if (rep.index < charts.length) {
        charts[rep.index] = rep.replacement;
      }
    }
  }

  // Re-run critic after replacements
  const finalCritic = runSelfCritic(charts, kpis, schema, datasetType);

  // Step 9: Insight Engine
  const insights = generateInsights(kpis, charts, geoIntelligence, schema, datasetType);

  // Step 10: Dashboard Scoring
  let qualityScore = scoreDashboard(kpis, charts, geoIntelligence, filters, schema, datasetType);

  // Auto-regenerate if score < 85
  if (!qualityScore.passed && rows.length > 10) {
    charts = charts.slice(0, 5).concat(
      generateCharts(rows, schema, datasetType)
        .filter((c) => !charts.some((ec) => ec.intent === c.intent))
        .slice(0, 2)
    );
    kpis = kpis.slice(0, 4);

    qualityScore = scoreDashboard(kpis, charts, geoIntelligence, filters, schema, datasetType);
  }

  // Dashboard type string
  const dashboardType = `${datasetType} Intelligence Dashboard${geoIntelligence.enabled ? " + Geo" : ""}`;

  return {
    valid: finalCritic.score >= 60,
    dashboardType,
    datasetType,
    qualityScore,
    kpis,
    charts,
    geoIntelligence,
    filters,
    insights,
  };
}