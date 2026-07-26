export const pdfProcessingPolicy = {
  enabled: process.env.PDF_INTELLIGENCE_ENABLED !== "false",
  pipelineMode: process.env.PDF_PIPELINE_MODE || "separate",
  asyncProcessing: process.env.PDF_ASYNC_PROCESSING !== "false",
  maxFileSizeMb: Number(process.env.PDF_MAX_FILE_SIZE_MB || 1000),
  maxPages: Number(process.env.PDF_MAX_PAGES || 0),
  processingBatchSize: Number(process.env.PDF_PROCESSING_BATCH_SIZE || 5),
  ocrEnabled: process.env.PDF_OCR_ENABLED !== "false",
  forceOcrDefault: process.env.PDF_FORCE_OCR_DEFAULT === "true",
  ocrEngine: process.env.PDF_OCR_ENGINE || "tesseract",
  renderDpi: Number(process.env.PDF_RENDER_DPI || 220),
  ocrRenderDpi: Number(process.env.PDF_OCR_RENDER_DPI || 300),
  chunkSize: Number(process.env.PDF_CHUNK_SIZE || 900),
  chunkOverlap: Number(process.env.PDF_CHUNK_OVERLAP || 180),
  vectorBatchSize: Number(process.env.PDF_VECTOR_BATCH_SIZE || 64),
  maxIndexChunks: Number(process.env.PDF_MAX_INDEX_CHUNKS || 0),
  queryTopK: Number(process.env.PDF_QUERY_TOP_K || 14),
  contextMaxChars: Number(process.env.PDF_CONTEXT_MAX_CHARS || 28000),
  includeDocumentSummary: process.env.PDF_INCLUDE_DOCUMENT_SUMMARY !== "false",
  processingTimeoutMs: Number(process.env.PDF_PROCESSING_TIMEOUT_MS || 900000),
  intelligenceTimeoutMs: Number(process.env.PDF_INTELLIGENCE_TIMEOUT_MS || 180000),
  pageCache: process.env.PDF_ENABLE_PAGE_CACHE !== "false",
  cacheEnabled: process.env.PDF_ENABLE_CACHE !== "false",
  incrementalIndexing: process.env.PDF_ENABLE_INCREMENTAL_INDEXING !== "false",
  partialQa: process.env.PDF_ENABLE_PARTIAL_QA !== "false",
  disableTextTableCharts: process.env.DISABLE_TEXT_TABLE_CHARTS !== "false",
  minTableColumnsForChart: Number(process.env.MIN_TABLE_COLUMNS_FOR_CHART || 2),
  minRowsForChart: Number(process.env.MIN_ROWS_FOR_CHART || 3),
  disableAutoForceOcrOnQuery: process.env.DISABLE_AUTO_FORCE_OCR_ON_QUERY !== "false",
  explainerModel: process.env.PDF_EXPLAINER_MODEL || "qwen3:8b",
  summarizerModel: process.env.PDF_SUMMARIZER_MODEL || "qwen3:8b",
  fastModel: process.env.PDF_FAST_MODEL || "llama3.2:3b",
  validatorModel: process.env.PDF_VALIDATOR_MODEL || "qwen3:4b",
  embeddingModel: process.env.PDF_EMBEDDING_MODEL || "nomic-embed-text:latest",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://localhost:11434",
};

export function validatePdfUpload({ fileSize, mimeType }) {
  if (mimeType && mimeType !== "application/pdf") {
    throw new Error("Only PDF files are allowed");
  }
  const maxBytes = pdfProcessingPolicy.maxFileSizeMb * 1024 * 1024;
  if (fileSize && fileSize > maxBytes) {
    throw new Error(`PDF is too large. Maximum allowed size is ${pdfProcessingPolicy.maxFileSizeMb}MB.`);
  }
}

export default pdfProcessingPolicy;
