const apiBaseUrl = (() => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  return baseUrl.replace(/\/$/, "");
})();

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
