import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, thresholds, rampUpStages } from './options.js';

const uploadTrend = new Trend('upload_time');
const uploadThroughput = new Rate('upload_throughput_bytes');
const uploadErrorRate = new Rate('upload_errors');

const VUS = parseInt(__ENV.VU) || 50;

export let options = {
  stages: rampUpStages(VUS, '1m', '2m', '1m'),
  thresholds: {
    ...thresholds,
    upload_time: ['p(95)<3000', 'p(99)<5000'],
    upload_errors: ['rate<0.02'],
  },
};

function generateCSV(rows) {
  const header = 'id,name,value,category,date\n';
  const data = Array.from({ length: rows }, (_, i) =>
    `${i + 1},Record_${i + 1},${Math.random() * 1000},${['A', 'B', 'C'][i % 3]},2024-01-${String((i % 28) + 1).padStart(2, '0')}`
  ).join('\n');
  return header + data;
}

function generateExcelLikeJSON(rows) {
  const data = Array.from({ length: rows }, (_, i) => ({
    id: i + 1,
    name: `Record_${i + 1}`,
    value: Math.random() * 1000,
    category: ['A', 'B', 'C'][i % 3],
  }));
  return JSON.stringify({
    name: `upload_${__VU}_${Date.now()}`,
    fileName: `test_data_${__VU}.csv`,
    sourceType: 'import',
    rows: data,
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'value', type: 'number' },
      { name: 'category', type: 'string' },
    ],
  });
}

export default function () {
  group('CSV File Upload', function () {
    const csvContent = generateCSV(50);
    const payload = http.file(csvContent, 'test-data.csv', 'text/csv');

    const res = http.post(`${BASE_URL}/api/datasets/import/csv`, payload, {
      tags: { endpoint: 'csv-upload' },
    });

    uploadTrend.add(res.timings.duration);
    uploadThroughput.add(res.body ? res.body.length : csvContent.length);
    uploadErrorRate.add(res.status >= 400);

    check(res, {
      'csv upload status < 500': (r) => r.status < 500,
      'csv upload under 3s': (r) => r.timings.duration < 3000,
    });

    sleep(0.5);
  });

  group('JSON Dataset Import', function () {
    const jsonPayload = generateExcelLikeJSON(50);

    const res = http.post(`${BASE_URL}/api/datasets/import`, jsonPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'json-import' },
    });

    uploadTrend.add(res.timings.duration);
    uploadErrorRate.add(res.status >= 400);

    check(res, {
      'json import status 201': (r) => r.status === 201 || r.status === 200,
      'json import under 3s': (r) => r.timings.duration < 3000,
    });

    sleep(0.3);
  });

  group('PDF Upload Simulation', function () {
    const pdfPayload = JSON.stringify({
      url: `${BASE_URL}/api/pdf/ingest`,
      body: JSON.stringify({
        fileName: `test_${__VU}.pdf`,
        content: 'Sample PDF content for load testing',
        metadata: { source: 'k6-load-test' },
      }),
    });

    const res = http.post(`${BASE_URL}/api/pdf/ingest`, pdfPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'pdf-upload' },
    });

    uploadErrorRate.add(res.status >= 400);

    check(res, {
      'pdf ingest ok': (r) => r.status < 500,
    });

    sleep(0.3);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/k6-file-upload.json': JSON.stringify({
      summary: {
        upload_time: {
          avg: data.metrics.upload_time?.values?.avg || 0,
          p95: data.metrics.upload_time?.values?.['p(95)'] || 0,
          p99: data.metrics.upload_time?.values?.['p(99)'] || 0,
        },
        throughput: data.metrics.upload_throughput_bytes?.values?.rate || 0,
        error_rate: data.metrics.upload_errors?.values?.rate || 0,
        passed: (data.metrics.upload_errors?.values?.rate || 1) < 0.02,
      },
    }),
  };
}
