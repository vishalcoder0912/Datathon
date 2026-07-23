import type { Row } from "@/features/dashboard/utils/dashboardAnalytics";
import type { DashboardFilters } from "@/features/dashboard/types/dashboardTypes";

/* ============================================================
   Runtime Context Recovery Engine
   
   Ensures every AI/LLM call includes:
   - dataset_name, row_count, schema (required)
   - column_profiles (with type classifications)
   - active_filters
   - dashboard_state
   - rag_context (if available)
   ============================================================ */

export interface ColumnProfile {
  type: "numeric" | "geo" | "date" | "category" | "person" | "identifier" | "text" | "unknown";
  unique_values?: number;
  missing_pct?: number;
  sample_values?: string[];
}

export interface RuntimeContext {
  dataset_name: string;
  row_count: number;
  schema: string[];
  column_profiles: Record<string, ColumnProfile>;
  active_filters: Record<string, unknown>;
  current_dashboard_state: {
    kpis: unknown[];
    charts: unknown[];
    filters: unknown[];
  };
  rag_context: unknown[];
  recovered_context: boolean;
  recovery_reason?: string;
}

const NUMERIC_HINTS = [
  "revenue", "profit", "sales", "salary", "billing_amount", "amount",
  "orders", "quantity", "customers", "patients", "rating",
  "review_count", "cost", "price", "risk_score", "income", "expense",
  "margin", "score", "count", "age", "year", "budget",
];

const GEO_KEYWORDS = [
  "country", "city", "state", "province", "region", "territory",
  "market", "latitude", "longitude", "location", "address",
];

const DATE_KEYWORDS = [
  "date", "time", "year", "month", "quarter", "period",
  "created", "updated", "timestamp", "datetime",
];

const PERSON_KEYWORDS = [
  "name", "reviewer", "customer", "patient", "employee",
  "doctor", "full_name", "first_name", "last_name",
];

const ID_KEYWORDS = [
  "id", "uuid", "key", "code", "serial", "index",
];

const TEXT_KEYWORDS = [
  "review_text", "description", "notes", "comments", "feedback",
  "message", "content", "body", "text",
];

function normalize(col: string): string {
  return col.toLowerCase().replace(/[_\s-]/g, "");
}

function inferColumnType(name: string, values: unknown[]): ColumnProfile["type"] {
  const n = normalize(name);

  if (GEO_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k)))) return "geo";
  if (DATE_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k)))) return "date";
  if (PERSON_KEYWORDS.some((k) => normalize(k) === n || n.endsWith(normalize(k)))) return "person";
  if (ID_KEYWORDS.some((k) => normalize(k) === n || n.endsWith(normalize(k)))) return "identifier";
  if (TEXT_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k)))) return "text";

  if (NUMERIC_HINTS.some((k) => normalize(k) === n || n.includes(normalize(k)))) return "numeric";

  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericRatio = nonNull.length > 0
    ? nonNull.filter((v) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))).length / nonNull.length
    : 0;

  if (numericRatio >= 0.85) return "numeric";

  const uniqueRatio = nonNull.length > 0
    ? new Set(nonNull.map((v) => String(v).trim())).size / nonNull.length
    : 0;

  if (uniqueRatio <= 0.3 && nonNull.length > 0) return "category";

  return "text";
}

function buildColumnProfiles(rows: Row[], columns: string[]): Record<string, ColumnProfile> {
  if (!rows.length || !columns.length) return {};

  const profiles: Record<string, ColumnProfile> = {};

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    const type = inferColumnType(col, values);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");

    const profile: ColumnProfile = { type };

    if (type === "geo" || type === "category") {
      profile.unique_values = new Set(nonNull.map((v) => String(v).trim())).size;
    }

    if (type !== "identifier" && type !== "person") {
      profile.sample_values = Array.from(new Set(nonNull.map((v) => String(v).trim()))).slice(0, 3);
    }

    profiles[col] = profile;
  }

  return profiles;
}

export function buildRuntimeContext(
  options: {
    datasetName?: string;
    rows?: Row[];
    columns?: string[];
    filters?: DashboardFilters;
    currentDashboardState?: { kpis?: unknown[]; charts?: unknown[]; filters?: unknown[] };
    ragContext?: unknown[];
  } = {},
): RuntimeContext {
  const {
    datasetName = "Uploaded Dataset",
    rows = [],
    columns = [],
    filters = {},
    currentDashboardState = { kpis: [], charts: [], filters: [] },
    ragContext = [],
  } = options;

  // Schema is the only required field
  const schema = columns.length
    ? columns
    : rows.length
      ? Object.keys(rows[0]).filter((k) => !k.startsWith("__"))
      : [];

  if (!schema.length) {
    return {
      dataset_name: datasetName,
      row_count: rows.length,
      schema: [],
      column_profiles: {},
      active_filters: filters,
      current_dashboard_state: currentDashboardState,
      rag_context: ragContext,
      recovered_context: false,
      recovery_reason: "Schema unavailable — no columns or data found.",
    };
  }

  // Build column profiles from data (infer from schema names if no data)
  const columnProfiles = rows.length
    ? buildColumnProfiles(rows, schema)
    : schema.reduce<Record<string, ColumnProfile>>((acc, col) => {
        const n = normalize(col);
        if (GEO_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k)))) acc[col] = { type: "geo" };
        else if (DATE_KEYWORDS.some((k) => normalize(k) === n || n.includes(normalize(k)))) acc[col] = { type: "date" };
        else if (NUMERIC_HINTS.some((k) => normalize(k) === n || n.includes(normalize(k)))) acc[col] = { type: "numeric" };
        else if (PERSON_KEYWORDS.some((k) => normalize(k) === n || n.endsWith(normalize(k)))) acc[col] = { type: "person" };
        else if (ID_KEYWORDS.some((k) => normalize(k) === n || n.endsWith(normalize(k)))) acc[col] = { type: "identifier" };
        else acc[col] = { type: "text" };
        return acc;
      }, {});

  const recoveryReasons: string[] = [];

  if (!datasetName) {
    recoveryReasons.push("dataset_name missing — used default");
  }

  const hasAllProfiles = schema.every((col) => columnProfiles[col]?.type);
  if (Object.keys(columnProfiles).length < schema.length) {
    recoveryReasons.push("column_profiles partially inferred from schema names");
  }

  return {
    dataset_name: datasetName || "Uploaded Dataset",
    row_count: rows.length,
    schema,
    column_profiles: columnProfiles,
    active_filters: filters,
    current_dashboard_state: currentDashboardState,
    rag_context: ragContext,
    recovered_context: recoveryReasons.length > 0,
    recovery_reason: recoveryReasons.length
      ? `Recovered: ${recoveryReasons.join("; ")}. Proceeding with available schema.`
      : undefined,
  };
}
