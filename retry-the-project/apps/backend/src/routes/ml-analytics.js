import { mlClient, MlServiceError } from '../services/ml/ml-client.js';
import { analyticsCache } from '../services/ml/analytics-cache.js';
import { createCacheKey, createDatasetFingerprint } from '../services/ml/dataset-fingerprint.js';
import { fallbackCorrelations, fallbackProfile } from '../services/ml/js-fallback-analytics.js';
import { getDatasetMetadataById, getDatasetRowsById } from '../services/ml/dataset-adapter.js';

const MAX_BODY_BYTES = Number(process.env.MAX_JSON_BODY_BYTES || 20 * 1024 * 1024);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function rowsFromDatasetOrBody(datasetId, body = {}) {
  if (Array.isArray(body.records)) return body.records;
  if (Array.isArray(body.rows)) return body.rows;

  if (!datasetId) {
    const error = new Error('records, rows, or datasetId is required');
    error.statusCode = 400;
    throw error;
  }

  return getDatasetRowsById(datasetId);
}

async function withCache({ datasetId, records, metadata, operation, params, compute }) {
  const fingerprint = createDatasetFingerprint(records, metadata);
  const cacheKey = createCacheKey(datasetId || 'direct-records', operation, fingerprint, params);
  const cached = analyticsCache.get(cacheKey);

  if (cached) {
    return { ...cached, cache: { hit: true, fingerprint } };
  }

  const value = await compute();
  const wrapped = { ...value, cache: { hit: false, fingerprint } };
  analyticsCache.set(cacheKey, wrapped);
  return wrapped;
}

async function handleOperation({ request, response, datasetId, operation }) {
  const body = await readJsonBody(request);
  const records = await rowsFromDatasetOrBody(datasetId, body);
  const metadata = datasetId ? await getDatasetMetadataById(datasetId) : body.metadata || {};
  const { records: _records, rows: _rows, metadata: _metadata, ...params } = body;

  try {
    const result = await withCache({
      datasetId,
      records,
      metadata,
      operation,
      params,
      compute: async () => {
        switch (operation) {
          case 'profile':
            return mlClient.profile(records, params);
          case 'correlations':
            return mlClient.correlations(records, params);
          case 'anomalies':
            return mlClient.anomalies(records, params);
          case 'feature-importance':
            if (!body.target) {
              const error = new Error('target is required');
              error.statusCode = 400;
              throw error;
            }
            return mlClient.featureImportance(records, body.target, params);
          case 'train-model':
            if (!body.target) {
              const error = new Error('target is required');
              error.statusCode = 400;
              throw error;
            }
            return mlClient.trainModel(records, body.target, params);
          case 'cluster':
            return mlClient.cluster(records, params);
          case 'rag-training-records':
            return mlClient.ragTrainingRecords(records, params);
          default: {
            const error = new Error(`Unknown ML operation: ${operation}`);
            error.statusCode = 404;
            throw error;
          }
        }
      },
    });

    sendJson(response, 200, { ok: true, operation, result });
  } catch (error) {
    if (error instanceof MlServiceError && operation === 'profile') {
      sendJson(response, 200, {
        ok: true,
        operation,
        result: fallbackProfile(records),
        warning: error.message,
      });
      return;
    }

    if (error instanceof MlServiceError && operation === 'correlations') {
      sendJson(response, 200, {
        ok: true,
        operation,
        result: fallbackCorrelations(records),
        warning: error.message,
      });
      return;
    }

    throw error;
  }
}

async function handleCompareDatasets(request, response) {
  const body = await readJsonBody(request);
  let leftRecords = body.left_records || body.leftRecords || body.left?.rows;
  let rightRecords = body.right_records || body.rightRecords || body.right?.rows;

  if (!leftRecords && body.leftDatasetId) leftRecords = await getDatasetRowsById(body.leftDatasetId);
  if (!rightRecords && body.rightDatasetId) rightRecords = await getDatasetRowsById(body.rightDatasetId);

  if (!Array.isArray(leftRecords) || !Array.isArray(rightRecords)) {
    const error = new Error('Provide left/right records or leftDatasetId/rightDatasetId');
    error.statusCode = 400;
    throw error;
  }

  const result = await mlClient.compareDatasets(leftRecords, rightRecords, {
    leftName: body.leftName || body.leftDatasetId || 'left',
    rightName: body.rightName || body.rightDatasetId || 'right',
  });

  sendJson(response, 200, { ok: true, operation: 'compare-datasets', result });
}

async function handlePredict(request, response, datasetId) {
  const body = await readJsonBody(request);
  const records = await rowsFromDatasetOrBody(datasetId, body);

  if (!body.target) {
    const error = new Error('target is required');
    error.statusCode = 400;
    throw error;
  }

  const predictRecords = body.predictRecords || body.predict_records;
  if (!Array.isArray(predictRecords)) {
    const error = new Error('predictRecords is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await mlClient.predict(records, body.target, predictRecords, body);
  sendJson(response, 200, { ok: true, operation: 'predict', result });
}

export async function handleMlAnalyticsRoutes(request, response, pathname) {
  try {
    if (request.method === 'GET' && pathname === '/api/ml/health') {
      try {
        const result = await mlClient.health();
        sendJson(response, 200, { ok: true, success: true, status: 'ready', result });
      } catch (error) {
        sendJson(response, 200, { ok: true, success: true, status: 'unavailable', error: error.message });
      }
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/ml/compare-datasets') {
      await handleCompareDatasets(request, response);
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/ml/predict') {
      await handlePredict(request, response, null);
      return true;
    }

    const directMatch = pathname.match(/^\/api\/ml\/(profile|correlations|anomalies|feature-importance|train-model|cluster|rag-training-records)$/);
    if (request.method === 'POST' && directMatch) {
      await handleOperation({ request, response, datasetId: null, operation: directMatch[1] });
      return true;
    }

    const datasetMatch = pathname.match(
      /^\/api\/ml\/datasets\/([^/]+)\/(profile|correlations|anomalies|feature-importance|train-model|cluster|rag-training-records|predict)$/,
    );
    if (request.method === 'POST' && datasetMatch) {
      const [, datasetId, operation] = datasetMatch;

      if (operation === 'predict') {
        await handlePredict(request, response, decodeURIComponent(datasetId));
      } else {
        await handleOperation({
          request,
          response,
          datasetId: decodeURIComponent(datasetId),
          operation,
        });
      }

      return true;
    }

    return false;
  } catch (error) {
    sendJson(response, error.statusCode || error.status || 500, {
      ok: false,
      error: error.message || 'ML analytics route failed',
    });
    return true;
  }
}
