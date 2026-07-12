export type DatasetRecord = Record<string, string | number | boolean | null | undefined>;

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.detail || `Request failed: ${response.status}`);
  }

  return data as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.detail || `Request failed: ${response.status}`);
  }

  return data as T;
}

export const mlApi = {
  health: () => getJson<{ ok: boolean; result: unknown }>("/api/ml/health"),
  profileByRecords: (records: DatasetRecord[]) => postJson("/api/ml/profile", { records }),
  profileByDataset: (datasetId: string) =>
    postJson(`/api/ml/datasets/${encodeURIComponent(datasetId)}/profile`, {}),
  correlationsByDataset: (datasetId: string) =>
    postJson(`/api/ml/datasets/${encodeURIComponent(datasetId)}/correlations`, {}),
  anomaliesByDataset: (datasetId: string) =>
    postJson(`/api/ml/datasets/${encodeURIComponent(datasetId)}/anomalies`, {}),
  clusterByDataset: (datasetId: string) =>
    postJson(`/api/ml/datasets/${encodeURIComponent(datasetId)}/cluster`, {}),
  trainModelByDataset: (datasetId: string, target: string) =>
    postJson(`/api/ml/datasets/${encodeURIComponent(datasetId)}/train-model`, { target }),
  compareDatasets: (leftDatasetId: string, rightDatasetId: string) =>
    postJson("/api/ml/compare-datasets", { leftDatasetId, rightDatasetId }),
  fullAgenticAnalysis: (
    datasetId: string,
    payload: { target?: string; goal?: string; datasetName?: string } = {},
  ) => postJson(`/api/agentic-ds/datasets/${encodeURIComponent(datasetId)}/full-analysis`, payload),
};
