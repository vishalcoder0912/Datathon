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

describe('Rate Limit Behavior', () => {
  it('handles 10 rapid requests to health endpoint successfully', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request.get('/api/health'))
    );
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    }
  });

  it('handles 30 rapid requests without crashing', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, () => request.get('/api/health/ping'))
    );
    const statuses = results.map(r => r.status);
    const okCount = statuses.filter(s => s === 200).length;
    expect(okCount).toBeGreaterThan(0);
  });

  it('handles burst of requests followed by quiet period', async () => {
    const burst = await Promise.all(
      Array.from({ length: 20 }, (_, i) => request.get('/api/health/ping'))
    );
    expect(burst.some(r => r.status === 200)).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 100));

    const quiet = await request.get('/api/health');
    expect(quiet.status).toBe(200);
  });

  it('different endpoints can be hit together', async () => {
    const results = await Promise.all([
      request.get('/api/health'),
      request.get('/api/health/detailed'),
      request.get('/api/health/ping'),
      request.get('/api/health/ready'),
      request.get('/api/health/live'),
    ]);
    const statuses = results.map(r => r.status);
    expect(statuses.every(s => s === 200)).toBe(true);
  });

  it('POST endpoints handle rapid requests gracefully', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request.post('/api/ai/test').send({ prompt: 'test' })
      )
    );
    for (const res of results) {
      expect([200, 400, 503]).toContain(res.status);
    }
  });
});
