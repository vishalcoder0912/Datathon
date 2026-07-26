/**
 * @fileoverview Central HTTP API client for InsightFlow frontend.
 * Provides typed fetch wrapper with automatic base URL resolving, header injection,
 * and unified error extraction.
 * 
 * @module frontend/api/client
 */

const apiBaseUrl = (() => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  return baseUrl.replace(/\/$/, "");
})();

/**
 * Sends typed HTTP request to backend API endpoint.
 * 
 * @template T
 * @param {string} path - Relative URL path of the API endpoint.
 * @param {RequestInit} [options={}] - Standard fetch request options.
 * @returns {Promise<T>} Promise resolving to the parsed response payload.
 * @throws {Error} Throws Error if network request fails or HTTP status code is non-2xx.
 */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method || "GET";
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: isFormData
      ? options.headers
      : {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { success: false, error: await response.text().catch(() => "") };

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      data?.error ||
      `API failed: ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

