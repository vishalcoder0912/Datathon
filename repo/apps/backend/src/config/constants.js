// Application constants

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

export const CONTENT_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  CSV: 'text/csv',
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
  FORM_DATA: 'multipart/form-data'
};

export const AI_PROVIDERS = {
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
};

export const AI_MODELS = {
  OLLAMA: {
    LLAMA_3_2: 'llama3.2',
    NEURAL_CHAT_7B: 'neural-chat:7b',
    LLAMA_2: 'llama2',
    MISTRAL: 'mistral'
  },
  GEMINI: {
    GEMINI_1_5_PRO: 'gemini-1.5-pro',
    GEMINI_1_5_FLASH: 'gemini-1.5-flash'
  },
  OPENAI: {
    GPT_4: 'gpt-4',
    GPT_4_TURBO: 'gpt-4-turbo',
    GPT_3_5_TURBO: 'gpt-3.5-turbo'
  },
  ANTHROPIC: {
    CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
    CLAUDE_3_HAIKU: 'claude-3-haiku-20240307'
  }
};

export const CHART_TYPES = {
  BAR: 'bar',
  LINE: 'line',
  PIE: 'pie',
  SCATTER: 'scatter',
  HISTOGRAM: 'histogram',
  BOX: 'box',
  HEATMAP: 'heatmap',
  AREA: 'area',
  DONUT: 'donut'
};

export const DATA_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  FLOAT: 'float',
  BOOLEAN: 'boolean',
  DATE: 'date',
  DATETIME: 'datetime',
  ARRAY: 'array',
  OBJECT: 'object',
  NULL: 'null'
};

export const ANALYSIS_TYPES = {
  DESCRIPTIVE: 'descriptive',
  CORRELATION: 'correlation',
  DISTRIBUTION: 'distribution',
  OUTLIER_DETECTION: 'outlier_detection',
  TREND_ANALYSIS: 'trend_analysis',
  PREDICTIVE: 'predictive',
  CLUSTERING: 'clustering'
};

export const EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  EXCEL: 'excel',
  PDF: 'pdf',
  MARKDOWN: 'markdown'
};

export const ERROR_CODES = {
  // AI Provider Errors
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  
  // Data Errors
  DATASET_NOT_FOUND: 'DATASET_NOT_FOUND',
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
  DATA_VALIDATION_FAILED: 'DATA_VALIDATION_FAILED',
  DATA_TOO_LARGE: 'DATA_TOO_LARGE',
  
  // System Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Business Logic Errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  OPERATION_NOT_SUPPORTED: 'OPERATION_NOT_SUPPORTED'
};

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

export const CACHE_KEYS = {
  AI_RESPONSE: 'ai_response',
  DATASET_SCHEMA: 'dataset_schema',
  ANALYSIS_RESULT: 'analysis_result',
  CHART_DATA: 'chart_data'
};

export const RATE_LIMITS = {
  DEFAULT: 100,
  AI_REQUESTS: 50,
  UPLOADS: 10,
  EXPORTS: 5
};

export const TIME_UNITS = {
  MILLISECOND: 1,
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
};

export const FILE_LIMITS = {
  MAX_UPLOAD_SIZE: 200 * 1024 * 1024 * 1024, // 200GB
  SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls', '.json', '.txt'],
  MAX_ROWS: 1000000000, // 1 Billion rows
  MAX_COLUMNS: 10000 // 10,000 columns
};

export const AI_DEFAULTS = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 4096,
  TOP_P: 0.9,
  FREQUENCY_PENALTY: 0.0,
  PRESENCE_PENALTY: 0.0,
  TIMEOUT: 120000 // 2 minutes
};

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/health',
  ROOT: '/',
  
  // AI
  AI_STATUS: '/api/ai/status',
  AI_MODELS: '/api/ai/models',
  AI_TEST: '/api/ai/test',
  
  // Datasets
  DATASETS: '/api/datasets',
  DATASET_IMPORT: '/api/datasets/import',
  DATASET_MERGE: '/api/datasets/merge',
  DATASET_CHAT: '/api/datasets/:id/chat',
  DATASET_ANALYZE: '/api/datasets/:id/analyze',
  DATASET_SCHEMA: '/api/datasets/:id/schema',
  DATASET_EXPORT: '/api/datasets/:id/export',
  
  // Analytics
  AUTO_CHARTS: '/api/datasets/:id/auto-charts',
  CORRELATIONS: '/api/datasets/:id/correlations',
  OUTLIERS: '/api/datasets/:id/outliers',
  PREDICTIONS: '/api/datasets/:id/predictions'
};

export default {
  HTTP_STATUS,
  CONTENT_TYPES,
  AI_PROVIDERS,
  AI_MODELS,
  CHART_TYPES,
  DATA_TYPES,
  ANALYSIS_TYPES,
  EXPORT_FORMATS,
  ERROR_CODES,
  LOG_LEVELS,
  CACHE_KEYS,
  RATE_LIMITS,
  TIME_UNITS,
  FILE_LIMITS,
  AI_DEFAULTS,
  API_ENDPOINTS
};
