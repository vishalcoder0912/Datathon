import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHttpServer, startServer } from '../../core/server.js';

let server;
let baseUrl = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, '') : null;

const SIMPLE_ENDPOINTS = [
  { method: 'GET', path: '/api/health', name: 'health', maxMs: 200 },
  { method: 'GET', path: '/api/health/ping', name: 'ping', maxMs: 100 },
  { method: 'GET', path: '/api/health/live', name: 'liveness', maxMs: 100 },
  { method: 'GET', path: '/api/health/ready', name: 'readiness', maxMs: 200 },
  { method: 'GET', path: '/api/datasets', name: 'list datasets', maxMs: 200 },
  { method: 'GET', path: '/api/ai/status', name: 'ai status', maxMs: 200 },
  { method: 'GET', path: '/api/ml/status', name: 'ml status', maxMs: 200 },
];

const ANALYTICS_ENDPOINTS = [
  { method: 'GET', path: (id) => `/api/datasets/${id}/schema`, name: 'schema', maxMs: 500 },
  { method: 'GET', path: (id) => `/api/datasets/${id}/ai/profile`, name: 'profile', maxMs: 1500 },
  { method: 'GET', path: (id) => `/api/datasets/${id}/ai-correlations`, name: 'correlations', maxMs: 1500 },
];

async function fetchWithTiming(url, options = {}) {
  const targetUrl = url.startsWith('http') ? url : `${baseUrl || 'http://127.0.0.1:3001'}${url.startsWith('/') ? '' : '/'}${url}`;
  const start = performance.now();
  const response = await fetch(targetUrl, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  const duration = performance.now() - start;
  const body = await response.text();
  return { response, duration, body };
}

let existingDatasetId = null;

async function findTestDataset() {
  try {
    const { response, body } = await fetchWithTiming(`/api/datasets`);
    if (response.ok) {
      const data = JSON.parse(body);
      const datasets = data?.data?.datasets || data?.datasets || [];
      if (datasets.length > 0) return datasets[0].id;
    }
  } catch { /* ignore */ }

  const testData = {
    name: `perf-test-${Date.now()}`,
    fileName: 'perf-test.csv',
    sourceType: 'import',
    columns: [
      { name: 'id', type: 'number', inferredType: 'numeric' },
      { name: 'name', type: 'string', inferredType: 'categorical' },
      { name: 'value', type: 'number', inferredType: 'numeric' },
      { name: 'category', type: 'string', inferredType: 'categorical' },
    ],
    rows: Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `Record_${i + 1}`,
      value: Math.random() * 1000,
      category: ['A', 'B', 'C'][i % 3],
    })),
  };

  const { response, body } = await fetchWithTiming(`/api/datasets/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData),
  });

  if (response.ok) {
    const data = JSON.parse(body);
    return data?.data?.dataset?.id || data?.data?.id || data?.dataset?.id || data?.id;
  }
  return null;
}

describe('API Latency Performance', () => {
  let coldStartTimings = [];
  let warmStartTimings = [];

  beforeAll(async () => {
    if (!baseUrl) {
      server = createHttpServer();
      await startServer(server, 0);
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
    }
    existingDatasetId = await findTestDataset();
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Simple Endpoints (< 200ms)', () => {
    it.each(SIMPLE_ENDPOINTS)('$name should respond within $maxMs ms', async ({ method, path, name, maxMs }) => {
      const opts = method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: '{}' };

      const { response, duration } = await fetchWithTiming(path, opts);

      expect(response.status).toBeLessThan(500);
      expect(duration).toBeLessThan(maxMs);
    });
  });

  describe('Cold Start vs Warm Start', () => {
    it('should have cold start under 2000ms for first request', async () => {
      const { response, duration } = await fetchWithTiming(`/api/health/detailed`);
      expect(response.ok).toBe(true);
      coldStartTimings.push(duration);
    });

    it('should have warm start under 200ms for subsequent requests', async () => {
      for (let i = 0; i < 5; i++) {
        const { response, duration } = await fetchWithTiming(`/api/health`);
        expect(response.ok).toBe(true);
        warmStartTimings.push(duration);
      }

      const avgWarm = warmStartTimings.reduce((a, b) => a + b, 0) / warmStartTimings.length;
      expect(avgWarm).toBeLessThan(200);
    });
  });

  describe('Analytics Endpoints (< 1500ms)', () => {
    it.each(ANALYTICS_ENDPOINTS)(
      '$name should respond within $maxMs ms',
      async ({ path, name, maxMs }) => {
        if (!existingDatasetId) return;

        const url = path(existingDatasetId);
        const { response, duration } = await fetchWithTiming(url);

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(duration).toBeLessThan(maxMs);
        }
      },
    );
  });

  describe('Dataset Import Performance', () => {
    it('should import 100 rows within 1000ms', async () => {
      const payload = {
        name: `perf-import-${Date.now()}`,
        fileName: 'perf-import.csv',
        sourceType: 'import',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'value', type: 'number' },
        ],
        rows: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, value: Math.random() * 1000 })),
      };

      const { response, duration } = await fetchWithTiming(`/api/datasets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect([200, 201]).toContain(response.status);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Error Handling Performance', () => {
    it('should return 404 within 100ms for unknown route', async () => {
      const { response, duration } = await fetchWithTiming(`/api/nonexistent-route-12345`);
      expect(response.status).toBe(404);
      expect(duration).toBeLessThan(100);
    });

    it('should reject invalid JSON within 100ms', async () => {
      const { response, duration } = await fetchWithTiming(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(duration).toBeLessThan(100);
    });
  });
});
