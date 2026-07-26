import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    const duration = performance.now() - start;
    return { ok: response.ok, status: response.status, duration };
  } catch (err) {
    return { ok: false, status: 0, duration: performance.now() - start, error: err.message };
  }
}

async function runConcurrentRequests(count, url, options = {}) {
  const promises = Array.from({ length: count }, (_, i) =>
    timedFetch(url, options),
  );
  return Promise.all(promises);
}

function analyzeResults(results) {
  const successful = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const durations = successful.map((r) => r.duration);
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    errorRate: results.length > 0 ? failed.length / results.length : 1,
    avgDuration,
    maxDuration,
    minDuration,
  };
}

describe('Concurrent User Simulation', () => {
  const endpoints = [
    { name: 'health', method: 'GET', path: '/api/health' },
    { name: 'ping', method: 'GET', path: '/api/health/ping' },
  ];

  describe('10 Concurrent Users', () => {
    it.each(endpoints)('$name endpoint should handle 10 concurrent requests', async ({ path }) => {
      const url = `${BASE_URL}${path}`;
      const results = await runConcurrentRequests(10, url);
      const analysis = analyzeResults(results);

      expect(analysis.failed).toBe(0);
      expect(analysis.avgDuration).toBeLessThan(500);
      expect(analysis.maxDuration).toBeLessThan(1000);
    });
  });

  describe('50 Concurrent Users', () => {
    it.each(endpoints)('$name endpoint should handle 50 concurrent requests', async ({ path }) => {
      const url = `${BASE_URL}${path}`;
      const results = await runConcurrentRequests(50, url);
      const analysis = analyzeResults(results);

      expect(analysis.errorRate).toBeLessThan(0.01);
      expect(analysis.avgDuration).toBeLessThan(1000);
    });
  });

  describe('100 Concurrent Users', () => {
    it.each(endpoints)('$name endpoint should handle 100 concurrent requests', async ({ path }) => {
      const url = `${BASE_URL}${path}`;
      const results = await runConcurrentRequests(100, url);
      const analysis = analyzeResults(results);

      expect(analysis.errorRate).toBeLessThan(0.02);
    });
  });

  describe('Degradation Curve', () => {
    it('should measure degradation from 10 to 100 concurrent users', async () => {
      const url = `${BASE_URL}/api/health`;

      const results10 = await runConcurrentRequests(10, url);
      const results100 = await runConcurrentRequests(100, url);

      const avg10 = analyzeResults(results10).avgDuration;
      const avg100 = analyzeResults(results100).avgDuration;

      const degradationRatio = avg10 > 0 ? avg100 / avg10 : 0;
      expect(degradationRatio).toBeLessThan(10);
    });
  });

  describe('Mixed Workload', () => {
    it('should handle mixed requests across different endpoints', async () => {
      const mixedRequests = [
        ...Array.from({ length: 20 }, () => timedFetch(`${BASE_URL}/api/health`)),
        ...Array.from({ length: 20 }, () => timedFetch(`${BASE_URL}/api/health/ping`)),
        ...Array.from({ length: 20 }, () => timedFetch(`${BASE_URL}/api/health/live`)),
      ];

      const results = await Promise.all(mixedRequests);
      const analysis = analyzeResults(results);

      expect(analysis.failed).toBe(0);
      expect(analysis.errorRate).toBe(0);
    });
  });
});
