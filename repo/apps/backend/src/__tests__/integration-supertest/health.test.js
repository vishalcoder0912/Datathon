import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createHttpServer, startServer } from '../../core/server.js';

let request;
let server;

beforeAll(async () => {
  server = createHttpServer();
  await startServer(server, 0);
  const address = server.address();
  const port = address.port;
  const host = address.address.includes(':') ? `[${address.address}]` : address.address;
  request = supertest(`http://${host}:${port}`);
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('Health Integration', () => {
  it('GET /api/health returns 200 with status healthy', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
  });

  it('GET /api/health/detailed returns detailed system info', async () => {
    const res = await request.get('/api/health/detailed');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('system');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('cpu');
    expect(res.body.system).toHaveProperty('nodeVersion');
    expect(res.body.system).toHaveProperty('platform');
  });

  it('GET /api/health/ping returns pong', async () => {
    const res = await request.get('/api/health/ping');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pong).toBe(true);
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET /api/health/ready returns readiness probe', async () => {
    const res = await request.get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('checks');
  });

  it('GET /api/health/live returns liveness probe', async () => {
    const res = await request.get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.live).toBe(true);
  });
});
