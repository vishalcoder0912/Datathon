import { pdfProcessingPolicy } from "./pdf-processing-policy.js";

function cleanText(value = "") {
  return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function stableTextKey(text = "") {
  return cleanText(text).toLowerCase().replace(/\s+/g, " ").slice(0, 500);
}

function splitText(text = "", { chunkSize = pdfProcessingPolicy.chunkSize, overlap = pdfProcessingPolicy.chunkOverlap } = {}) {
  const normalized = cleanText(text);
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const content = normalized.slice(start, end).trim();
    if (content) chunks.push(content);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function makeChunk({ documentId, chunkId, chunkType, pageNumber = null, text, metadata = {} }) {
  return {
    chunkId,
    documentId,
    chunkType,
    type: chunkType,
    pageNumber,
    text: cleanText(text),
    metadata,
  };
}

function documentSummaryText(summary = {}) {
  return cleanText(
    [
      summary.documentTitle ? `Title: ${summary.documentTitle}` : "",
      summary.shortSummary || summary.short || "",
      summary.detailedSummary || summary.long || "",
      Array.isArray(summary.keyPoints) && summary.keyPoints.length ? `Key points:\n${summary.keyPoints.map((item) => `- ${item}`).join("\n")}` : "",
      Array.isArray(summary.detectedTables) && summary.detectedTables.length
        ? `Detected tables:\n${summary.detectedTables.map((item) => `- ${item}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

function tableSummaryText(table = {}) {
  const columns = table.cleanedColumns || table.columns || [];
  const preview = table.preview || table.cleanedRows?.slice(0, 3) || [];
  return cleanText(
    [
      table.summary || `Table ${table.tableId || ""}`.trim(),
      columns.length ? `Columns: ${columns.join(", ")}` : "",
      table.schema ? `Schema: ${JSON.stringify(table.schema).slice(0, 1200)}` : "",
      preview.length ? `Preview: ${JSON.stringify(preview).slice(0, 1600)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function isTextLikeOneColumnTable(table = {}) {
  const columns = table.cleanedColumns || [];
  const rows = table.cleanedRows || [];
  return columns.length === 1 && rows.length > 0;
}

export function buildPdfRagChunks(analysis = {}, options = {}) {
  const documentId = analysis.documentId || analysis.id;
  if (!documentId) return [];

  const chunks = [];
  const seen = new Set();
  const add = (chunk) => {
    if (!chunk?.text) return;
    const key = `${chunk.chunkType}:${chunk.pageNumber ?? "doc"}:${stableTextKey(chunk.text)}`;
    if (seen.has(key)) return;
    seen.add(key);
    chunks.push(chunk);
  };

  const summaryText = documentSummaryText(analysis.summary || {});
  if (summaryText) {
    add(
      makeChunk({
        documentId,
        chunkId: `${documentId}_document_summary`,
        chunkType: "document_summary",
        text: summaryText,
        metadata: {
          source: "document_summary",
          confidence: analysis.quality?.overallScore ?? 0.75,
          fullTextLength: summaryText.length,
        },
      }),
    );
  }

  for (const page of analysis.pages || []) {
    const pageNumber = page.pageNumber ?? page.number ?? null;
    const pageSummary = cleanText(page.pageSummary || page.summary);
    if (pageSummary) {
      add(
        makeChunk({
          documentId,
          chunkId: `${documentId}_page_${pageNumber}_summary`,
          chunkType: "page_summary",
          pageNumber,
          text: pageSummary,
          metadata: {
            source: "page_summary",
            confidence: page.confidence ?? page.ocrConfidence ?? 0.7,
            fullTextLength: pageSummary.length,
          },
        }),
      );
    }

    const pageText = cleanText(page.cleanedText || page.text || page.mergedText);
    splitText(pageText, options).forEach((text, index) => {
      add(
        makeChunk({
          documentId,
          chunkId: `${documentId}_page_${pageNumber}_chunk_${index + 1}`,
          chunkType: page.extractionMethod === "ocr" || page.method === "ocr" ? "ocr_text" : "page_text",
          pageNumber,
          text,
          metadata: {
            source: page.extractionMethod || page.method || "digital_text",
            confidence: page.confidence ?? page.ocrConfidence ?? 0.8,
            fullTextLength: pageText.length,
          },
        }),
      );
    });
  }

  for (const table of analysis.tables || []) {
    const text = tableSummaryText(table);
    if (text) {
      add(
        makeChunk({
          documentId,
          chunkId: `${table.tableId || `${documentId}_table_${chunks.length + 1}`}_summary`,
          chunkType: "table_summary",
          pageNumber: table.pageNumber ?? null,
          text,
          metadata: {
            source: table.extractionMethod || "table_extraction",
            confidence: table.quality?.score ?? table.confidence ?? 0.65,
            tableId: table.tableId,
            fullTextLength: text.length,
          },
        }),
      );
    }

    if (isTextLikeOneColumnTable(table)) {
      const column = table.cleanedColumns[0];
      const tableText = cleanText(table.cleanedRows.map((row) => row?.[column]).filter(Boolean).join("\n"));
      splitText(tableText, options).forEach((text, index) => {
        add(
          makeChunk({
            documentId,
            chunkId: `${table.tableId || `${documentId}_text_table`}_text_${index + 1}`,
            chunkType: "page_text",
            pageNumber: table.pageNumber ?? null,
            text,
            metadata: {
              source: "text_like_table",
              confidence: table.quality?.score ?? table.confidence ?? 0.6,
              tableId: table.tableId,
              fullTextLength: tableText.length,
            },
          }),
        );
      });
    }
  }

  for (const chunk of analysis.chunks || []) {
    add(
      makeChunk({
        documentId,
        chunkId: chunk.chunkId || chunk.id || `${documentId}_existing_${chunks.length + 1}`,
        chunkType: chunk.chunkType || chunk.type || "page_text",
        pageNumber: chunk.pageNumber ?? null,
        text: chunk.text || chunk.content,
        metadata: {
          ...(chunk.metadata || {}),
          source: chunk.metadata?.source || chunk.source || chunk.sourceType,
          confidence: chunk.metadata?.confidence ?? chunk.confidence,
          fullTextLength: chunk.metadata?.fullTextLength ?? String(chunk.text || chunk.content || "").length,
        },
      }),
    );
  }

  return chunks;
}

export function chunkPdfMarkdown(markdown = "", options = {}) {
  const chunkSize = options.chunkSize || pdfProcessingPolicy.chunkSize;
  const overlap = options.overlap || pdfProcessingPolicy.chunkOverlap;
  const normalized = String(markdown || "").replace(/\r\n/g, "\n").trim();

  if (!normalized) return [];

  const sections = normalized
    .split(/\n(?=#{1,6}\s)/g)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks = [];

  for (const section of sections.length ? sections : [normalized]) {
    let start = 0;

    while (start < section.length) {
      const end = Math.min(start + chunkSize, section.length);
      const content = section.slice(start, end).trim();

      if (content) {
        chunks.push({
          id: `chunk_${chunks.length + 1}`,
          content,
          sourceType: "pdf_markdown",
          tokenEstimate: Math.ceil(content.length / 4),
        });
      }

      if (end >= section.length) break;
      start = Math.max(0, end - overlap);
    }
  }

  return chunks;
}
