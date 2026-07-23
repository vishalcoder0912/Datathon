function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getPdfReadiness(analysis = {}) {
  const pages = analysis.pages || [];
  const chunks = analysis.chunks || [];
  const summary = analysis.summary || {};
  const hasPageText = pages.some((page) => hasText(page.cleanedText) || hasText(page.text) || hasText(page.mergedText));
  const hasChunks = chunks.some((chunk) => hasText(chunk.text) || hasText(chunk.content));
  const hasDocumentSummary = hasText(summary.shortSummary) || hasText(summary.short) || hasText(summary.detailedSummary) || hasText(summary.long);
  const hasVectorIndex = Boolean(analysis.vectorIndex?.success || analysis.vectorIndex?.chunks?.indexed > 0);
  const canAskQuestions = Boolean(analysis.documentId && (hasVectorIndex || hasChunks || hasPageText || hasDocumentSummary));
  const activePipelines = Object.entries(analysis.pipelineStatus || {})
    .filter(([, value]) => ["queued", "running"].includes(value?.status))
    .map(([type, value]) => ({ type, name: type.replace(/^pdf\./, ""), status: value.status, progress: value.progress ?? 0 }));
  let status = "processing";
  if (hasVectorIndex && canAskQuestions) status = "query_ready";
  else if (canAskQuestions) status = "partially_query_ready";
  else if (activePipelines.some((pipeline) => pipeline.type === "pdf.extractText")) status = "text_extraction_running";
  else if (analysis.status === "failed") status = "failed";
  return {
    documentId: analysis.documentId || null,
    status,
    hasUploadedPdf: Boolean(analysis.documentId),
    hasText: hasPageText,
    hasPageText,
    hasChunks,
    hasVectorIndex,
    hasDocumentSummary,
    hasTables: Boolean(analysis.tables?.length),
    canAskQuestions,
    canExplainPdf: Boolean(analysis.documentId && (hasDocumentSummary || hasPageText || hasChunks)),
    canUseVectorSearch: hasVectorIndex,
    canUseLocalFallback: hasPageText || hasChunks || hasDocumentSummary,
    canSummarizePage: hasPageText || pages.some((page) => hasText(page.pageSummary)),
    canShowMetrics: Boolean((analysis.tables || []).some((table) => table.tableType !== "text_block_table")),
    processingMessage: canAskQuestions
      ? hasVectorIndex
        ? "PDF query index is ready."
        : "PDF is processing. I can answer from available extracted text if ready."
      : "Your PDF is uploaded but still processing. Text extraction has not produced query-ready content yet.",
    progress: analysis.progress ?? (canAskQuestions ? 80 : 0),
    activePipelines,
    isProcessing: activePipelines.length > 0 && !hasVectorIndex,
  };
}

export function getProcessingAnswer(analysis = {}, readiness = getPdfReadiness(analysis), override = {}) {
  return { answer: override.answer || readiness.processingMessage, status: "processing", canRetry: true, readiness, sources: [], warnings: override.warnings || [] };
}
