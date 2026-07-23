import { answerPdfQuestion } from "./pdf-query-service.js";

export function explainPdfDocument({ documentId }) {
  return answerPdfQuestion({ documentId, query: "explain the PDF", intent: "explain_pdf" });
}
