import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createHttpServer, startServer } from '../../core/server.js';

let request;
let server;

beforeAll(async () => {
  server = createHttpServer();
  await startServer(server, 0);
  const address = server.address();
  request = supertest(`http://127.0.0.1:${address.port}`);
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('Error Handling Integration', () => {
  it('returns 404 JSON for unknown GET routes', async () => {
    const res = await request.get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for unknown POST route', async () => {
    const res = await request.post('/api/unknown/route');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown DELETE route', async () => {
    const res = await request.delete('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for /api/ai/test with missing prompt', async () => {
    const res = await request.post('/api/ai/test').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for /api/ai/test with non-string prompt', async () => {
    const res = await request.post('/api/ai/test').send({ prompt: 123 });
    expect(res.status).toBe(400);
  });

  it('returns 401 for protected routes without auth', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for /api/auth/me with invalid Bearer token', async () => {
    const res = await request.get('/api/auth/me').set('Authorization', 'Bearer invalid_token_here');
    expect(res.status).toBe(401);
  });

  it('returns 404 for /api/datasets/:id with non-existent ID', async () => {
    const res = await request.get('/api/datasets/non-existent-id-12345');
    expect(res.status).toBe(404);
  });

  it('returns 404 for DELETE on non-existent dataset', async () => {
    const res = await request.delete('/api/datasets/non-existent-id');
    expect(res.status).toBe(404);
  });

  it('returns 404 for /api/datasets/:id/chat with non-existent dataset', async () => {
    const res = await request.post('/api/datasets/non-existent-id/chat').send({ query: 'test' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for /api/datasets/import with empty body', async () => {
    const res = await request.post('/api/datasets/import').send('');
    expect([400, 404]).toContain(res.status);
  });

  it('returns no stack trace in 404 error responses', async () => {
    const res = await request.get('/api/nonexistent');
    expect(res.status).toBe(404);
    if (res.body.error && typeof res.body.error === 'object') {
      expect(res.body.error).not.toHaveProperty('stack');
    }
  });

  it('returns 404 for wrong method on existing route', async () => {
    const res = await request.post('/api/health');
    expect(res.status).toBe(404);
  });
});
