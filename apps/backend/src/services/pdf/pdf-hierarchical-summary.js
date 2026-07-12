import { buildPdfRagChunks } from "./pdf-rag-chunker.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";

export async function buildHierarchicalPdfSummary(analysis = {}) {
  const existing = analysis.summary || {};
  if (existing.shortSummary || existing.detailedSummary) return existing;
  const chunks = buildPdfRagChunks(analysis).filter((chunk) => ["page_text", "ocr_text"].includes(chunk.chunkType));
  const first = chunks.map((chunk) => chunk.text).join("\n\n").slice(0, 1800);
  return {
    shortSummary: first ? first.slice(0, 500) : "PDF text was extracted, but no summary could be generated yet.",
    detailedSummary: first,
    keyPoints: [],
    summaryType: "document_summary",
    generatedBy: "hierarchical_local_pdf_summary",
    model: pdfProcessingPolicy.summarizerModel,
  };
}
