import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { analyzePdfWithMlService } from "./pdf-intelligence-client.js";
import { savePdfIntelligenceAnalysis, getPdfIntelligenceAnalysis, updatePdfDocument } from "./pdf-intelligence-store.js";
import { indexPdfAnalysisBestEffort, reindexPdfDocument } from "./pdf-vector-store.js";

export function hashPdfFile(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function createUploadedPdfDocument({ file }) {
  const fileHash = hashPdfFile(file.filePath);
  const documentId = `pdf_${fileHash.slice(0, 16)}`;
  savePdfIntelligenceAnalysis(documentId, {
    documentId,
    id: documentId,
    fileName: file.originalName,
    filePath: file.filePath,
    fileHash,
    status: "uploaded",
    progress: 0,
    pages: [],
    tables: [],
    chunks: [],
    summary: {},
    jobs: {},
    pipelineStatus: {},
    quality: { overallScore: 0, warnings: [] },
  });
  return { documentId, fileHash, reused: false };
}

export function enqueuePdfJob({ documentId, type, handler }) {
  const job = { id: `${type}_${randomUUID()}`, documentId, type, status: "queued", progress: 0 };
  void (async () => {
    updatePdfDocument(documentId, {
      pipelineStatus: { ...(getPdfIntelligenceAnalysis(documentId)?.pipelineStatus || {}), [type]: { status: "running", progress: 1 } },
    });
    try {
      await handler({ update: () => {} });
      updatePdfDocument(documentId, {
        pipelineStatus: { ...(getPdfIntelligenceAnalysis(documentId)?.pipelineStatus || {}), [type]: { status: "completed", progress: 100 } },
      });
    } catch (error) {
      updatePdfDocument(documentId, {
        status: "partial",
        pipelineStatus: { ...(getPdfIntelligenceAnalysis(documentId)?.pipelineStatus || {}), [type]: { status: "failed", progress: 0, error: error.message } },
      });
    }
  })();
  return job;
}

export function queueInitialPdfPipelines(documentId) {
  return enqueuePdfJob({
    documentId,
    type: "pdf.extractText",
    handler: async () => {
      const current = getPdfIntelligenceAnalysis(documentId);
      const analysis = await analyzePdfWithMlService({ filePath: current.filePath, documentId, forceOcr: false });
      const vectorIndex = await indexPdfAnalysisBestEffort(analysis);
      savePdfIntelligenceAnalysis(documentId, {
        ...current,
        ...analysis,
        vectorIndex,
        status: "completed",
        progress: 100,
        pipelineStatus: {
          "pdf.extractText": { status: "completed", progress: 100 },
          "pdf.ocr": { status: "skipped", progress: 0 },
          "pdf.chunk": { status: "completed", progress: 100 },
          "pdf.summarize": { status: "completed", progress: 100 },
          "pdf.index": { status: "completed", progress: 100 },
        },
      });
    },
  });
}

export function queueReindexPipeline(documentId) {
  return enqueuePdfJob({ documentId, type: "pdf.index", handler: async () => reindexPdfDocument(documentId) });
}

export function queueForceOcrPipeline(documentId) {
  return enqueuePdfJob({
    documentId,
    type: "pdf.ocr",
    handler: async () => {
      const current = getPdfIntelligenceAnalysis(documentId);
      const analysis = await analyzePdfWithMlService({ filePath: current.filePath, documentId, forceOcr: true });
      const vectorIndex = await indexPdfAnalysisBestEffort(analysis);
      savePdfIntelligenceAnalysis(documentId, { ...current, ...analysis, vectorIndex, status: "completed", progress: 100 });
    },
  });
}

export async function runTableExtractionPipeline(documentId) {
  const current = getPdfIntelligenceAnalysis(documentId);
  return current || { documentId, skipped: true };
}
