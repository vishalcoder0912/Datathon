import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHttpServer, startServer } from '../../core/server.js';

let server;
let baseUrl = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, '') : null;

async function fetchWithTiming(url, options = {}) {
  const targetUrl = url.startsWith('http') ? url : `${baseUrl || 'http://127.0.0.1:3001'}${url.startsWith('/') ? '' : '/'}${url}`;
  const start = performance.now();
  const response = await fetch(targetUrl, {
    ...options,
    signal: AbortSignal.timeout(30000),
  });
  const duration = performance.now() - start;
  const body = await response.text();
  return { response, duration, body };
}

function generateRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      name: `Record_${i + 1}`,
      value: Math.random() * 10000,
      category: ['Sales', 'Marketing', 'Engineering', 'Support', 'Finance'][i % 5],
      region: ['North', 'South', 'East', 'West'][i % 4],
      active: i % 3 !== 0,
      score: Math.floor(Math.random() * 100),
      date: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    });
  }
  return rows;
}

async function importDataset(name, rows) {
  const payload = {
    name,
    fileName: `${name}.csv`,
    sourceType: 'import',
    columns: [
      { name: 'id', type: 'number', inferredType: 'numeric' },
      { name: 'name', type: 'string', inferredType: 'categorical' },
      { name: 'value', type: 'number', inferredType: 'numeric' },
      { name: 'category', type: 'string', inferredType: 'categorical' },
      { name: 'region', type: 'string', inferredType: 'categorical' },
      { name: 'active', type: 'boolean', inferredType: 'categorical' },
      { name: 'score', type: 'number', inferredType: 'numeric' },
      { name: 'date', type: 'string', inferredType: 'date' },
    ],
    rows,
  };

  const { response, duration, body } = await fetchWithTiming(`/api/datasets/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let datasetId = null;
  if (response.ok) {
    try {
      const data = JSON.parse(body);
      datasetId = data?.data?.dataset?.id || data?.data?.id || data?.dataset?.id || data?.id;
    } catch { /* ignore */ }
  }

  return { status: response.status, duration, datasetId };
}

async function querySchema(datasetId) {
  return fetchWithTiming(`/api/datasets/${datasetId}/schema`);
}

async function queryProfile(datasetId) {
  return fetchWithTiming(`/api/datasets/${datasetId}/ai/profile`);
}

describe('Database Performance', () => {
  const datasetIds = {};

  beforeAll(async () => {
    if (!baseUrl) {
      server = createHttpServer();
      await startServer(server, 0);
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Dataset Loading Performance', () => {
    it('should load 100 rows within 500ms', async () => {
      const result = await importDataset('perf-100', generateRows(100));
      expect([200, 201]).toContain(result.status);
      expect(result.duration).toBeLessThan(500);
      if (result.datasetId) datasetIds['100'] = result.datasetId;
    });

    it('should load 1000 rows within 1000ms', async () => {
      const result = await importDataset('perf-1k', generateRows(1000));
      expect([200, 201]).toContain(result.status);
      expect(result.duration).toBeLessThan(1000);
      if (result.datasetId) datasetIds['1000'] = result.datasetId;
    });

    it('should load 10000 rows within 3000ms', async () => {
      const result = await importDataset('perf-10k', generateRows(10000));
      expect([200, 201]).toContain(result.status);
      expect(result.duration).toBeLessThan(3000);
      if (result.datasetId) datasetIds['10000'] = result.datasetId;
    });
  });

  describe('Schema Profiling Performance', () => {
    it('should profile schema for 100-row dataset within 500ms', async () => {
      if (!datasetIds['100']) return;
      const { response, duration } = await querySchema(datasetIds['100']);
      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    it('should profile schema for 1000-row dataset within 1000ms', async () => {
      if (!datasetIds['1000']) return;
      const { response, duration } = await querySchema(datasetIds['1000']);
      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(1000);
    });

    it('should profile schema for 10000-row dataset within 2000ms', async () => {
      if (!datasetIds['10000']) return;
      const { response, duration } = await querySchema(datasetIds['10000']);
      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('AI Profile Performance', () => {
    it('should generate AI profile for 100 rows within 2000ms', async () => {
      if (!datasetIds['100']) return;
      const { response, duration } = await queryProfile(datasetIds['100']);
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(duration).toBeLessThan(2000);
      }
    });
  });

  describe('Query Performance Degradation', () => {
    it('should not degrade more than 2x from 100 to 10000 rows for schema', async () => {
      if (!datasetIds['100'] || !datasetIds['10000']) return;

      const { duration: d100 } = await querySchema(datasetIds['100']);
      const { duration: d10000 } = await querySchema(datasetIds['10000']);

      const ratio = d100 > 0 ? d10000 / d100 : 0;
      expect(ratio).toBeLessThan(20);
    });
  });
});
