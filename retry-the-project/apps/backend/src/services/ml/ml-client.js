import { serviceUrls } from "../../config/serviceUrls.js";

const DEFAULT_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 30_000);
const ML_SERVICE_URL = serviceUrls.ml;

export class MlServiceError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'MlServiceError';
    this.status = status;
    this.cause = cause;
  }
}

async function request(path, payload, { method = 'POST', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ML_SERVICE_URL}${path}`, {
      method,
      headers: payload ? { 'content-type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new MlServiceError(data?.detail || `ML service returned ${response.status}`, {
        status: response.status,
      });
    }

    return data;
  } catch (error) {
    if (error instanceof MlServiceError) throw error;
    throw new MlServiceError('ML service unavailable or timed out', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function rowsPayload(records, options = {}) {
  const { records: _records, rows: _rows, ...rest } = options || {};
  return { rows: Array.isArray(records) ? records : [], ...rest };
}

export const mlClient = {
  health: () => request('/health', null, { method: 'GET', timeoutMs: 5_000 }),
  profile: (records, options = {}) => request('/profile', rowsPayload(records, options)),
  correlations: (records, options = {}) => request('/correlations', rowsPayload(records, options)),
  anomalies: (records, options = {}) => request('/anomalies', rowsPayload(records, options)),
  featureImportance: (records, target, options = {}) =>
    request('/feature-importance', rowsPayload(records, { target, ...options }), { timeoutMs: 120_000 }),
  trainModel: (records, target, options = {}) =>
    request('/train-model', rowsPayload(records, { target, ...options }), { timeoutMs: 120_000 }),
  async predict(records, target, predictRecords, options = {}) {
    const trained = await mlClient.trainModel(records, target, options);
    const modelId = trained.modelId || trained.model_id;
    if (!modelId) {
      throw new MlServiceError('ML service did not return a modelId for prediction');
    }
    return request('/predict', { modelId, rows: predictRecords }, { timeoutMs: 120_000 });
  },
  compareDatasets: (leftRecords, rightRecords, options = {}) =>
    request('/compare-datasets', {
      left: { rows: Array.isArray(leftRecords) ? leftRecords : [] },
      right: { rows: Array.isArray(rightRecords) ? rightRecords : [] },
      ...options,
    }),
  cluster: (records, options = {}) =>
    request('/clustering', rowsPayload(records, { nClusters: options.n_clusters || options.nClusters || 3, ...options })),
  ragTrainingRecords: (records, options = {}) =>
    request('/rag-training-records', rowsPayload(records, options), { timeoutMs: 120_000 }),
};
