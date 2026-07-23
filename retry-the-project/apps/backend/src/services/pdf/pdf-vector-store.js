import { buildPdfRagChunks } from "./pdf-rag-chunker.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";
import { getPdfIntelligenceAnalysis, updatePdfDocument } from "./pdf-intelligence-store.js";

const localPdfIndex = new Map();

export function applyChunkLimit(chunks = []) {
  const max = Number(pdfProcessingPolicy.maxIndexChunks || 0);
  if (!max || max <= 0) return chunks;
  return chunks.slice(0, max);
}

function batches(items = [], size = pdfProcessingPolicy.vectorBatchSize) {
  const batchSize = Math.max(1, Number(size || 1));
  const out = [];
  for (let index = 0; index < items.length; index += batchSize) out.push(items.slice(index, index + batchSize));
  return out;
}

function keywordScore(text = "", query = "") {
  const haystack = String(text || "").toLowerCase();
  const terms = String(query || "").toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) / terms.length;
}

export function detectPdfQueryIntent(query = "") {
  const value = String(query || "").toLowerCase();
  const pageMatch = value.match(/\bpage\s+(\d+)\b/);
  if (/\b(table|tables|row|column|schema)\b/.test(value)) return { intent: "table_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (/\b(total|highest|lowest|average|metric|calculate|sum|count)\b/.test(value)) return { intent: "metric_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (pageMatch || /\bwhat is on page\b/.test(value)) return { intent: "page_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (/\b(summary|summarize|main points|key points|full document overview|whole pdf)\b/.test(value)) return { intent: "document_summary", pageNumber: null };
  if (/\b(explain|overview|about|document)\b/.test(value)) return { intent: "explain_pdf", pageNumber: null };
  if (/\b(where|find|mention|search)\b/.test(value)) return { intent: "search_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  return { intent: "general_pdf_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
}

function priority(intent, type) {
  const map = {
    explain_pdf: { document_summary: 1.2, page_summary: 1.0, page_text: 0.65, ocr_text: 0.65, table_summary: 0.35 },
    document_summary: { document_summary: 1.25, page_summary: 1.05, page_text: 0.6, ocr_text: 0.6, table_summary: 0.35 },
    table_question: { table_summary: 1.2, page_text: 0.45, ocr_text: 0.45 },
    page_question: { page_summary: 1.2, page_text: 1.0, ocr_text: 1.0, table_summary: 0.55 },
    search_question: { page_text: 1.0, ocr_text: 1.0, page_summary: 0.75, document_summary: 0.55, table_summary: 0.35 },
    general_pdf_question: { page_text: 0.9, ocr_text: 0.9, page_summary: 0.75, document_summary: 0.6, table_summary: 0.45 },
  };
  return map[intent]?.[type] ?? 0.4;
}

export async function indexPdfChunks(analysis = {}) {
  const documentId = analysis.documentId || analysis.id;
  const chunks = applyChunkLimit(buildPdfRagChunks(analysis)).filter((chunk) => String(chunk.text || "").trim());
  const batchList = batches(chunks);
  const indexed = [];
  for (const batch of batchList) {
    indexed.push(
      ...batch.map((chunk) => ({
        documentId,
        chunkId: chunk.chunkId,
        chunkType: chunk.chunkType,
        pageNumber: chunk.pageNumber,
        text: chunk.text.slice(0, 3000),
        source: chunk.metadata?.source,
        confidence: chunk.metadata?.confidence,
        fileName: analysis.fileName,
        embeddingModel: pdfProcessingPolicy.embeddingModel,
        fullTextLength: chunk.metadata?.fullTextLength ?? String(chunk.text || "").length,
        updatedAt: new Date().toISOString(),
      })),
    );
  }
  localPdfIndex.set(documentId, indexed);
  return { indexed: indexed.length, collection: "local-pdf-index", batchSize: pdfProcessingPolicy.vectorBatchSize, batches: batchList.length };
}

export async function indexPdfSummaries(analysis = {}) {
  return indexPdfChunks(analysis);
}

export async function indexPdfTables(analysis = {}) {
  return indexPdfChunks(analysis);
}

export async function indexPdfAnalysisBestEffort(analysis = {}) {
  try {
    const chunks = await indexPdfChunks(analysis);
    return { success: true, chunks };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function reindexPdfDocument(documentId) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) throw new Error("PDF intelligence document not found");
  const vectorIndex = await indexPdfAnalysisBestEffort(analysis);
  updatePdfDocument(documentId, { vectorIndex, status: "completed", progress: 100 });
  return vectorIndex;
}

export async function searchPdfChunks({ documentId, query, intent, limit = pdfProcessingPolicy.queryTopK, pageNumber }) {
  const detected = intent ? { intent, pageNumber } : detectPdfQueryIntent(query);
  const finalIntent = detected.intent;
  const finalPageNumber = pageNumber ?? detected.pageNumber;
  const analysis = getPdfIntelligenceAnalysis(documentId);
  const indexed = localPdfIndex.get(documentId) || buildPdfRagChunks(analysis || {});
  const matches = indexed
    .filter((chunk) => !finalPageNumber || Number(chunk.pageNumber) === Number(finalPageNumber))
    .map((chunk) => ({
      ...chunk,
      score: keywordScore(chunk.text, query) + priority(finalIntent, chunk.chunkType || chunk.type),
      confidence: chunk.confidence ?? chunk.metadata?.confidence,
      source: chunk.source ?? chunk.metadata?.source,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return { matches, collection: "local-pdf-index", fallback: true, intent: finalIntent };
}

export async function deletePdfIndex() {
  return { success: true, skipped: true };
}
