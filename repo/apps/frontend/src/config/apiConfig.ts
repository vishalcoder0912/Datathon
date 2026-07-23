export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.VITE_BACKEND_URL as string) ||
  "http://localhost:3001";

export const ML_SERVICE_URL: string =
  (import.meta.env.VITE_ML_SERVICE_URL as string) || "http://localhost:8000";

export const FRONTEND_URL: string =
  (import.meta.env.VITE_FRONTEND_URL as string) || "http://localhost:5173";

export const OLLAMA_BASE_URL: string =
  (import.meta.env.VITE_OLLAMA_HOST as string) ||
  (import.meta.env.VITE_OLLAMA_BASE_URL as string) ||
  "http://localhost:11434";

export function apiEndpoint(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
