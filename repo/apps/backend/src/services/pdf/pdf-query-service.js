import { getPdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";
import { detectPdfQueryIntent, searchPdfChunks } from "./pdf-vector-store.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";
import { getPdfReadiness, getProcessingAnswer } from "./pdf-readiness.js";

const PDF_QA_SYSTEM_PROMPT = `You are InsightFlow PDF Intelligence.

Answer the user using ONLY the provided PDF context.
Do not invent facts.
Do not use outside knowledge.
If the answer is not present in the PDF context, say:
"I could not find this information in the uploaded PDF."

Rules:
* Give a direct answer first.
* Then explain clearly.
* Use simple language.
* Mention page/source numbers when available.
* For summaries, organize the answer into key points.
* For tables/numbers, preserve exact values from the PDF context.
* Never claim you read pages that are not included in the provided sources.
* If OCR or extraction quality is low, mention uncertainty.`;

function isWholePdfIntent(intent) {
  return ["document_summary", "explain_pdf"].includes(intent);
}

function summaryText(analysis = {}) {
  const summary = analysis.summary || {};
  return [summary.shortSummary || summary.short, summary.detailedSummary || summary.long, ...(summary.keyPoints || [])].filter(Boolean).join("\n\n").trim();
}

export function buildPdfContext(matches = [], maxChars = pdfProcessingPolicy.contextMaxChars, analysis = null, intent = "") {
  let used = 0;
  const parts = [];
  const sources = [];
  if (analysis && pdfProcessingPolicy.includeDocumentSummary && isWholePdfIntent(intent)) {
    const text = summaryText(analysis);
    if (text) {
      const clipped = text.slice(0, Math.min(maxChars, 9000));
      used += clipped.length;
      sources.push({ source: 1, id: `${analysis.documentId}_document_summary`, chunkId: `${analysis.documentId}_document_summary`, pageNumber: null, chunkType: "document_summary", confidence: analysis.quality?.overallScore ?? null, preview: clipped.slice(0, 260), score: 1 });
      parts.push(`SOURCE 1 page=document chunkType=document_summary\n${clipped}`);
    }
  }
  for (const [index, match] of matches.entries()) {
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    const text = String(match.text || "").trim();
    if (!text) continue;
    const clipped = text.slice(0, remaining);
    used += clipped.length;
    sources.push({ source: sources.length + 1, id: match.chunkId || `source_${index + 1}`, chunkId: match.chunkId, pageNumber: match.pageNumber ?? null, chunkType: match.chunkType || match.type, confidence: match.confidence ?? null, extractionMethod: match.source, preview: clipped.slice(0, 260), score: match.score });
    parts.push(`SOURCE ${sources.length} page=${match.pageNumber ?? "document"} chunkType=${match.chunkType || match.type}\n${clipped}`);
  }
  return { context: parts.join("\n\n"), sources };
}

async function callOllama({ model, messages }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), pdfProcessingPolicy.intelligenceTimeoutMs);
  try {
    const response = await fetch(`${pdfProcessingPolicy.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, stream: false, messages, options: { temperature: 0 } }),
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const payload = await response.json();
    return payload.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

export async function answerPdfQuestion({ documentId, query, question, intent: explicitIntent }) {
  const userQuery = String(query || question || "").trim();
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) {
    return { answer: "I could not find this PDF document. Please upload it again.", model: pdfProcessingPolicy.explainerModel, intent: explicitIntent || "general_pdf_question", sources: [], warnings: [], contextUsed: { retrievedChunks: 0, usedDocumentSummary: false, maxChars: pdfProcessingPolicy.contextMaxChars } };
  }
  const detected = detectPdfQueryIntent(userQuery);
  const intent = explicitIntent || detected.intent;
  const readiness = getPdfReadiness(analysis);
  if (!readiness.canAskQuestions) return getProcessingAnswer(analysis, readiness);

  const retrieval = await searchPdfChunks({ documentId, query: userQuery, intent, pageNumber: detected.pageNumber, limit: pdfProcessingPolicy.queryTopK });
  const { context, sources } = buildPdfContext(retrieval.matches || [], pdfProcessingPolicy.contextMaxChars, analysis, intent);
  if (!context) {
    return { answer: "I could not find this information in the uploaded PDF.", intent, model: pdfProcessingPolicy.explainerModel, sources: [], warnings: ["No relevant PDF chunks matched the question."], contextUsed: { retrievedChunks: 0, usedDocumentSummary: false, maxChars: pdfProcessingPolicy.contextMaxChars } };
  }
  try {
    const answer = await callOllama({ model: pdfProcessingPolicy.explainerModel, messages: [{ role: "system", content: PDF_QA_SYSTEM_PROMPT }, { role: "user", content: `User question:\n${userQuery}\n\nPDF context:\n${context}` }] });
    return { answer, model: pdfProcessingPolicy.explainerModel, intent, sources, warnings: retrieval.fallback ? ["Answer generated from locally extracted PDF text because vector index is not ready."] : [], rawPdfSentToLLM: false, contextUsed: { retrievedChunks: retrieval.matches?.length || 0, usedDocumentSummary: sources.some((source) => source.chunkType === "document_summary"), maxChars: pdfProcessingPolicy.contextMaxChars } };
  } catch {
    return { answer: summaryText(analysis) ? `Local AI model is not responding. Stored PDF summary: ${summaryText(analysis)}` : "Local AI model is not responding. I could not find this information in the uploaded PDF.", model: pdfProcessingPolicy.explainerModel, intent, sources, warnings: ["Local AI model is not responding."], rawPdfSentToLLM: false, contextUsed: { retrievedChunks: retrieval.matches?.length || 0, usedDocumentSummary: sources.some((source) => source.chunkType === "document_summary"), maxChars: pdfProcessingPolicy.contextMaxChars } };
  }
}
