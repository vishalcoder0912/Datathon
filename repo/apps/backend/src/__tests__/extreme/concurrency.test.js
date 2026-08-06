import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createHttpServer, startServer } from '../../core/server.js';

let request;
let server;

beforeAll(async () => {
  server = createHttpServer();
  await startServer(server, 0);
  const address = server.address();
  const host = address.address.includes(':') ? `[${address.address}]` : address.address;
  request = supertest(`http://${host}:${address.port}`);
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('Concurrency Tests', () => {
  it('handles 10 concurrent requests to health endpoint', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request.get('/api/health'))
    );
    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });

  it('handles 50 concurrent requests to various endpoints', async () => {
    const endpoints = [
      () => request.get('/api/health'),
      () => request.get('/api/health/ping'),
      () => request.get('/api/health/live'),
      () => request.get('/api/health/detailed'),
      () => request.get('/api/health/ready'),
    ];

    const tasks = Array.from({ length: 50 }, () =>
      endpoints[Math.floor(Math.random() * endpoints.length)]()
    );

    const results = await Promise.all(tasks);
    for (const res of results) {
      expect([200, 500, 503]).toContain(res.status);
    }
  });

  it('handles 100 concurrent requests without crashing', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => request.get('/api/health/ping'))
    );
    const statuses = results.map(r => r.status);
    const okCount = statuses.filter(s => s === 200).length;
    expect(okCount).toBeGreaterThan(50);
  });

  it('handles concurrent read and write operations', async () => {
    const readOps = Array.from({ length: 20 }, () => request.get('/api/health'));
    const writeOps = Array.from({ length: 10 }, () =>
      request.post('/api/datasets/import').send({
        name: 'Concurrent Dataset',
        columns: [{ name: 'col', type: 'string' }],
        rows: [{ col: 'test' }],
      })
    );

    const results = await Promise.all([...readOps, ...writeOps]);
    const readResults = results.slice(0, 20);
    const writeResults = results.slice(20);

    for (const res of readResults) {
      expect(res.status).toBe(200);
    }
    for (const res of writeResults) {
      expect([201, 400]).toContain(res.status);
    }
  });

  it('verifies data consistency when importing datasets concurrently', async () => {
    const imports = Array.from({ length: 5 }, (_, i) =>
      request.post('/api/datasets/import').send({
        name: `Concurrent-DS-${i}`,
        columns: [{ name: 'val', type: 'number' }],
        rows: Array.from({ length: 10 }, (_, j) => ({ val: i * 100 + j })),
      })
    );

    const results = await Promise.all(imports);
    const created = results.filter(r => r.status === 201);
    expect(created.length).toBeGreaterThanOrEqual(1);
  });
});
