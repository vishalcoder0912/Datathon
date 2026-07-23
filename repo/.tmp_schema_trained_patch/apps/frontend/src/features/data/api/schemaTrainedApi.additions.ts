// Paste these types and methods into apps/frontend/src/features/data/api/dataApi.ts
// inside your existing api object. Keep your existing request<T>() helper.

export type SchemaDashboardResponse = {
  success: boolean;
  schemaOnly: true;
  profile: {
    datasetName: string;
    rowCount: number;
    columnCount: number;
    domain: string;
    signature: string;
    columns: Array<{
      name: string;
      type: string;
      role: string;
      uniqueCount: number;
      missingPct: number;
      topValues?: string[];
    }>;
  };
  match: null | { dataset: string; domain: string; score: number };
  dashboard: {
    domain: string;
    kpis: Array<{
      id?: string;
      title: string;
      metric: string;
      aggregation: "count" | "sum" | "avg" | "min" | "max" | "median" | "count_unique";
      format?: "number" | "currency" | "percent";
    }>;
    charts: Array<{
      id?: string;
      type: "bar" | "line" | "area" | "pie" | "donut" | "histogram" | "scatter" | "radar" | "composed" | "heatmap";
      title: string;
      xKey: string;
      yKey: string;
      aggregation: "count" | "sum" | "avg" | "min" | "max" | "median";
      limit?: number;
    }>;
  };
};

export type SchemaDashboardCommandResponse = {
  action: "GENERATE_CHART" | "MODIFY_CHART" | "DELETE_CHART" | "GENERATE_KPI" | "FILTER" | "CLEAR_FILTERS" | "ANSWER";
  message: string;
  chartSpec?: SchemaDashboardResponse["dashboard"]["charts"][number];
  kpiSpec?: SchemaDashboardResponse["dashboard"]["kpis"][number];
  filters?: Record<string, string>;
  schemaOnly: true;
  provider?: string;
  model?: string;
  aiError?: string | null;
};

// Add inside exported api object:
//
// generateSchemaDashboard: (datasetId: string, useLlm = true, dataset?: { rows: unknown[]; columns?: unknown[] }) =>
//   request<SchemaDashboardResponse>(`/api/datasets/${datasetId}/schema-dashboard`, {
//     method: "POST",
//     body: JSON.stringify({ useLlm, ...(dataset || {}) }),
//   }),
//
// trainSchemaDashboard: (datasetId: string, dashboardPlan: unknown, rating: "good" | "bad" = "good", notes = "") =>
//   request(`/api/datasets/${datasetId}/schema-train`, {
//     method: "POST",
//     body: JSON.stringify({ dashboardPlan, rating, notes }),
//   }),
//
// sendDashboardCommand: (datasetId: string, query: string, currentDashboard?: unknown, dataset?: { rows: unknown[]; columns?: unknown[] }) =>
//   request<SchemaDashboardCommandResponse>(`/api/datasets/${datasetId}/dashboard-command`, {
//     method: "POST",
//     body: JSON.stringify({ query, currentDashboard, ...(dataset || {}) }),
//   }),
//
// sendSchemaChat: (datasetId: string, query: string, dataset?: { rows: unknown[]; columns?: unknown[] }) =>
//   request<{ userMessage: unknown; assistantMessage: { role: "assistant"; content: string; model?: string; provider?: string; schemaOnly: true } }>(`/api/datasets/${datasetId}/schema-chat`, {
//     method: "POST",
//     body: JSON.stringify({ query, ...(dataset || {}) }),
//   }),
//
// getSchemaTrainingMemory: () =>
//   request(`/api/ai/schema-training-memory`),
