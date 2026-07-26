import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Busboy from "busboy";

import { sendSuccess, sendError } from "../utils/response-utils.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { createDataset } from "../database/dataset-repository.js";
import { updateDataset, updateAnalysis } from "./state.js";
import { analyzePdfWithMlService } from "../services/pdf/pdf-intelligence-client.js";
import { parsePdfWithOpenDataLoader } from "../services/pdf/pdf-loader-service.js";
import { buildPdfDataset } from "../services/pdf/pdf-dataset-builder.js";
import { getPdfKnowledgeBase, savePdfKnowledgeBase } from "../services/pdf/pdf-store.js";
import { answerPdfQuestion as answerLegacyPdfQuestion } from "../services/pdf/pdf-qa-service.js";
import {
  compactPdfAnalysis,
  getPdfIntelligenceAnalysis,
  getPdfIntelligenceSummary,
  savePdfIntelligenceAnalysis,
} from "../services/pdf/pdf-intelligence-store.js";
import { indexPdfAnalysisBestEffort } from "../services/pdf/pdf-vector-store.js";
import { answerPdfQuestion as answerPdfIntelligenceQuestion } from "../services/pdf/pdf-query-service.js";
import { explainPdfDocument } from "../services/pdf/pdf-explanation-service.js";
import { pdfProcessingPolicy, validatePdfUpload } from "../services/pdf/pdf-processing-policy.js";
import { getPdfReadiness } from "../services/pdf/pdf-readiness.js";
import { buildPdfRagChunks } from "../services/pdf/pdf-rag-chunker.js";
import { buildHierarchicalPdfSummary } from "../services/pdf/pdf-hierarchical-summary.js";
import {
  createUploadedPdfDocument,
  enqueuePdfJob,
  queueForceOcrPipeline,
  queueInitialPdfPipelines,
  queueReindexPipeline,
  runTableExtractionPipeline,
} from "../services/pdf/pdf-pipeline-orchestrator.js";
import { buildDataAnalyticsProjectsDashboard } from "../services/playbooks/playbook-dashboard-engine.js";

const uploadDir = path.resolve("data", "uploads", "pdfs");
await fsp.mkdir(uploadDir, { recursive: true });

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

function parsePdfMultipart(request) {
  return new Promise((resolve, reject) => {
    const contentType = request.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      reject(new Error("Content-Type must be multipart/form-data"));
      return;
    }

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: pdfProcessingPolicy.maxFileSizeMb * 1024 * 1024,
      },
    });

    let uploadedFile = null;
    let settled = false;
    const fields = {};
    const writeTasks = [];

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (fieldName, file, info) => {
      const { filename, mimeType } = info;

      try {
        validatePdfUpload({ mimeType });
      } catch (error) {
        file.resume();
        fail(error);
        return;
      }

      const safeName = String(filename || "document.pdf").replace(/[^\w.-]+/g, "_");
      const storedName = `${randomUUID()}-${safeName}`;
      const filePath = path.join(uploadDir, storedName);
      const stream = fs.createWriteStream(filePath);

      uploadedFile = {
        fieldName,
        originalName: safeName,
        storedName,
        filePath,
        mimeType,
      };

      file.pipe(stream);

      writeTasks.push(
        new Promise((resolveStream, rejectStream) => {
          stream.on("finish", resolveStream);
          stream.on("error", rejectStream);
          file.on("limit", () => rejectStream(new Error("PDF file is too large")));
        }),
      );
    });

    busboy.on("error", fail);

    busboy.on("finish", async () => {
      if (settled) return;

      try {
        await Promise.all(writeTasks);

        if (!uploadedFile) {
          fail(new Error("PDF file is required"));
          return;
        }

        settled = true;
        resolve({ file: uploadedFile, fields });
      } catch (error) {
        fail(error);
      }
    });

    request.pipe(busboy);
  });
}

function safeNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[,$₹%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallbackAnalysis(dataset) {
  const columns = dataset.columns || [];
  const rows = dataset.rows || [];
  const numeric = columns.find((column) => column.type === "number");
  const dimension = columns.find((column) => column.type !== "number");
  const kpis = [
    {
      id: randomUUID(),
      title: "Extracted Rows",
      value: rows.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    },
    {
      id: randomUUID(),
      title: "Extracted Columns",
      value: columns.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    },
  ];
  const chartRecommendations = [];

  if (dimension) {
    const counts = new Map();

    for (const row of rows) {
      const key = String(row[dimension.name] || "Unknown");
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    chartRecommendations.push({
      id: randomUUID(),
      title: `Rows by ${dimension.name}`,
      type: "bar",
      xKey: dimension.name,
      yKey: "count",
      aggregation: "count",
      data: [...counts.entries()]
        .map(([label, count]) => ({ [dimension.name]: label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  }

  if (numeric && dimension) {
    const groups = new Map();

    for (const row of rows) {
      const key = String(row[dimension.name] || "Unknown");
      const value = safeNumber(row[numeric.name]);
      if (value === null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(value);
    }

    chartRecommendations.push({
      id: randomUUID(),
      title: `Average ${numeric.name} by ${dimension.name}`,
      type: "bar",
      xKey: dimension.name,
      yKey: numeric.name,
      aggregation: "avg",
      data: [...groups.entries()]
        .map(([label, values]) => ({
          [dimension.name]: label,
          [numeric.name]: values.reduce((sum, value) => sum + value, 0) / values.length,
        }))
        .sort((a, b) => b[numeric.name] - a[numeric.name])
        .slice(0, 10),
    });
  }

  return {
    dataType: "pdf_document",
    dataTypeLabel: "PDF Extracted Dataset",
    kpis,
    chartRecommendations,
    insights: [
      {
        type: "summary",
        title: "PDF Imported",
        message: `Extracted ${rows.length.toLocaleString()} rows and ${columns.length.toLocaleString()} columns from PDF tables.`,
      },
    ],
    privacy: {
      rawPdfSentToLLM: false,
      schemaOnly: true,
    },
  };
}

async function analyzePdfDataset(dataset) {
  try {
    const analysis = await buildDataAnalyticsProjectsDashboard(dataset);
    if (analysis) return analysis;
  } catch {
    // fallback below
  }

  return buildFallbackAnalysis(dataset);
}

function inferColumnType(values = []) {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!present.length) return "string";
  const numericRatio = present.filter((value) => Number.isFinite(Number(value))).length / present.length;
  if (numericRatio >= 0.7) return "number";
  const dateRatio = present.filter((value) => !Number.isNaN(Date.parse(String(value)))).length / present.length;
  if (dateRatio >= 0.7) return "date";
  return "string";
}

function datasetFromPdfTable({ fileName, documentId, table }) {
  if (table?.tableType === "text_block_table" || table?.usableForDataset === false || table?.usableForDashboard === false) {
    return null;
  }
  const rows = Array.isArray(table?.cleanedRows) ? table.cleanedRows : [];
  const columnNames = table?.cleanedColumns?.length
    ? table.cleanedColumns
    : Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));

  const columns = columnNames.map((name) => ({
    name,
    type:
      table?.schema?.columns?.find((column) => column.name === name)?.type ||
      inferColumnType(rows.slice(0, 100).map((row) => row?.[name])),
    sample: rows.slice(0, 5).map((row) => row?.[name]),
  }));

  if (!rows.length || !columns.length) {
    return null;
  }

  return createDataset({
    name: `${fileName || "PDF"} - ${table.tableId || "Extracted Table"}`,
    fileName,
    sourceType: "pdf_extracted_table",
    columns,
    rows,
  });
}

function knowledgeBaseFromPdfAnalysis(analysis) {
  return {
    chunks: (analysis.chunks || []).map((chunk) => ({
      id: chunk.chunkId,
      content: chunk.text,
      pageNumber: chunk.pageNumber,
      confidence: chunk.metadata?.confidence,
      extractionMethod: chunk.metadata?.source,
    })),
    textElements: (analysis.pages || []).map((page) => ({
      pageNumber: page.pageNumber,
      text: String(page.text || "").slice(0, 1200),
      confidence: page.confidence,
      extractionMethod: page.method,
    })),
  };
}

function frontendPipelineStatus(analysis = {}) {
  const source = analysis.pipelineStatus || {};
  const map = {
    "pdf.preview": "preview",
    "pdf.extractText": "textExtraction",
    "pdf.clean": "cleaning",
    "pdf.chunk": "chunking",
    "pdf.index": "indexing",
    "pdf.extractTables": "tables",
    "pdf.summarize": "summary",
    "pdf.visualize": "visualizations",
    "pdf.ocr": "ocr",
  };
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, value]) => {
      const normalized = map[key] || key;
      return [
        [key, value],
        [normalized, value],
      ];
    }),
  );
}

function normalizePdfStatus(status = "") {
  if (status === "partially_completed") return "partial";
  if (["uploaded", "previewing", "text_extracted", "indexed", "tables_extracted"].includes(status)) return "processing";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return status || "processing";
}

export async function handlePdfRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname === "/api/pdf-intelligence/upload" && method === "POST") {
    try {
      const { file } = await parsePdfMultipart(request);
      const { documentId, reused } = createUploadedPdfDocument({ file });
      if (!reused || pdfProcessingPolicy.asyncProcessing) {
        queueInitialPdfPipelines(documentId);
      }
      sendSuccess(
        response,
        {
          documentId,
          status: "uploaded",
          message: reused ? "PDF uploaded. Cached processing state is available." : "PDF uploaded. Processing started.",
          next: {
            statusUrl: `/api/pdf-intelligence/${documentId}/status`,
            documentUrl: `/api/pdf-intelligence/${documentId}`,
          },
        },
        "PDF uploaded",
      );
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "PDF upload failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  if (pathname === "/api/pdf-intelligence/analyze" && method === "POST") {
    try {
      const contentType = request.headers["content-type"] || "";
      let file;
      let fields = {};
      if (contentType.includes("multipart/form-data")) {
        const parsed = await parsePdfMultipart(request);
        file = parsed.file;
        fields = parsed.fields;
      } else {
        const body = await readJsonBody(request);
        file = {
          originalName: path.basename(body.filePath || body.file_path || "document.pdf"),
          filePath: body.filePath || body.file_path,
        };
        fields = body;
      }

      const analysis = await analyzePdfWithMlService({
        filePath: file.filePath,
        documentId: fields.documentId || fields.document_id,
        ocrEnabled: fields.ocrEnabled !== false && fields.ocr_enabled !== false,
        forceOcr: fields.forceOcr === true || fields.force_ocr === true,
        extractTables: fields.extractTables !== false && fields.extract_tables !== false,
        maxPages: Number(fields.maxPages || fields.max_pages || pdfProcessingPolicy.maxPages),
      });

      const documentId = analysis.documentId;
      const normalizedAnalysis = { ...analysis, chunks: buildPdfRagChunks(analysis) };
      await buildHierarchicalPdfSummary(normalizedAnalysis);
      const finalAnalysis = getPdfIntelligenceAnalysis(documentId) || normalizedAnalysis;
      const vectorIndex = await indexPdfAnalysisBestEffort(finalAnalysis);
      savePdfIntelligenceAnalysis(documentId, finalAnalysis, { vectorIndex });

      sendSuccess(
        response,
        {
          analysis: finalAnalysis,
          document: compactPdfAnalysis(finalAnalysis),
          vectorIndex,
          privacy: {
            rawPdfSentToLLM: false,
            fullPdfBytesSentToFrontend: false,
            qdrantStoresOnlyChunksAndPreviews: true,
          },
        },
        "PDF intelligence analysis completed",
      );
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.BAD_REQUEST,
        error.message || "PDF intelligence analysis failed",
        ERROR_CODES.VALIDATION_ERROR,
      );
      return true;
    }
  }

  const extractTextMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/extract-text$/);
  if (extractTextMatch && method === "POST") {
    try {
      const [, documentId] = extractTextMatch;
      queueInitialPdfPipelines(documentId);
      sendSuccess(response, { documentId, status: "queued" }, "PDF text extraction queued");
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "PDF text extraction queue failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  const extractTablesMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/extract-tables$/);
  if (extractTablesMatch && method === "POST") {
    try {
      const [, documentId] = extractTablesMatch;
      const job = enqueuePdfJob({
        documentId,
        type: "pdf.extractTables",
        handler: async () => runTableExtractionPipeline(documentId),
      });
      sendSuccess(response, job, "PDF table extraction queued");
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "PDF table extraction failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  const documentMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)$/);
  if (documentMatch && method === "GET") {
    const [, documentId] = documentMatch;
    const summary = getPdfIntelligenceSummary(documentId);
    if (!summary) {
      sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
      return true;
    }
    sendSuccess(response, summary, "PDF intelligence document loaded");
    return true;
  }

  const queryMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/query$/);
  if (queryMatch && method === "POST") {
    try {
      const [, documentId] = queryMatch;
      const body = await readJsonBody(request);
      if (!body.query) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, "Query is required", ERROR_CODES.VALIDATION_ERROR);
        return true;
      }
      const result = await answerPdfIntelligenceQuestion({ documentId, query: body.query, intent: body.intent });
      sendSuccess(response, result, "PDF intelligence question answered");
      return true;
    } catch (error) {
      sendSuccess(response, {
        success: false,
        answer: "I could not answer because the PDF index is still building.",
        errorCode: "PDF_QUERY_FAILED",
        canRetry: true,
        readiness: {},
        sources: [],
        warnings: [error.message || "PDF intelligence question failed"],
      }, "PDF intelligence question status returned");
      return true;
    }
  }

  const explainMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/explain$/);
  if (explainMatch && method === "POST") {
    try {
      const [, documentId] = explainMatch;
      const result = await explainPdfDocument({ documentId });
      sendSuccess(response, result, "PDF explanation generated");
      return true;
    } catch (error) {
      sendSuccess(
        response,
        {
          answer: error.message || "PDF explanation is not available yet.",
          status: "processing",
          canRetry: true,
          sources: [],
          warnings: [],
        },
        "PDF explanation status returned",
      );
      return true;
    }
  }

  const statusMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/status$/);
  if (statusMatch && method === "GET") {
    const [, documentId] = statusMatch;
    const analysis = getPdfIntelligenceAnalysis(documentId);
    if (!analysis) {
      sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
      return true;
    }
    sendSuccess(
      response,
      {
        documentId,
        status: normalizePdfStatus(analysis.status || "completed"),
        progress: analysis.progress ?? 100,
        pipelines: frontendPipelineStatus(analysis),
        jobs: Object.values(analysis.jobs || {}),
        readiness: getPdfReadiness(analysis),
        currentPage: analysis.currentPage || analysis.pageCount || null,
        totalPages: analysis.pageCount || null,
        message: analysis.statusMessage || "PDF processing completed",
      },
      "PDF processing status loaded",
    );
    return true;
  }

  const tablesMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/tables$/);
  if (tablesMatch && method === "GET") {
    const [, documentId] = tablesMatch;
    const analysis = getPdfIntelligenceAnalysis(documentId);
    if (!analysis) {
      sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
      return true;
    }
    sendSuccess(response, { tables: analysis.tables || [], tableCount: analysis.tables?.length || 0 }, "PDF tables loaded");
    return true;
  }

  const pagesMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/pages$/);
  if (pagesMatch && method === "GET") {
    const [, documentId] = pagesMatch;
    const analysis = getPdfIntelligenceAnalysis(documentId);
    if (!analysis) {
      sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
      return true;
    }
    sendSuccess(response, { pages: analysis.pages || [], pageCount: analysis.pageCount || analysis.pages?.length || 0 }, "PDF pages loaded");
    return true;
  }

  const summariesMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/summaries$/);
  if (summariesMatch && method === "GET") {
    const [, documentId] = summariesMatch;
    const analysis = getPdfIntelligenceAnalysis(documentId);
    if (!analysis) {
      sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
      return true;
    }
    sendSuccess(
      response,
      {
        documentSummary: analysis.summary || null,
        sections: analysis.sections || [],
        pageSummaries: (analysis.pages || []).map((page) => ({
          pageNumber: page.pageNumber,
          pageSummary: page.pageSummary,
          confidence: page.confidence,
          warnings: page.warnings || [],
        })),
      },
      "PDF summaries loaded",
    );
    return true;
  }

  const reindexMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/reindex$/);
  if (reindexMatch && method === "POST") {
    try {
      const [, documentId] = reindexMatch;
      const job = queueReindexPipeline(documentId);
      sendSuccess(response, { documentId, job }, "PDF vector reindex queued");
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "PDF reindex failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  const forceOcrMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/force-ocr$/);
  if (forceOcrMatch && method === "POST") {
    try {
      const [, documentId] = forceOcrMatch;
      const existing = getPdfIntelligenceAnalysis(documentId);
      if (!existing) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }
      const job = queueForceOcrPipeline(documentId);
      sendSuccess(response, { documentId, job }, "Forced OCR queued");
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "Forced OCR failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  const convertMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/convert-table-to-dataset$/);
  if (convertMatch && method === "POST") {
    try {
      const [, documentId] = convertMatch;
      const body = await readJsonBody(request);
      const analysis = getPdfIntelligenceAnalysis(documentId);
      if (!analysis) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }
      const table = (analysis.tables || []).find((item) => item.tableId === body.tableId) || analysis.tables?.[0];
      if (!table) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "Extracted table not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }
      const dataset = datasetFromPdfTable({ fileName: analysis.fileName, documentId, table });
      if (!dataset) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, "Selected table has no analyzable rows", ERROR_CODES.VALIDATION_ERROR);
        return true;
      }
      updateDataset(dataset);
      sendSuccess(
        response,
        {
          dataset,
          source: {
            source: "pdf_extracted_table",
            documentId,
            tableId: table.tableId,
            qualityScore: table.quality?.score,
            ocrBased: (analysis.extractionSummary?.ocrPages || 0) > 0,
            warnings: [...(table.warnings || []), ...(table.quality?.issues || [])],
          },
        },
        "PDF table converted to dataset",
      );
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "PDF table conversion failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  const convertTableMatch = pathname.match(/^\/api\/pdf-intelligence\/([^/]+)\/tables\/([^/]+)\/convert-to-dataset$/);
  if (convertTableMatch && method === "POST") {
    try {
      const [, documentId, tableId] = convertTableMatch;
      const analysis = getPdfIntelligenceAnalysis(documentId);
      if (!analysis) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "PDF intelligence document not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }
      const table = (analysis.tables || []).find((item) => item.tableId === decodeURIComponent(tableId));
      if (!table) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "Extracted table not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }
      const dataset = datasetFromPdfTable({ fileName: analysis.fileName, documentId, table });
      if (!dataset) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, "Selected table has no analyzable rows", ERROR_CODES.VALIDATION_ERROR);
        return true;
      }
      updateDataset(dataset);
      sendSuccess(response, { dataset, source: { source: "pdf_extracted_table", documentId, tableId: table.tableId } }, "PDF table converted to dataset");
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.BAD_REQUEST, error.message || "PDF table conversion failed", ERROR_CODES.VALIDATION_ERROR);
      return true;
    }
  }

  if (pathname === "/api/pdf/import" && method === "POST") {
    try {
      const { file } = await parsePdfMultipart(request);

      if (process.env.PDF_INTELLIGENCE_ENABLED !== "false") {
        try {
          const analysis = await analyzePdfWithMlService({
            filePath: file.filePath,
            ocrEnabled: process.env.PDF_OCR_ENABLED !== "false",
            forceOcr: pdfProcessingPolicy.forceOcrDefault,
            extractTables: true,
            maxPages: pdfProcessingPolicy.maxPages,
          });
          const normalizedAnalysis = { ...analysis, chunks: buildPdfRagChunks(analysis) };
          await buildHierarchicalPdfSummary(normalizedAnalysis);
          const finalAnalysis = getPdfIntelligenceAnalysis(analysis.documentId) || normalizedAnalysis;
          const vectorIndex = await indexPdfAnalysisBestEffort(finalAnalysis);
          const bestTable =
            (finalAnalysis.tables || [])
              .filter((table) => table.usableForDataset !== false && table.tableType !== "text_block_table" && Array.isArray(table.cleanedRows) && table.cleanedRows.length)
              .sort((a, b) => (b.quality?.score || 0) - (a.quality?.score || 0))[0] || null;
          const dataset = bestTable
            ? datasetFromPdfTable({ fileName: file.originalName, documentId: finalAnalysis.documentId, table: bestTable })
            : null;
          const finalDataset =
            dataset ||
            createDataset({
              name: `${file.originalName} - PDF Text`,
              fileName: file.originalName,
              sourceType: "pdf",
              columns: [{ name: "text", type: "string", sample: [finalAnalysis.summary?.short || finalAnalysis.summary?.shortSummary || ""] }],
              rows: [{ text: finalAnalysis.summary?.short || finalAnalysis.summary?.shortSummary || "No analyzable table was extracted" }],
            });

          updateDataset(finalDataset);
          savePdfIntelligenceAnalysis(finalAnalysis.documentId, finalAnalysis, { vectorIndex, datasetId: finalDataset.id });
          savePdfKnowledgeBase(finalAnalysis.documentId, {
            pdfId: finalAnalysis.documentId,
            datasetId: finalDataset.id,
            fileName: file.originalName,
            knowledgeBase: knowledgeBaseFromPdfAnalysis(finalAnalysis),
            tables: finalAnalysis.tables || [],
            intelligenceEnabled: true,
          });

          const dashboardAnalysis = await analyzePdfDataset(finalDataset);
          updateAnalysis(dashboardAnalysis);

          sendSuccess(
            response,
            {
              pdf: {
                id: finalAnalysis.documentId,
                datasetId: finalDataset.id,
                fileName: file.originalName,
                jobId: finalAnalysis.documentId,
                pageCount: finalAnalysis.pageCount,
                tableCount: finalAnalysis.tables?.length || 0,
                chunkCount: finalAnalysis.chunks?.length || 0,
                textElementCount: finalAnalysis.pages?.length || 0,
                documentType: finalAnalysis.documentType,
                ocrUsed: (finalAnalysis.extractionSummary?.ocrPages || 0) > 0,
                qualityScore: finalAnalysis.quality?.overallScore,
                ocrConfidence: finalAnalysis.quality?.ocrConfidence,
                warnings: finalAnalysis.quality?.warnings || [],
              },
              dataset: finalDataset,
              analysis: dashboardAnalysis,
              pdfIntelligence: compactPdfAnalysis(finalAnalysis),
              knowledgeBaseSummary: {
                tableCount: finalAnalysis.tables?.length || 0,
                chunkCount: finalAnalysis.chunks?.length || 0,
                textElementCount: finalAnalysis.pages?.length || 0,
              },
              privacy: {
                rawPdfSentToLLM: false,
                extractedTextCanBeUsedForRAG: true,
                dashboardValuesCalculatedLocally: true,
                qdrantStoresOnlyChunksAndPreviews: true,
              },
            },
            "PDF imported with OCR intelligence",
          );

          return true;
        } catch (error) {
          console.warn("[PDF] OCR intelligence unavailable, falling back to legacy parser:", error.message);
        }
      }

      const parsed = await parsePdfWithOpenDataLoader(file.filePath);
      const { dataset: extractedDataset, knowledgeBase, tables } = buildPdfDataset({
        fileName: file.originalName,
        pdfJson: parsed.json,
        markdown: parsed.markdown,
      });
      const pdfId = randomUUID();
      const dataset = createDataset({
        name: extractedDataset.name,
        fileName: extractedDataset.fileName,
        sourceType: "pdf",
        columns: extractedDataset.columns,
        rows: extractedDataset.rows,
      });
      const finalDataset = dataset || { ...extractedDataset, id: pdfId };

      updateDataset(finalDataset);

      savePdfKnowledgeBase(pdfId, {
        pdfId,
        datasetId: finalDataset.id,
        fileName: file.originalName,
        jobId: parsed.jobId,
        outputDir: parsed.outputDir,
        knowledgeBase,
        tables,
      });

      const analysis = await analyzePdfDataset(finalDataset);
      updateAnalysis(analysis);

      sendSuccess(
        response,
        {
          pdf: {
            id: pdfId,
            datasetId: finalDataset.id,
            fileName: file.originalName,
            jobId: parsed.jobId,
            tableCount: tables.length,
            chunkCount: knowledgeBase.chunks.length,
            textElementCount: knowledgeBase.textElements.length,
          },
          dataset: finalDataset,
          analysis,
          knowledgeBaseSummary: {
            tableCount: tables.length,
            chunkCount: knowledgeBase.chunks.length,
            textElementCount: knowledgeBase.textElements.length,
          },
          privacy: {
            rawPdfSentToLLM: false,
            extractedTextCanBeUsedForRAG: true,
            dashboardValuesCalculatedLocally: true,
          },
        },
        "PDF imported and analyzed",
      );

      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.BAD_REQUEST,
        error.message || "PDF import failed",
        ERROR_CODES.VALIDATION_ERROR,
      );

      return true;
    }
  }

  const askMatch = pathname.match(/^\/api\/pdf\/([^/]+)\/ask$/);

  if (askMatch && method === "POST") {
    try {
      const [, pdfId] = askMatch;
      const body = await readJsonBody(request);

      if (!body.query) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, "Query is required", ERROR_CODES.VALIDATION_ERROR);
        return true;
      }

      const stored = getPdfKnowledgeBase(pdfId);

      if (!stored) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "PDF knowledge base not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }

      const intelligence = getPdfIntelligenceAnalysis(pdfId);
      const result = intelligence
        ? await answerPdfIntelligenceQuestion({
            documentId: pdfId,
            question: body.query,
          })
        : await answerLegacyPdfQuestion({
            query: body.query,
            knowledgeBase: stored.knowledgeBase,
          });

      sendSuccess(response, result, "PDF question answered");
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "PDF question failed",
        ERROR_CODES.AI_GENERATION_FAILED,
      );

      return true;
    }
  }

  return false;
}
