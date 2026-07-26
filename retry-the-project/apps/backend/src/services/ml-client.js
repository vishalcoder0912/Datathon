import crypto from 'node:crypto';
import axios from 'axios';
import { serviceUrls } from "../config/serviceUrls.js";

const ML_SERVICE_URL = serviceUrls.ml;
const DEFAULT_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 10000);
const MAX_ROWS_SENT_TO_ML = Number(process.env.ML_SERVICE_MAX_ROWS || 50000);

const analyticsCache = new Map();

function normalizeColumns(columns = [], rows = []) {
  if (columns.length) {
    return columns.map((column) => (typeof column === 'string' ? column : column.name)).filter(Boolean);
  }
  return rows[0] ? Object.keys(rows[0]).filter((key) => !key.startsWith('__')) : [];
}

export function sampleRows(rows = [], limit = MAX_ROWS_SENT_TO_ML) {
  const cleanRows = (rows || []).map(row => {
    if (!row || typeof row !== 'object') return row;
    return Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('__')));
  });
  if (cleanRows.length <= limit) return cleanRows;
  const step = cleanRows.length / limit;
  return Array.from({ length: limit }, (_, index) => cleanRows[Math.floor(index * step)]);
}

export function fingerprintDataset(datasetOrPayload = {}) {
  const rows = datasetOrPayload.rows || [];
  const columns = normalizeColumns(datasetOrPayload.columns || [], rows);
  const sampleRowsForHash = rows.slice(0, 100).map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column]])),
  );
  const schema = {};
  for (const column of columns) {
    const firstValue = rows.find((row) => row[column] !== null && row[column] !== undefined && row[column] !== '')?.[column];
    schema[column] = typeof firstValue;
  }
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      columns,
      rowCount: rows.length,
      schema,
      sampleHash: crypto.createHash('sha256').update(JSON.stringify(sampleRowsForHash)).digest('hex'),
    }))
    .digest('hex');
}

function makePayload(datasetOrPayload = {}, extra = {}) {
  const rows = datasetOrPayload.rows || [];
  const columns = datasetOrPayload.columns || normalizeColumns([], rows);
  return {
    datasetId: datasetOrPayload.id || datasetOrPayload.datasetId,
    rows: sampleRows(rows),
    columns,
    ...extra,
  };
}

async function post(endpoint, payload, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const response = await axios.post(`${ML_SERVICE_URL}${endpoint}`, payload, { timeout });
  return response.data;
}

async function cached(endpoint, datasetOrPayload, extra = {}, fallback = null) {
  const fingerprint = fingerprintDataset(datasetOrPayload);
  const cacheKey = `${endpoint}:${fingerprint}:${JSON.stringify(extra)}`;
  if (analyticsCache.has(cacheKey)) {
    return { ...analyticsCache.get(cacheKey), cacheHit: true, source: 'node-cache' };
  }

  try {
    const result = await post(endpoint, makePayload(datasetOrPayload, extra));
    const wrapped = { success: true, source: 'python', ...result };
    analyticsCache.set(cacheKey, wrapped);
    return wrapped;
  } catch (error) {
    if (fallback) {
      const fallbackResult = await fallback(error);
      const wrapped = {
        success: true,
        source: 'javascript-fallback',
        fallbackReason: error.message,
        ...fallbackResult,
      };
      analyticsCache.set(cacheKey, wrapped);
      return wrapped;
    }
    return {
      success: false,
      source: 'python',
      error: error.message,
      status: error.response?.status || 'UNAVAILABLE',
    };
  }
}

export function clearAnalyticsCache() {
  analyticsCache.clear();
}

export function analyticsCacheSize() {
  return analyticsCache.size;
}

class MLClient {
  static async health() {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, status: 'unavailable', error: error.message };
    }
  }

  static profile(dataset, fallback) {
    return cached('/profile', dataset, {}, fallback);
  }

  static correlations(dataset, fallback, method = 'pearson') {
    return cached('/correlations', dataset, { method }, fallback);
  }

  static anomalies(dataset, fallback, method = undefined) {
    return cached('/anomalies', dataset, { method }, fallback);
  }

  static featureImportance(dataset, target, fallback) {
    return cached('/feature-importance', dataset, { target }, fallback);
  }

  static clustering(dataset, nClusters = 3, fallback) {
    return cached('/clustering', dataset, { nClusters }, fallback);
  }

  static async trainModel(dataset, target, options = {}) {
    return post('/train-model', makePayload(dataset, { target, ...options }), { timeout: 120000 });
  }

  static async predict(modelId, rows) {
    return post('/predict', { modelId, rows: sampleRows(rows, 10000) });
  }

  static async compareDatasets(left, right) {
    return post('/compare-datasets', {
      left: makePayload(left),
      right: makePayload(right),
    });
  }

  // Backward-compatible aliases used by older routes.
  static async getFeatureImportance(datasetIdOrDataset, targetOrFallback) {
    if (typeof datasetIdOrDataset === 'string') {
      return { success: false, error: 'Use featureImportance(dataset, target) for deterministic analytics.' };
    }
    return MLClient.featureImportance(datasetIdOrDataset, targetOrFallback);
  }

  static async listModels() {
    return { success: true, models: [] };
  }

  static async deleteModel() {
    return { success: true };
  }
}

export default MLClient;
