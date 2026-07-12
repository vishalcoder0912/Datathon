export const API_ROUTES = {
  state: "/api/state",

  dataset: {
    import: "/api/datasets/import",
    demo: "/api/datasets/demo",
    active: "/api/datasets/active",
    byId: (datasetId: string) => `/api/datasets/${datasetId}`,
    schema: (datasetId: string) => `/api/datasets/${datasetId}/schema`,
    chat: (datasetId: string) => `/api/datasets/${datasetId}/chat`,
    rows: (datasetId: string) => `/api/datasets/${datasetId}/rows`,
  },

  dashboard: {
    action: "/api/dashboard/action",
    chat: "/api/dashboard/chat",
    chartQuery: "/api/dashboard/chart-query",
    removeChart: "/api/dashboard/remove-chart",
  },

  dashboardAi: {
    command: "/api/dashboard-ai/command",
    generate: "/api/dashboard-ai/generate",
    fix: "/api/dashboard-ai/fix",
  },

  agentic: {
    capabilities: "/api/agentic/capabilities",
    context: (datasetId: string) => `/api/agentic/datasets/${datasetId}/context`,
    dashboard: (datasetId: string) => `/api/agentic/datasets/${datasetId}/dashboard`,
    chat: (datasetId: string) => `/api/agentic/datasets/${datasetId}/chat`,
  },

  pdfIntelligence: {
    upload: "/api/pdf-intelligence/upload",
    health: "/api/pdf-intelligence/health",
    details: (pdfId: string) => `/api/pdf-intelligence/${pdfId}`,
    status: (pdfId: string) => `/api/pdf-intelligence/${pdfId}/status`,
    query: (pdfId: string) => `/api/pdf-intelligence/${pdfId}/query`,
    explain: (pdfId: string) => `/api/pdf-intelligence/${pdfId}/explain`,
    reindex: (pdfId: string) => `/api/pdf-intelligence/${pdfId}/reindex`,
    forceOcr: (pdfId: string) => `/api/pdf-intelligence/${pdfId}/force-ocr`,
  },

  copilotChat: {
    analytics: "/api/chat/analytics",
  },

  analytics: {
    advanced: "/api/analytics/advanced",
  },
} as const;
