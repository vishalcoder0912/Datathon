import { schemaAiClient, type DatasetPayload } from "./schemaAiClient";

export type SchemaDashboardResponse = {
  success: boolean;
  ok?: boolean;
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
      aggregation: "count" | "sum" | "avg" | "min" | "max" | "median" | "count_unique" | "top_by_avg";
      format?: "number" | "currency" | "percent" | "text";
      sourceColumn?: string | null;
      confidence?: number;
      businessKpi?: boolean;
    }>;
    charts: Array<{
      id?: string;
      type: "bar" | "horizontal_bar" | "horizontalBar" | "line" | "area" | "pie" | "donut" | "histogram" | "scatter" | "radar" | "composed" | "heatmap" | "map" | "table";
      title: string;
      xKey: string;
      yKey: string;
      aggregation: "none" | "count" | "sum" | "avg" | "min" | "max" | "median";
      intent?: "trend" | "ranking" | "distribution" | "correlation" | "geo" | "comparison" | "table" | "relationship" | "geo_ranking" | "segment_comparison" | "skill_salary_impact";
      confidence?: number;
      limit?: number;
      multiValue?: boolean;
      splitValues?: boolean;
      splitDelimiter?: string;
    }>;
  };
  dashboardType?: string;
  executiveSummary?: {
    overview?: string;
    topTrend?: string | null;
    biggestOpportunity?: string | null;
    biggestRisk?: string | null;
    businessRecommendation?: string;
    confidenceScore?: number;
  } | null;
  geoAnalysis?: Array<Record<string, unknown>>;
  insights?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  storyMode?: {
    whatHappened?: string;
    whyItHappened?: string;
    whatWillHappen?: string;
    recommendedAction?: string;
  } | null;
  confidenceScore?: number;
  governance?: {
    status?: "APPROVED" | "REJECTED";
    approvedForRender?: boolean;
    blockingReasons?: string[];
    [key: string]: unknown;
  };
  approvedForRender?: boolean;
};

export type SchemaAggregation =
  | "none"
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "count_unique"
  | "top_by_avg";

export type SchemaDashboardKpiSpec = SchemaDashboardResponse["dashboard"]["kpis"][number];
export type SchemaDashboardChartSpec = SchemaDashboardResponse["dashboard"]["charts"][number];

export type SchemaDashboardCommandResponse = {
  action:
    | "GENERATE_DASHBOARD"
    | "FIX_DASHBOARD"
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "GENERATE_KPI"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "ANSWER";
  message: string;
  chartSpec?: SchemaDashboardResponse["dashboard"]["charts"][number];
  kpiSpec?: SchemaDashboardResponse["dashboard"]["kpis"][number];
  filters?: Record<string, string>;
  dashboardPlan?: SchemaDashboardResponse["dashboard"];
  correctedDashboard?: unknown;
  schemaOnly: true;
  governance?: SchemaDashboardResponse["governance"];
  approvedForRender?: boolean;
  provider?: string;
  model?: string;
  aiError?: string | null;
};

export const schemaTrainedApi = {
  getSchemaTrainingMemory: schemaAiClient.getSchemaTrainingMemory,
  getSchemaRagMemory: () => schemaAiClient.getSchemaRagMemory(),
  trainSchemaRagMemory: (payload: Record<string, unknown>) =>
    schemaAiClient.trainSchemaRagMemory(payload),
  trainCurrentDashboardPattern: (datasetId: string, payload: Record<string, unknown>) =>
    schemaAiClient.trainCurrentDashboardPattern(datasetId, payload),
  generateSchemaDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.generateSchemaDashboard(datasetId, payload, {
      useLlm: payload.useLlm as boolean | undefined,
      threshold: payload.threshold as number | undefined,
    }),
  understandDatasetSchema: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.understandDatasetSchema(datasetId, payload),
  generateSmartRagDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.generateSmartRagDashboard(datasetId, payload),
  trainSmartRagDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.trainSmartRagDashboard(datasetId, payload),
  trainSchemaDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.trainSchemaDashboard(
      datasetId,
      payload,
      payload.dashboardPlan || payload.acceptedDashboard || { kpis: [], charts: [] },
      String(payload.rating || "good"),
    ),
  runDashboardCommand: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.sendDashboardCommand(
      datasetId,
      String(payload.query || ""),
      payload.currentDashboard,
      payload,
      { useLlm: payload.useLlm as boolean | undefined },
    ),
  sendDashboardCommand: (
    datasetId: string,
    query: string,
    currentDashboard?: unknown,
    dataset?: DatasetPayload,
  ) => schemaAiClient.sendDashboardCommand(datasetId, query, currentDashboard, dataset),
  runSchemaChat: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.sendSchemaChat(
      datasetId,
      String(payload.query || payload.message || ""),
      payload,
      { useLlm: payload.useLlm as boolean | undefined },
    ),
  sendSchemaChat: (datasetId: string, query: string, dataset?: DatasetPayload) =>
    schemaAiClient.sendSchemaChat(datasetId, query, dataset),
};
