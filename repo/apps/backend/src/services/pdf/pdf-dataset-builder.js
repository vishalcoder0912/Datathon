import {
  extractPlainTextElements,
  extractTablesFromPdfJson,
  mergePdfTables,
} from "./pdf-table-extractor.js";
import { chunkPdfMarkdown } from "./pdf-rag-chunker.js";

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "").replace(/[,$₹%\s]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferType(values = []) {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!present.length) return "string";

  const numericCount = present.filter((value) => safeNumber(value) !== null).length;
  if (numericCount / present.length >= 0.8) return "number";

  const dateCount = present.filter((value) => Number.isFinite(Date.parse(String(value)))).length;
  if (dateCount / present.length >= 0.8) return "date";

  return "string";
}

function buildColumns(rows = []) {
  const names = Object.keys(rows[0] || {}).filter((name) => !name.startsWith("__"));

  return names.map((name) => ({
    name,
    type: inferType(rows.map((row) => row[name])),
    source: "pdf_table",
  }));
}

export function buildPdfDataset({ fileName, pdfJson, markdown }) {
  const tables = extractTablesFromPdfJson(pdfJson);
  const textElements = extractPlainTextElements(pdfJson);
  const rows = mergePdfTables(tables);
  const chunks = chunkPdfMarkdown(markdown);
  const columns = buildColumns(rows);

  const dataset = {
    id: null,
    name: `${fileName} Extracted Tables`,
    fileName,
    sourceType: "pdf",
    uploadedAt: new Date().toISOString(),
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    rows,
    metadata: {
      pdfTableCount: tables.length,
      pdfChunkCount: chunks.length,
      pdfTextElementCount: textElements.length,
    },
  };

  const knowledgeBase = {
    fileName,
    tableCount: tables.length,
    chunkCount: chunks.length,
    textElementCount: textElements.length,
    chunks,
    textElements,
  };

  return { dataset, tables, knowledgeBase };
}
