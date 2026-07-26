import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
};

export type AgenticExecutionAudit = {
  rawRowsSentToLlm: false;
  plannerUsedSchemaOnly?: boolean;
  valuesCalculatedByBackend?: boolean;
  sqlValidated?: boolean;
  persisted?: boolean;
};

export type AgenticContextResponse = {
  dataset: {
    id: string;
    name: string;
    fileName?: string;
    sourceType?: string;
    rowCount: number;
    columnCount: number;
    originalFilePath?: string;
    optimizedFilePath?: string;
    optimizedFormat?: string;
  };
  schemaSummary: {
    datasetName?: string;
    rowCount: number;
    columnCount: number;
    numericMetrics: string[];
    categories: string[];
    dates: string[];
    ids: string[];
    textColumns: string[];
  };
  schemaProfile: Record<string, unknown>;
  pipeline: Record<string, unknown>;
  dashboardArtifact: Record<string, unknown> | null;
  safety: {
    rawRowsSentToLlm: false;
    frontendReceivesFullRows: false;
  };
};

export type AgenticDashboardResponse = {
  dataset: AgenticContextResponse["dataset"];
  schema: Record<string, unknown>;
  pipeline: Record<string, unknown>;
  dashboardArtifact: Record<string, unknown>;
  agentRunId: string;
  executionAudit: AgenticExecutionAudit;
};

export type AgenticChatResponse = {
  answer: string;
  queryPlan?: Record<string, unknown>;
  sql?: string | null;
  result?: Record<string, unknown> | null;
  chart?: Record<string, unknown> | null;
  kpi?: Record<string, unknown> | null;
  dashboardAction?: Record<string, unknown>;
  safety?: Record<string, unknown>;
  agentRunId: string;
  executionAudit: AgenticExecutionAudit;
};

export const agenticApi = {
  capabilities() {
    return apiRequest<ApiEnvelope<Record<string, unknown>>>(API_ROUTES.agentic.capabilities);
  },

  context(datasetId: string) {
    return apiRequest<ApiEnvelope<AgenticContextResponse>>(API_ROUTES.agentic.context(datasetId));
  },

  generateDashboard(
    datasetId: string,
    body: { query?: string; filters?: Record<string, unknown>; currentDashboard?: Record<string, unknown> } = {},
  ) {
    return apiRequest<ApiEnvelope<AgenticDashboardResponse>>(API_ROUTES.agentic.dashboard(datasetId), {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  chat(
    datasetId: string,
    body: { message?: string; query?: string; activeFilters?: unknown[]; mode?: string },
  ) {
    return apiRequest<ApiEnvelope<AgenticChatResponse>>(API_ROUTES.agentic.chat(datasetId), {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
