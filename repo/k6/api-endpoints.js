import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, thresholds, rampUpStages } from './options.js';

const datasetTrend = new Trend('dataset_response_time');
const schemaTrend = new Trend('schema_response_time');
const analyticsTrend = new Trend('analytics_response_time');
const chatTrend = new Trend('chat_response_time');
const mlTrend = new Trend('ml_response_time');
const apiErrorRate = new Rate('api_errors');

const VUS = parseInt(__ENV.VU) || 50;

export let options = {
  stages: rampUpStages(VUS, '2m', '4m', '2m'),
  thresholds: {
    ...thresholds,
    dataset_response_time: ['p(95)<500', 'p(99)<1000'],
    schema_response_time: ['p(95)<500', 'p(99)<1000'],
    anaalsis_response_time: ['p(95)<1000', 'p(99)<2000'],
    chat_response_time: ['p(95)<2000', 'p(99)<5000'],
    ml_response_time: ['p(95)<3000', 'p(99)<5000'],
    api_errors: ['rate<0.01'],
  },
};

const testDataset = {
  name: `k6-load-test-${__VU}`,
  fileName: 'k6-test-data.csv',
  sourceType: 'import',
  columns: [
    { name: 'id', type: 'number', inferredType: 'numeric' },
    { name: 'name', type: 'string', inferredType: 'categorical' },
    { name: 'value', type: 'number', inferredType: 'numeric' },
    { name: 'category', type: 'string', inferredType: 'categorical' },
    { name: 'date', type: 'string', inferredType: 'date' },
  ],
  rows: Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `Record_${i + 1}`,
    value: Math.random() * 1000,
    category: ['A', 'B', 'C'][i % 3],
    date: '2024-01-01',
  })),
};

let importedDatasetId = null;

export default function () {
  group('Dataset Import', function () {
    const payload = JSON.stringify({
      ...testDataset,
      name: `${testDataset.name}_${__VU}`,
    });

    const res = http.post(`${BASE_URL}/api/datasets/import`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'dataset-import' },
    });

    datasetTrend.add(res.timings.duration);
    apiErrorRate.add(res.status >= 400);

    check(res, {
      'import status 201': (r) => r.status === 201,
      'import response time < 500ms': (r) => r.timings.duration < 500,
    });

    try {
      const body = JSON.parse(res.body);
      importedDatasetId = body.data?.dataset?.id || body.data?.id || body.dataset?.id || body.id;
    } catch { /* skip */ }

    sleep(0.5);
  });

  if (importedDatasetId) {
    group('Schema Retrieval', function () {
      const res = http.get(`${BASE_URL}/api/datasets/${importedDatasetId}/schema`, {
        tags: { endpoint: 'schema' },
      });

      schemaTrend.add(res.timings.duration);
      apiErrorRate.add(res.status >= 400);

      check(res, {
        'schema status 200': (r) => r.status === 200,
        'schema fast < 500ms': (r) => r.timings.duration < 500,
      });

      sleep(0.3);
    });

    group('Analytics Endpoints', function () {
      const anaEndpoints = [
        `${BASE_URL}/api/datasets/${importedDatasetId}/ai/profile`,
        `${BASE_URL}/api/datasets/${importedDatasetId}/ai-correlations`,
        `${BASE_URL}/api/datasets/${importedDatasetId}/ai/anomalies`,
        `${BASE_URL}/api/datasets/${importedDatasetId}/ai/relationships`,
      ];

      for (const url of anaEndpoints) {
        const res = http.get(url, { tags: { endpoint: 'analytics' } });
        analyticsTrend.add(res.timings.duration);
        apiErrorRate.add(res.status >= 400);

        check(res, {
          [`analytics ${url.split('/').pop()} ok`]: (r) => r.status === 200 || r.status === 404,
        });

        sleep(0.2);
      }
    });

    group('Chat Endpoints', function () {
      const chatPayload = JSON.stringify({
        datasetId: importedDatasetId,
        message: 'Show me the salary distribution by category',
        mode: 'analysis',
      });

      const res = http.post(`${BASE_URL}/api/chat/analytics`, chatPayload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'chat' },
      });

      chatTrend.add(res.timings.duration);
      apiErrorRate.add(res.status >= 400);

      check(res, {
        'chat response ok': (r) => r.status < 500,
      });

      sleep(0.5);
    });

    group('Dashboard AI', function () {
      const dashPayload = JSON.stringify({
        datasetId: importedDatasetId,
      });

      const res = http.post(`${BASE_URL}/api/dashboard-ai/generate`, dashPayload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'dashboard-ai' },
      });

      check(res, {
        'dashboard ai ok': (r) => r.status < 500,
      });

      sleep(0.3);
    });

    group('ML Endpoints', function () {
      const mlRes = http.get(`${BASE_URL}/api/ml/status`, {
        tags: { endpoint: 'ml-status' },
      });

      mlTrend.add(mlRes.timings.duration);
      apiErrorRate.add(mlRes.status >= 400);

      check(mlRes, {
        'ml status ok': (r) => r.status < 500,
      });

      sleep(0.3);
    });
  }

  group('List Datasets', function () {
    const res = http.get(`${BASE_URL}/api/datasets`, {
      tags: { endpoint: 'list-datasets' },
    });

    check(res, {
      'list datasets ok': (r) => r.status === 200,
    });

    sleep(0.2);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/k6-api-endpoints.json': JSON.stringify({
      summary: {
        dataset: {
          avg: data.metrics.dataset_response_time?.values?.avg || 0,
          p95: data.metrics.dataset_response_time?.values?.['p(95)'] || 0,
        },
        schema: {
          avg: data.metrics.schema_response_time?.values?.avg || 0,
          p95: data.metrics.schema_response_time?.values?.['p(95)'] || 0,
        },
        anaalsis: {
          avg: data.metrics.analytics_response_time?.values?.avg || 0,
          p95: data.metrics.analytics_response_time?.values?.['p(95)'] || 0,
        },
        chat: {
          avg: data.metrics.chat_response_time?.values?.avg || 0,
          p95: data.metrics.chat_response_time?.values?.['p(95)'] || 0,
        },
        ml: {
          avg: data.metrics.ml_response_time?.values?.avg || 0,
          p95: data.metrics.ml_response_time?.values?.['p(95)'] || 0,
        },
        error_rate: data.metrics.api_errors?.values?.rate || 0,
        passed: (data.metrics.api_errors?.values?.rate || 1) < 0.01,
      },
    }),
  };
}
