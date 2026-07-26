import { ChartConfig, ChatMessage, Dataset, DatasetAnalysis } from "@/features/data/model/dataStore";
import type { Aggregation, ChartSpec, KpiSpec } from "@/features/dashboard/types/dashboardTypes";
import logger from "@/shared/lib/logger";
import { API_ROUTES } from "@/api/routes";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CorrelationResult {
  column1: string;
  column2: string;
  coefficient: number;
  strength: "weak" | "moderate" | "strong";
  interpretation: string;
  sampleSize: number;
}

export interface CorrelationResponse {
  correlations: CorrelationResult[];
  summary: string;
  hasGemini: boolean;
}

export interface DatasetImportPayload {
  name: string;
  fileName?: string | null;
  columns: Dataset["columns"];
  rows: Dataset["rows"];
  sourceType?: string;
}

export interface QrUploadFileInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  sizeBytes: number;
  status: "uploaded" | "error" | "uploading";
}

export interface QrUploadSession {
  sessionId: string;
  uploadToken: string;
  uploadUrl: string;
  qrDataUrl: string;
  workspaceName: string;
  status: "waiting" | "uploading" | "completed" | "expired" | "error" | "closed";
  expiresAt: string;
}

export interface QrUploadStatus {
  sessionId: string;
  status: "waiting" | "uploading" | "completed" | "expired" | "error" | "closed";
  workspaceName: string;
  files: QrUploadFileInfo[];
  dataset?: Dataset;
  analysis?: DatasetAnalysis;
  error?: string | null;
  expiresAt: string;
}

interface ApiState {
  dataset: Dataset | null;
  chatMessages: ChatMessage[];
  analysis?: DatasetAnalysis;
}

interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface DashboardKPI {
  title: string;
  value: string;
  metric?: string;
  aggregation?: Aggregation;
  icon?: string;
  status?: "good" | "warning" | "critical";
  insight?: string;
}

export interface DashboardValidationIssue {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  fix?: unknown;
}

export interface DashboardValidateFixResponse {
  isCorrect: boolean;
  issues: DashboardValidationIssue[];
  observations: string[];
  message: string;
  correctedDashboard: {
    dataType: string;
    rowCount: number;
    columnCount: number;
    kpis: Array<{
      id: string;
      title: string;
      value: string;
      subtitle: string;
      metric?: string;
      aggregation?: string;
    }>;
    charts: ChartConfig[];
    chartRecommendations: ChartConfig[];
  };
}

export interface DashboardCommandResponse {
  action:
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "GENERATE_KPI"
    | "ADD_KPI"
    | "ANSWER"
    | "DATASET_ANSWER"
    | "GENERAL_ANSWER"
    | "FIX_DASHBOARD";
  message: string;
  chart?: ChartConfig;
  chartSpec?: ChartSpec;
  kpiSpec?: KpiSpec;
  kpis?: DashboardKPI[];
  filters?: Record<string, string>;
  provider?: string;
  model?: string;
  schemaOnly?: boolean;
  correctedDashboard?: DashboardValidateFixResponse["correctedDashboard"];
  issues?: DashboardValidationIssue[];
  observations?: string[];
  aiError?: string | null;
}

export interface FastDashboardChatResponse {
  intent:
    | "answer"
    | "add_chart"
    | "remove_chart"
    | "update_chart"
    | "add_kpi"
    | "filter"
    | "explain"
    | "general_answer";
  answer: string;
  action: {
    targetTitle?: string;
    chart?: ChartSpec | Record<string, unknown>;
    kpi?: KpiSpec | Record<string, unknown>;
    filter?: Record<string, string>;
  };
  reason: string;
  source: "local" | "ollama" | "fallback";
  cached: boolean;
}

export interface DashboardAiPayload {
  rows: any[];
  dataDictionary?: any[];
  datasetName?: string;
  filters?: Record<string, any>;
}

export interface DashboardAiCommandPayload extends DashboardAiPayload {
  query: string;
  currentDashboard?: any;
}

export interface DashboardAiFixPayload extends Omit<DashboardAiPayload, "filters"> {
  currentDashboard?: any;
}

export interface DashboardAiResponse {
  success: boolean;
  schemaProfile?: any;
  aiPlan?: any;
  dashboard?: any;
  action?: string;
  message?: string;
  schemaOnly?: boolean;
  correctedDashboard?: any;
  issues?: Array<{ type: string; message: string; severity?: string }>;
  observations?: string[];
  provider?: string;
}

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
      type: "bar" | "horizontalBar" | "line" | "area" | "pie" | "donut" | "histogram" | "scatter" | "radar" | "composed" | "heatmap";
      title: string;
      xKey: string;
      yKey: string;
      aggregation: "count" | "sum" | "avg" | "min" | "max" | "median";
      limit?: number;
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
};

export interface PdfImportResult {
  pdf: {
    id: string;
    datasetId: string;
    fileName: string;
    jobId: string;
    pageCount?: number;
    tableCount: number;
    chunkCount: number;
    textElementCount: number;
    documentType?: string;
    ocrUsed?: boolean;
    qualityScore?: number;
    ocrConfidence?: number | null;
    warnings?: string[];
  };
  pdfIntelligence?: {
    summary?: Record<string, any>;
    pages?: Array<Record<string, any>>;
    sections?: Array<Record<string, any>>;
    quality?: Record<string, any>;
    tables?: Array<Record<string, any>>;
    readiness?: PdfPipelineStatus["readiness"];
  };
  dataset: Dataset;
  analysis: DatasetAnalysis;
  knowledgeBaseSummary: {
    tableCount: number;
    chunkCount: number;
    textElementCount: number;
  };
  privacy: {
    rawPdfSentToLLM: boolean;
    extractedTextCanBeUsedForRAG: boolean;
    dashboardValuesCalculatedLocally: boolean;
  };
}

export interface PdfAskResult {
  answer: string;
  sources: Array<{
    source: number;
    id: string;
    preview: string;
    pageNumber?: number | null;
    confidence?: number | null;
    extractionMethod?: string;
    chunkType?: string;
    chunkId?: string;
    score?: number;
  }>;
  intent?: string;
  confidence?: number;
  warnings?: string[];
  model?: string;
  contextUsed?: {
    retrievedChunks: number;
    usedDocumentSummary: boolean;
    maxChars: number;
  };
}

export interface PdfUploadPipelineResult {
  documentId: string;
  status: string;
  message: string;
  next: {
    statusUrl: string;
    documentUrl: string;
  };
}

export interface PdfPipelineStatus {
  documentId: string;
  status: string;
  progress: number;
  pipelines?: Record<string, {
    status: string;
    progress: number;
    currentPage?: number | null;
    totalPages?: number | null;
    error?: string | null;
  }>;
  jobs?: Array<Record<string, any>>;
  readiness?: {
    documentId?: string | null;
    status: string;
    hasUploadedPdf?: boolean;
    hasText?: boolean;
    hasPageText?: boolean;
    hasChunks?: boolean;
    hasDocumentSummary?: boolean;
    hasVectorIndex?: boolean;
    hasTables?: boolean;
    hasRealDataTables?: boolean;
    canAskQuestions: boolean;
    canExplainPdf: boolean;
    canUseVectorSearch?: boolean;
    canUseLocalFallback?: boolean;
    canSummarizePage: boolean;
    canShowMetrics: boolean;
    processingMessage?: string;
    activePipelines?: Array<Record<string, any>>;
    progress?: number;
  };
  currentPage?: number | null;
  totalPages?: number | null;
  message?: string;
}

export interface AgenticConfigResponse {
  provider: string;
  ollamaHost: string;
  useCloudDeepReasoner: boolean;
  roles: Record<string, string>;
}

export interface AgenticHealthResponse {
  checks: Array<{
    model: string;
    installed: boolean;
  }>;
}

export interface SchemaOnlyAnalysisResponse {
  success: boolean;
  response_type: string;
  natural_response: string;
  dataset_id: string;
  actions: Array<{
    action: string;
    id?: string;
    title?: string;
    metric?: string;
    aggregation?: string;
    chart_type?: string;
    x?: string;
    y?: string;
  }>;
  computed_results: Record<string, { value?: number; data?: Array<Record<string, unknown>>; calculated?: boolean }>;
  warnings: string[];
  errors: Array<{ action: string; reason: string; suggestion?: string }>;
  schema_safe: boolean;
  dashboard_health?: { status: string; score: number; issues: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>> };
  audit: { schemaColumnsReceived: number; rawRowsSent: number; actionsValidated: number; actionsRejected: number };
}


type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

const apiBaseUrl = (() => {
  // Use empty string to leverage Vite proxy in development
  // In production, set VITE_API_BASE_URL to the backend URL
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.log('Using Vite proxy for API requests');
  }
  return baseUrl.replace(/\/$/, "");
})();

export async function safeApiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const startTime = Date.now();
  const method = options?.method || "GET";

  try {
    console.debug("[API]", method, path);

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const fallbackText = await response.text().catch(() => "");
      const message =
        payload?.error?.message ||
        payload?.message ||
        payload?.error ||
        fallbackText ||
        `API failed with status ${response.status}`;

      console.error("[API ERROR]", method, path, payload || fallbackText || response.status);
      throw new ApiError(message, response.status, payload?.error?.code || payload?.code);
    }

    const duration = Date.now() - startTime;

    logger.debug(`API: ${method} ${path}`, {
      statusCode: response.status,
      duration,
    });

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("API connection failed:", error);

    throw new ApiError(
      "Backend server is offline. Please start backend on port 3001 and refresh the app.",
      0,
      "NETWORK_ERROR",
    );
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const startTime = Date.now();
  const method = init?.method || "GET";

  try {
    const payload = await safeApiFetch<T | ApiEnvelope<T>>(path, init);
    const duration = Date.now() - startTime;

    logger.info(`API: ${method} ${path}`, {
      statusCode: 200,
      duration,
    });

    if (
      payload
      && typeof payload === "object"
      && "success" in payload
      && "data" in payload
    ) {
      return (payload as ApiEnvelope<T>).data as T;
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Network error: ${method} ${path}`, {
      error: error instanceof Error ? error.message : "Unknown error",
      path,
      method,
    }, error instanceof Error ? error : undefined);
    
    throw new ApiError(
      error instanceof Error ? error.message : "Network request failed",
      0,
      "NETWORK_ERROR"
    );
  }
};

export const api = {
  getState: () => request<ApiState>(API_ROUTES.state),
  resetState: () =>
    request<ApiState>("/api/state/reset", {
      method: "POST",
    }),
  importDataset: (payload: DatasetImportPayload) =>
    request<ApiState>("/api/datasets/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  mergeDatasets: (datasets: DatasetImportPayload[]) =>
    request<ApiState>("/api/datasets/merge", {
      method: "POST",
      body: JSON.stringify({ datasets }),
    }),
  loadDemo: () =>
    request<ApiState>(API_ROUTES.dataset.demo, {
      method: "POST",
    }),
  importPdf: async (file: File): Promise<PdfImportResult> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${apiBaseUrl}/api/pdf/import`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "PDF import failed",
        response.status,
        errorPayload?.error?.code,
      );
    }

    const payload = await response.json() as ApiEnvelope<PdfImportResult>;
    return payload.data as PdfImportResult;
  },
  uploadPdfIntelligence: async (file: File): Promise<PdfUploadPipelineResult> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${apiBaseUrl}/api/pdf-intelligence/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new ApiError(errorPayload?.error?.message || "PDF upload failed", response.status, errorPayload?.error?.code);
    }

    const payload = await response.json() as ApiEnvelope<PdfUploadPipelineResult>;
    return payload.data as PdfUploadPipelineResult;
  },
  getPdfIntelligenceDocument: (pdfId: string): Promise<PdfImportResult["pdfIntelligence"] & { documentId: string; fileName?: string; pageCount?: number; tableCount?: number; chunkCount?: number; status?: string; progress?: number }> =>
    request(`/api/pdf-intelligence/${pdfId}`),
  getPdfPipelineStatus: (pdfId: string): Promise<PdfPipelineStatus> =>
    request<PdfPipelineStatus>(`/api/pdf-intelligence/${pdfId}/status`),
  askPdf: (pdfId: string, query: string): Promise<PdfAskResult> =>
    request<PdfAskResult>(`/api/pdf/${pdfId}/ask`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  askPdfIntelligence: (pdfId: string, query: string, intent?: string): Promise<PdfAskResult> =>
    request<PdfAskResult>(`/api/pdf-intelligence/${pdfId}/query`, {
      method: "POST",
      body: JSON.stringify({ query, intent }),
    }),
  explainPdf: (pdfId: string): Promise<PdfAskResult> =>
    request<PdfAskResult>(`/api/pdf-intelligence/${pdfId}/explain`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  reindexPdf: (pdfId: string) =>
    request(`/api/pdf-intelligence/${pdfId}/reindex`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  forceOcrPdf: (pdfId: string) =>
    request<{ document: PdfImportResult["pdfIntelligence"] & { documentId?: string }; vectorIndex?: unknown }>(`/api/pdf-intelligence/${pdfId}/force-ocr`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  updateRow: (datasetId: string, rowId: number, column: string, value: unknown) =>
    request<{ dataset: Dataset }>(`/api/datasets/${datasetId}/rows/${rowId}`, {
      method: "PATCH",
      body: JSON.stringify({ column, value }),
    }),
  sendChatQuery: (datasetId: string, query: string, preferences?: {
    chartCount?: string;
    chartTypes?: string[];
    showTrends?: boolean;
    showCorrelations?: boolean;
  }) =>
    request<ChatResponse>(`/api/datasets/${datasetId}/chat`, {
      method: "POST",
      body: JSON.stringify({ query, ...preferences }),
    }),
  generateSchemaDashboard: (
    datasetId: string,
    useLlm = true,
    dataset?: { rows?: unknown[]; columns?: unknown[] },
  ) =>
    request<SchemaDashboardResponse>(`/api/datasets/${datasetId}/schema-dashboard`, {
      method: "POST",
      body: JSON.stringify({ useLlm, ...(dataset || {}) }),
    }),
  trainSchemaDashboard: (
    datasetId: string,
    dashboardPlan: unknown,
    rating: "good" | "bad" = "good",
    notes = "",
  ) =>
    request(`/api/datasets/${datasetId}/schema-train`, {
      method: "POST",
      body: JSON.stringify({ dashboardPlan, rating, notes }),
    }),
  sendDashboardCommand: (
    datasetId: string,
    query: string,
    currentDashboard?: unknown,
    dataset?: { rows?: unknown[]; columns?: unknown[]; pageContext?: string; dashboardChartCount?: number },
    context?: { page?: string; activeFilters?: Record<string, string>; selectedChart?: string; dashboardChartCount?: number },
  ) =>
    request<DashboardCommandResponse>(`/api/datasets/${datasetId}/dashboard-command`, {
      method: "POST",
      body: JSON.stringify({
        query,
        currentDashboard,
        useLlm: true,
        rows: dataset?.rows,
        columns: dataset?.columns,
        context: {
          ...context,
          page: context?.page || dataset?.pageContext,
          dashboardChartCount: context?.dashboardChartCount ?? dataset?.dashboardChartCount,
        },
      }),
    }),
  sendFastDashboardChat: async (
    message: string,
    schemaProfile: Record<string, unknown>,
    currentDashboard?: unknown,
    context?: { page?: string; activeFilters?: Record<string, string>; selectedChart?: string },
  ) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    try {
      return await request<{ ok: boolean; result: FastDashboardChatResponse }>("/api/ollama-manager/fast-chat", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          message,
          schemaProfile,
          currentDashboard,
          context,
        }),
      });
    } finally {
      window.clearTimeout(timeout);
    }
  },
  sendSchemaChat: (
    datasetId: string,
    query: string,
    dataset?: { rows?: unknown[]; columns?: unknown[] },
    context?: { page?: string; activeFilters?: Record<string, string>; selectedChart?: string },
  ) =>
    request<{
      userMessage: unknown;
      assistantMessage: {
        role: "assistant";
        content: string;
        model?: string;
        provider?: string;
        schemaOnly: true;
      };
    }>(`/api/datasets/${datasetId}/schema-chat`, {
      method: "POST",
      body: JSON.stringify({
        query,
        useLlm: true,
        columns: dataset?.columns,
        context,
      }),
    }),
  getSchemaTrainingMemory: () =>
    request("/api/ai/schema-training-memory", {
      method: "GET",
    }),
  validateAndFixDashboard: (
    datasetId: string,
    currentDashboard: {
      kpis: unknown[];
      charts: unknown[];
      filters?: Record<string, unknown>;
    }
  ) =>
    request<DashboardValidateFixResponse>(
      `/api/datasets/${datasetId}/dashboard-validate-fix`,
      {
        method: "POST",
        body: JSON.stringify({ currentDashboard }),
      }
    ),
  analyzeWithAnalyticsBrain: (datasetId: string) =>
    request<DatasetAnalysis>(`/api/datasets/${datasetId}/analytics-brain`, {
      method: "POST",
    }),
  runPlaybookAnalysis: (datasetId: string) =>
    request<DatasetAnalysis>(`/api/datasets/${datasetId}/playbook-analysis`, {
      method: "POST",
    }),
  sendAnalyticsBrainFeedback: (input: {
    patternId: string;
    action: string;
    rating: "good" | "bad";
    note?: string;
  }) =>
    request<{ success: boolean }>("/api/analytics-brain/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getAICorrelations: (datasetId: string) =>
    request<CorrelationResponse>(`/api/datasets/${datasetId}/ai-correlations`, {
      method: "GET",
    }),
  getAIProfile: (datasetId: string) =>
    request<{ profile: unknown }>(`/api/datasets/${datasetId}/ai/profile`, {
      method: "GET",
    }),
  getAIAnomalies: (datasetId: string) =>
    request<{ anomalies: unknown }>(`/api/datasets/${datasetId}/ai/anomalies`, {
      method: "GET",
    }),
  getAIRelationships: (datasetId: string) =>
    request<{ relationships: unknown }>(`/api/datasets/${datasetId}/ai/relationships`, {
      method: "GET",
    }),
  getAICleaning: (datasetId: string) =>
    request<{ suggestions: unknown }>(`/api/datasets/${datasetId}/ai/cleaning`, {
      method: "GET",
    }),
  exportDataset: async (datasetId: string, format: 'json' | 'csv' | 'md') => {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/api/datasets/${datasetId}/export/${format}`);
    } catch (error) {
      console.error("API connection failed:", error);
      throw new ApiError(
        "Backend server is offline. Please start backend on port 3001 and refresh the app.",
        0,
        "NETWORK_ERROR",
      );
    }

    if (!response.ok) {
      throw new ApiError(`Export failed with status ${response.status}`, response.status);
    }
    return response.blob();
  },
  getCascadeStatus: () =>
    request<{ success: boolean; cascade: unknown }>("/api/cascade/status", {
      method: "GET",
    }),
  generateQRSession: async (input?: {
    portalBaseUrl?: string;
    workspaceName?: string;
  }): Promise<QrUploadSession> => {
    const response = await fetch(`${apiBaseUrl}/api/qr-upload/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        portalBaseUrl:
          input?.portalBaseUrl ||
          import.meta.env.VITE_PUBLIC_APP_URL ||
          window.location.origin,
        workspaceName: input?.workspaceName || "InsightFlow Workspace",
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "Failed to generate QR session",
        response.status,
        errorPayload?.error?.code
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  },
  getQRSessionStatus: async (
    sessionId: string,
    token: string
  ): Promise<QrUploadStatus> => {
    const response = await fetch(
      `${apiBaseUrl}/api/qr-upload/${sessionId}/status?token=${encodeURIComponent(token)}`
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "Failed to get QR session status",
        response.status,
        errorPayload?.error?.code
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  },
  uploadToQRSession: async (
    sessionId: string,
    token: string,
    files: File[]
  ): Promise<QrUploadStatus> => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(
      `${apiBaseUrl}/api/qr-upload/${sessionId}/upload?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "Upload failed",
        response.status,
        errorPayload?.error?.code
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  },
  deleteDataset: (datasetId: string) =>
    request<void>(`/api/datasets/${datasetId}`, {
      method: "DELETE",
    }),
  runAiAnalyst: (datasetId: string) =>
    request<{ analysis: DatasetAnalysis }>(`/api/datasets/${datasetId}/ai-analyst/analyze`, {
      method: "POST",
    }),
  sendAiAnalystCommand: (input: {
    datasetId: string;
    command: string;
    currentAnalysis?: unknown;
    filters?: Record<string, string>;
  }) =>
    request<{ result: DashboardCommandResponse }>(
      `/api/datasets/${input.datasetId}/ai-analyst/command`,
      {
        method: "POST",
        body: JSON.stringify({
          command: input.command,
          currentAnalysis: input.currentAnalysis,
          filters: input.filters || {},
        }),
      }
    ),
  getAgenticConfig: () =>
    request<AgenticConfigResponse>("/api/agentic-models/config"),
  getAgenticHealth: () =>
    request<AgenticHealthResponse>("/api/agentic-models/health"),
  runAgenticAnalysis: (datasetId: string, goal: string) =>
    request<any>(`/api/agentic-models/datasets/${datasetId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),
  runSchemaOnlyAnalysis: (
    datasetId: string,
    goal: string,
    currentDashboardState?: Record<string, unknown>,
    options?: { sampleSize?: number }
  ) =>
    request<SchemaOnlyAnalysisResponse>(
      `/api/agentic-models/datasets/${datasetId}/analyze`,
      {
        method: "POST",
        body: JSON.stringify({
          goal,
          currentDashboardState: currentDashboardState || {},
          schema_only: true,
          sampleSize: options?.sampleSize,
        }),
      }
    ),
};

async function postDashboardAi<T>(path: string, body: unknown): Promise<T> {
  const payload = await safeApiFetch<any>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (payload.success === false) {
    throw new ApiError(
      payload.message || payload.error?.message || "Request failed",
      400,
      payload.error?.code
    );
  }

  return payload as T;
}

export interface ChartQueryResponse {
  chart: ChartConfig;
  confidence: number;
  columnStats: {
    uniqueValues: number;
    sampleValues: string[];
    min?: number;
    max?: number;
    avg?: number;
    median?: number;
  } | null;
  ragContext: {
    matchedViaRag: boolean;
    ragMemoryCount: number;
    instructionsUsed?: string[];
  };
  schemaSummary: {
    datasetName: string;
    rowCount: number;
    totalColumns: number;
    metrics: string[];
    dimensions: string[];
  };
  removedChartId: string | null;
  message: string;
}

export const dashboardAiApi = {
  generateDashboard(body: DashboardAiPayload) {
    return postDashboardAi<DashboardAiResponse>("/api/dashboard-ai/generate", body);
  },

  sendDashboardCommand(body: DashboardAiCommandPayload) {
    return postDashboardAi<DashboardAiResponse>("/api/dashboard-ai/command", body);
  },

  validateAndFixDashboard(body: DashboardAiFixPayload) {
    return postDashboardAi<DashboardAiResponse>("/api/dashboard-ai/fix", body);
  },

  chartQuery(body: { query: string; datasetId?: string; existingCharts?: ChartConfig[] }) {
    return postDashboardAi<ChartQueryResponse>("/api/dashboard/chart-query", body);
  },

  removeChart(chartId: string) {
    return postDashboardAi<{ removedChartId: string; message: string }>("/api/dashboard/remove-chart", {
      chartId,
    });
  },
};

