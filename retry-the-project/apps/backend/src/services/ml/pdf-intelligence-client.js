import fs from "node:fs";
import path from "node:path";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const PDF_INTELLIGENCE_TIMEOUT_MS = Number(process.env.PDF_INTELLIGENCE_TIMEOUT_MS || 60000);

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function assertReadableFile(filePath) {
  if (!filePath) throw new Error("PDF file path is required");
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error("PDF file does not exist");
  }
  return absolutePath;
}

async function postMl(pathname, payload) {
  const { signal, clear } = timeoutSignal(PDF_INTELLIGENCE_TIMEOUT_MS);
  try {
    const response = await fetch(`${ML_SERVICE_URL}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`PDF intelligence ML request failed: ${response.status} ${text}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`PDF intelligence request timed out after ${PDF_INTELLIGENCE_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clear();
  }
}

export async function analyzePdfWithMlService({
  filePath,
  documentId,
  ocrEnabled = true,
  forceOcr = false,
  extractTables = true,
  storeChunks = false,
  maxPages,
}) {
  return postMl("/pdf-intelligence/analyze", {
    file_path: assertReadableFile(filePath),
    document_id: documentId,
    ocr_enabled: ocrEnabled,
    force_ocr: forceOcr,
    extract_tables: extractTables,
    store_chunks: storeChunks,
    max_pages: maxPages,
  });
}

export async function extractPdfTablesWithMlService({ filePath, ocrEnabled = true }) {
  return postMl("/pdf-intelligence/extract-tables", {
    file_path: assertReadableFile(filePath),
    ocr_enabled: ocrEnabled,
  });
}

export async function runPdfOcrWithMlService({ filePath, pages }) {
  return postMl("/pdf-intelligence/ocr", {
    file_path: assertReadableFile(filePath),
    pages,
  });
}

export default {
  analyzePdfWithMlService,
  extractPdfTablesWithMlService,
  runPdfOcrWithMlService,
};
