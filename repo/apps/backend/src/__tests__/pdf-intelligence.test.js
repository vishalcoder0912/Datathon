import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { handlePdfRoutes } from "../routes/pdf.js";
import { makeRes } from "./test-helpers.js";
import { applyChunkLimit, detectPdfQueryIntent, indexPdfChunks, searchPdfChunks } from "../services/pdf/pdf-vector-store.js";
import { getPdfReadiness } from "../services/pdf/pdf-readiness.js";
import { buildPdfRagChunks } from "../services/pdf/pdf-rag-chunker.js";
import { answerPdfQuestion, buildPdfContext } from "../services/pdf/pdf-query-service.js";
import { savePdfIntelligenceAnalysis } from "../services/pdf/pdf-intelligence-store.js";

describe("PDF intelligence route surface", () => {
  it("returns a safe validation error when asking an unknown PDF knowledge base", async () => {
    const request = Readable.from([JSON.stringify({ query: "What revenue is shown?" })]);
    request.method = "POST";
    request.headers = { "content-type": "application/json" };
    const response = makeRes();
    const handled = await handlePdfRoutes(request, response, "/api/pdf/missing/ask");
    const payload = response.json();

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.message).toMatch(/not found/i);
  });

  it("classifies overview and table questions for intent-aware retrieval", () => {
    expect(detectPdfQueryIntent("explain the PDF").intent).toBe("explain_pdf");
    expect(detectPdfQueryIntent("what is this document about").intent).toBe("explain_pdf");
    expect(detectPdfQueryIntent("summarize the PDF").intent).toBe("document_summary");
    expect(detectPdfQueryIntent("list all tables").intent).toBe("table_question");
    expect(detectPdfQueryIntent("summarize page 1")).toMatchObject({ intent: "page_question", pageNumber: 1 });
  });

  it("computes processing readiness for an uploaded PDF without extracted text", () => {
    const readiness = getPdfReadiness({
      documentId: "pdf_processing",
      status: "uploaded",
      pipelineStatus: {
        "pdf.extractText": { status: "running", progress: 30 },
      },
      pages: [],
      tables: [],
      chunks: [],
      summary: {},
    });

    expect(readiness.hasUploadedPdf).toBe(true);
    expect(readiness.canAskQuestions).toBe(false);
    expect(readiness.status).toBe("text_extraction_running");
    expect(readiness.processingMessage).toMatch(/still processing/i);
  });

  it("allows partial query readiness when page text exists before vector indexing", () => {
    const readiness = getPdfReadiness({
      documentId: "pdf_partial",
      status: "text_extracted",
      pipelineStatus: {
        "pdf.index": { status: "running", progress: 20 },
      },
      pages: [{ pageNumber: 1, cleanedText: "Page one extracted text." }],
      tables: [],
      chunks: [],
      summary: {},
    });

    expect(readiness.canAskQuestions).toBe(true);
    expect(readiness.canSummarizePage).toBe(true);
    expect(readiness.hasVectorIndex).toBe(false);
    expect(readiness.status).toBe("partially_query_ready");
  });

  it("returns readiness flags expected by PDF status UI", () => {
    const readiness = getPdfReadiness({
      documentId: "pdf_ready_flags",
      pages: [{ pageNumber: 1, cleanedText: "Text." }],
      chunks: [{ chunkId: "c1", text: "Chunk." }],
      summary: { shortSummary: "Summary." },
      vectorIndex: { chunks: { indexed: 1 } },
    });

    expect(readiness).toMatchObject({
      hasText: true,
      hasChunks: true,
      hasVectorIndex: true,
      hasDocumentSummary: true,
      canAskQuestions: true,
      canExplainPdf: true,
      canUseVectorSearch: true,
      canUseLocalFallback: true,
    });
  });

  it("builds PDF chunks for page text, page summaries, document summary, and compact table summaries", () => {
    const chunks = buildPdfRagChunks({
      documentId: "pdf_chunk_shapes",
      fileName: "sample.pdf",
      summary: { shortSummary: "Document summary" },
      pages: [{ pageNumber: 1, cleanedText: "Page text ".repeat(80), pageSummary: "Page one summary", confidence: 0.9 }],
      tables: [{ tableId: "t1", pageNumber: 1, cleanedColumns: ["note"], cleanedRows: [{ note: "Paragraph table text" }], summary: "Table summary" }],
    });

    expect(chunks.some((chunk) => chunk.chunkType === "document_summary")).toBe(true);
    expect(chunks.some((chunk) => chunk.chunkType === "page_summary")).toBe(true);
    expect(chunks.some((chunk) => chunk.chunkType === "page_text")).toBe(true);
    expect(chunks.some((chunk) => chunk.chunkType === "table_summary")).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.chunkId)).size).toBe(chunks.length);
  });

  it("PDF_MAX_INDEX_CHUNKS=0 policy indexes all chunks through applyChunkLimit", () => {
    const chunks = Array.from({ length: 6001 }, (_, index) => ({ chunkId: `c${index}`, text: `chunk ${index}` }));
    expect(applyChunkLimit(chunks)).toHaveLength(6001);
  });

  it("uses batched PDF vector indexing metadata without an arbitrary 5000 chunk cap", async () => {
    const result = await indexPdfChunks({
      documentId: "pdf_batch_index",
      fileName: "batch.pdf",
      chunks: Array.from({ length: 5002 }, (_, index) => ({
        chunkId: `pdf_batch_index_${index}`,
        chunkType: "page_text",
        pageNumber: index + 1,
        text: `batch chunk ${index}`,
        metadata: { source: "digital_text", confidence: 0.9 },
      })),
    });

    expect(result.indexed).toBe(5002);
    expect(result.batchSize).toBeGreaterThan(0);
    expect(applyChunkLimit(Array.from({ length: 5002 }))).toHaveLength(5002);
  });

  it("local PDF fallback search is isolated by documentId", async () => {
    savePdfIntelligenceAnalysis("pdf_doc_a", {
      documentId: "pdf_doc_a",
      chunks: [{ chunkId: "a1", chunkType: "page_text", pageNumber: 1, text: "alpha revenue only in document A" }],
      pages: [],
      tables: [],
      summary: {},
    });
    savePdfIntelligenceAnalysis("pdf_doc_b", {
      documentId: "pdf_doc_b",
      chunks: [{ chunkId: "b1", chunkType: "page_text", pageNumber: 1, text: "beta margin only in document B" }],
      pages: [],
      tables: [],
      summary: {},
    });

    const result = await searchPdfChunks({ documentId: "pdf_doc_a", query: "beta margin", limit: 5 });
    expect(result.fallback).toBe(true);
    expect(result.matches.every((match) => match.documentId === "pdf_doc_a")).toBe(true);
    expect(result.matches.some((match) => match.chunkId === "b1")).toBe(false);
  });

  it("explain PDF includes stored document summary in the context", () => {
    const { context, sources } = buildPdfContext(
      [{ chunkId: "c1", chunkType: "page_text", pageNumber: 2, text: "Relevant page text", score: 0.8 }],
      28000,
      {
        documentId: "pdf_context",
        summary: { shortSummary: "Stored summary for the document." },
        quality: { overallScore: 0.91 },
      },
      "explain_pdf",
    );

    expect(context).toContain("Stored summary for the document.");
    expect(sources[0]).toMatchObject({ chunkType: "document_summary" });
  });

  it("PDF question prompt never sends a whole huge PDF directly to Ollama", async () => {
    const previousFetch = global.fetch;
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init.body));
      const userMessage = body.messages.find((message) => message.role === "user")?.content || "";
      expect(userMessage).not.toContain("WHOLE_PDF_TAIL_SENTINEL");
      expect(userMessage.length).toBeLessThanOrEqual(31000);
      return {
        ok: true,
        json: async () => ({ message: { content: "Answer from bounded context." } }),
      };
    });
    global.fetch = fetchMock;
    savePdfIntelligenceAnalysis("pdf_bounded_prompt", {
      documentId: "pdf_bounded_prompt",
      chunks: [
        {
          chunkId: "big",
          chunkType: "page_text",
          pageNumber: 1,
          text: `alpha ${"filler ".repeat(8000)} WHOLE_PDF_TAIL_SENTINEL`,
          metadata: { confidence: 0.9 },
        },
      ],
      pages: [],
      tables: [],
      summary: { shortSummary: "Short summary." },
      quality: { overallScore: 0.9 },
    });

    const answer = await answerPdfQuestion({ documentId: "pdf_bounded_prompt", query: "alpha", intent: "general_pdf_question" });
    global.fetch = previousFetch;

    expect(answer.rawPdfSentToLLM).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(answer.contextUsed.maxChars).toBe(28000);
  });

  it("Ollama failure returns stored summary fallback instead of a raw error", async () => {
    const previousFetch = global.fetch;
    global.fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    savePdfIntelligenceAnalysis("pdf_ollama_fallback", {
      documentId: "pdf_ollama_fallback",
      chunks: [{ chunkId: "c1", chunkType: "page_text", pageNumber: 1, text: "alpha answer evidence", metadata: { confidence: 0.9 } }],
      pages: [],
      tables: [],
      summary: { shortSummary: "Stored PDF summary." },
      quality: { overallScore: 0.9 },
    });

    const answer = await answerPdfQuestion({ documentId: "pdf_ollama_fallback", query: "explain this PDF", intent: "explain_pdf" });
    global.fetch = previousFetch;

    expect(answer.answer).toContain("Stored PDF summary");
    expect(answer.warnings.join(" ")).toMatch(/Local AI model is not responding/i);
  });

  it("query and reindex paths do not call the force OCR endpoint", async () => {
    const request = Readable.from([JSON.stringify({ query: "What is this PDF about?" })]);
    request.method = "POST";
    request.headers = { "content-type": "application/json" };
    const response = makeRes();
    await handlePdfRoutes(request, response, "/api/pdf-intelligence/missing_pdf/query");
    const queryPayload = response.json();

    expect(queryPayload.data.answer).toMatch(/could not find this PDF document/i);
    expect(queryPayload.data.warnings || []).not.toContain("Forced OCR queued");
  });
});
