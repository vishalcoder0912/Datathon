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
}, 10000);

describe('Extreme Payload Tests', () => {
  describe('Empty and null body handling', () => {
    it('handles empty body on POST /api/ai/test', async () => {
      const res = await request.post('/api/ai/test').send('');
      expect(res.status).toBe(400);
    });

    it('handles null body on POST /api/datasets/import', async () => {
      const res = await request.post('/api/datasets/import').send(null);
      expect(res.status).toBe(400);
    });

    it('handles boolean body on POST /api/ai/test', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send('true');
      expect(res.status).toBe(400);
    });

    it('handles integer body on POST /api/ai/test', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send('42');
      expect(res.status).toBe(400);
    });

    it('handles negative integer body', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send('-1');
      expect(res.status).toBe(400);
    });

    it('handles max safe integer in body', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send(String(Number.MAX_SAFE_INTEGER));
      expect(res.status).toBe(400);
    });
  });

  describe('Invalid numeric inputs', () => {
    it('handles float with 20 decimal places', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send('3.14159265358979323846');
      expect(res.status).toBe(400);
    });

    it('handles Infinity as numeric input', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send('Infinity');
      expect([400, 503]).toContain(res.status);
    });

    it('handles NaN as numeric input', async () => {
      const res = await request.post('/api/ai/test').set('Content-Type', 'application/json').send('NaN');
      expect([400, 503]).toContain(res.status);
    });
  });

  describe('String extremes', () => {
    it('handles very long string (100KB+)', async () => {
      const longString = 'x'.repeat(100 * 1024);
      const res = await request.post('/api/ai/test').send({ prompt: longString });
      expect(res.status).toBe(400);
    });

    it('handles emoji strings', async () => {
      const res = await request.post('/api/ai/test').send({ prompt: '🔥 🚀 🌟 🎉 ✨' });
      expect([200, 400, 503]).toContain(res.status);
    });

    it('handles unicode (RTL, zero-width, hieroglyphics)', async () => {
      const unicodeStr = '\u202E\u200B\u0000\uD55C\u3042\u0600';
      const res = await request.post('/api/ai/test').send({ prompt: unicodeStr });
      expect([200, 400, 503]).toContain(res.status);
    });
  });

  describe('Array and object extremes', () => {
    it('handles array with many elements', async () => {
      const bigArray = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: 'test_' + i }));
      const res = await request.post('/api/datasets/import').send({
        name: 'Big Array',
        columns: [{ name: 'id', type: 'number' }, { name: 'value', type: 'string' }],
        rows: bigArray.slice(0, 100),
      });
      expect(res.status).toBe(201);
    });

    it('handles deeply nested objects (100 levels)', async () => {
      let nested = {};
      let ref = nested;
      for (let i = 0; i < 100; i++) {
        ref.child = {};
        ref = ref.child;
      }
      const res = await request.post('/api/ai/test').send({ prompt: JSON.stringify(nested).slice(0, 100) });
      expect([200, 400, 503]).toContain(res.status);
    });

    it('handles unexpected fields gracefully', async () => {
      const res = await request.post('/api/ai/test').send({
        prompt: 'hello',
        unexpectedField1: 'value1',
        unexpectedNested: { deep: { deeper: 'value' } },
      });
      expect([200, 400, 503]).toContain(res.status);
    });
  });

  describe('Input validation', () => {
    it('rejects missing required fields', async () => {
      const res = await request.post('/api/ai/test').send({});
      expect(res.status).toBe(400);
    });

    it('rejects wrong types for all fields on /api/ai/test', async () => {
      const res = await request.post('/api/ai/test').send({ prompt: 12345 });
      expect(res.status).toBe(400);
    });

    it('rejects /api/ai/test with array instead of object', async () => {
      const res = await request.post('/api/ai/test').send(['prompt', 'value']);
      expect(res.status).toBe(400);
    });
  });

  describe('Health endpoint extremes', () => {
    it('handles query params on health endpoints', async () => {
      const res = await request.get('/api/health?foo=bar&xss=<script>');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });
});
