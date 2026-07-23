const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const ML_SERVICE_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 10000);

export async function requestFastDashboard({
  filePath,
  metricPriority,
  groupLimit = 10,
} = {}) {
  if (!filePath) {
    throw new Error("requestFastDashboard requires filePath");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/fast-dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        file_path: filePath,
        metric_priority: metricPriority,
        group_limit: groupLimit,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Fast dashboard failed: ${response.status} ${text}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Fast dashboard request timed out after ${ML_SERVICE_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  requestFastDashboard,
};
