import fs from "node:fs";
import path from "node:path";

import { getPdfReadiness } from "./pdf-readiness.js";

const STORE_FILE = path.resolve("data", "pdf-intelligence-store.json");

function ensureStore() {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2));
  }
}

function loadStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function compactPdfAnalysis(analysis = {}) {
  const jobs = Object.values(analysis.jobs || {});
  return {
    documentId: analysis.documentId,
    fileName: analysis.fileName,
    pageCount: analysis.pageCount,
    documentType: analysis.documentType,
    extractionSummary: analysis.extractionSummary,
    summary: analysis.summary,
    sections: analysis.sections || [],
    pages: (analysis.pages || []).map((page) => ({
      pageNumber: page.pageNumber,
      mode: page.mode,
      extractionMethod: page.extractionMethod || page.method,
      pageSummary: page.pageSummary,
      pageKeywords: page.pageKeywords || [],
      pageHeadings: page.pageHeadings || [],
      confidence: page.confidence,
      ocrConfidence: page.ocrConfidence,
      warnings: page.warnings || [],
    })),
    quality: analysis.quality,
    tableCount: analysis.tables?.length || 0,
    chunkCount: analysis.chunks?.length || 0,
    tables: (analysis.tables || []).map((table) => ({
      tableId: table.tableId,
      pageNumber: table.pageNumber,
      extractionMethod: table.extractionMethod,
      cleanedColumns: table.cleanedColumns,
      schema: table.schema,
      quality: table.quality,
      preview: table.preview || table.cleanedRows?.slice(0, 25) || [],
      warnings: table.warnings || [],
      summary: table.summary,
      usableForDashboard: table.usableForDashboard,
      usableForDataset: table.usableForDataset,
      usableForVisualization: table.usableForVisualization,
      usableForAnalytics: table.usableForAnalytics,
      tableType: table.tableType,
    })),
    status: analysis.status || "completed",
    progress: analysis.progress ?? 100,
    pipelineStatus: analysis.pipelineStatus || {},
    jobs,
    readiness: getPdfReadiness(analysis),
    vectorIndex: analysis.vectorIndex,
  };
}

export function savePdfIntelligenceAnalysis(documentId, analysis, extra = {}) {
  const store = loadStore();
  store[documentId] = {
    ...analysis,
    ...extra,
    savedAt: new Date().toISOString(),
  };
  saveStore(store);
  return store[documentId];
}

export function getPdfIntelligenceAnalysis(documentId) {
  return loadStore()[documentId] || null;
}

export function getPdfIntelligenceSummary(documentId) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  return analysis ? compactPdfAnalysis(analysis) : null;
}

export function createPdfDocument(metadata = {}) {
  const documentId = metadata.id || metadata.documentId;
  if (!documentId) throw new Error("documentId is required");
  return savePdfIntelligenceAnalysis(documentId, {
    documentId,
    id: documentId,
    fileName: metadata.fileName || metadata.file_name,
    filePath: metadata.filePath || metadata.file_path,
    fileSize: metadata.fileSize || metadata.file_size,
    pageCount: metadata.pageCount || metadata.page_count || 0,
    documentType: metadata.pdfType || metadata.pdf_type || "unknown",
    status: metadata.status || "uploaded",
    progress: metadata.progress || 0,
    pages: [],
    tables: [],
    chunks: [],
    jobs: {},
    pipelineStatus: {},
    summaries: [],
    summary: {},
    quality: { overallScore: 0, warnings: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function updatePdfDocument(documentId, patch = {}) {
  const current = getPdfIntelligenceAnalysis(documentId) || { documentId };
  return savePdfIntelligenceAnalysis(documentId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export function getPdfDocument(documentId) {
  return getPdfIntelligenceAnalysis(documentId);
}

export function savePdfPage(documentId, pageResult = {}) {
  const current = getPdfIntelligenceAnalysis(documentId) || { documentId, pages: [] };
  const pages = (current.pages || []).filter((page) => page.pageNumber !== pageResult.pageNumber);
  pages.push(pageResult);
  pages.sort((a, b) => Number(a.pageNumber || 0) - Number(b.pageNumber || 0));
  return updatePdfDocument(documentId, { pages });
}

export function getPdfPages(documentId) {
  return getPdfIntelligenceAnalysis(documentId)?.pages || [];
}

export function savePdfTable(documentId, tableResult = {}) {
  const current = getPdfIntelligenceAnalysis(documentId) || { documentId, tables: [] };
  const tables = (current.tables || []).filter((table) => table.tableId !== tableResult.tableId);
  tables.push(tableResult);
  return updatePdfDocument(documentId, { tables });
}

export function getPdfTables(documentId) {
  return getPdfIntelligenceAnalysis(documentId)?.tables || [];
}

export function savePdfChunk(documentId, chunk = {}) {
  const current = getPdfIntelligenceAnalysis(documentId) || { documentId, chunks: [] };
  const chunks = (current.chunks || []).filter((item) => item.chunkId !== chunk.chunkId);
  chunks.push(chunk);
  return updatePdfDocument(documentId, { chunks });
}

export function getPdfChunks(documentId) {
  return getPdfIntelligenceAnalysis(documentId)?.chunks || [];
}

export function savePdfSummary(documentId, summary = {}) {
  const current = getPdfIntelligenceAnalysis(documentId) || { documentId, summaries: [] };
  const summaries = (current.summaries || []).filter((item) => item.summaryType !== summary.summaryType);
  summaries.push(summary);
  return updatePdfDocument(documentId, { summaries, summary: { ...(current.summary || {}), ...summary } });
}

export function getPdfSummary(documentId, summaryType) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!summaryType) return analysis?.summary || null;
  return (analysis?.summaries || []).find((summary) => summary.summaryType === summaryType) || null;
}

export function markPdfProcessingStatus(documentId, status, patch = {}) {
  return updatePdfDocument(documentId, { status, ...patch });
}

export function savePdfJob(documentId, job = {}) {
  const current = getPdfIntelligenceAnalysis(documentId) || { documentId, jobs: {}, pipelineStatus: {} };
  const jobs = { ...(current.jobs || {}) };
  jobs[job.id] = {
    ...(jobs[job.id] || {}),
    ...job,
    documentId,
    updatedAt: new Date().toISOString(),
    createdAt: jobs[job.id]?.createdAt || job.createdAt || new Date().toISOString(),
  };
  const pipelineStatus = { ...(current.pipelineStatus || {}) };
  if (job.type) {
    pipelineStatus[job.type] = {
      status: job.status,
      progress: job.progress ?? 0,
      currentPage: job.currentPage ?? null,
      totalPages: job.totalPages ?? null,
      error: job.error ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
  return updatePdfDocument(documentId, { jobs, pipelineStatus });
}

export function getPdfJobs(documentId) {
  return Object.values(getPdfIntelligenceAnalysis(documentId)?.jobs || {});
}

export function getPdfPipelineStatus(documentId) {
  return getPdfIntelligenceAnalysis(documentId)?.pipelineStatus || {};
}
