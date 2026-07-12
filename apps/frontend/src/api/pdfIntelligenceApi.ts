import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

export function uploadPdfIntelligence<T>(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<T>(API_ROUTES.pdfIntelligence.upload, {
    method: "POST",
    body,
  });
}

export function getPdfIntelligenceStatus<T>(pdfId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.status(pdfId));
}

export function getPdfIntelligenceDetails<T>(pdfId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.details(pdfId));
}

export function queryPdfIntelligence<T>(
  pdfId: string,
  query: string,
  intent?: string,
) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.query(pdfId), {
    method: "POST",
    body: JSON.stringify({ query, intent }),
  });
}

export function explainPdfIntelligence<T>(pdfId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.explain(pdfId), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function reindexPdfIntelligence<T>(pdfId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.reindex(pdfId), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function forceOcrPdfIntelligence<T>(pdfId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.forceOcr(pdfId), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
