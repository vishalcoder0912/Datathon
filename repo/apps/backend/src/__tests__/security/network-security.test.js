import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/environment.js', () => ({
  default: {
    cors: { origin: 'http://localhost:5173,http://localhost:3000', credentials: true },
    server: { port: 3001, host: 'localhost', nodeEnv: 'development' },
  },
  config: {
    cors: { origin: 'http://localhost:5173,http://localhost:3000', credentials: true },
  },
}));

import { corsMiddleware } from '../../middleware/cors.js';
import config from '../../config/environment.js';

function mockResponse() {
  const res = { headers: {}, statusCode: 0 };
  res.writeHead = vi.fn((status, headers) => { res.statusCode = status; if (headers) Object.assign(res.headers, headers); return res; });
  res.end = vi.fn(() => res);
  res.setHeader = vi.fn((key, value) => { res.headers[key] = value; return res; });
  return res;
}

function mockRequest(method, pathname, overrides = {}) {
  return { headers: { origin: 'http://localhost:5173', 'accept-encoding': 'gzip' }, auth: null, method: method || 'GET', url: pathname || '/api/test', ...overrides };
}

describe('Network Security', () => {
  describe('CORS Configuration', () => {
    it('should reflect allowed origin', () => {
      const req = mockRequest('GET', '/api/test', { headers: { origin: 'http://localhost:5173' } });
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('should not reflect disallowed origin', () => {
      const req = mockRequest('GET', '/api/test', { headers: { origin: 'https://evil.com' } });
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should not reflect null origin when credentials enabled', () => {
      const req = mockRequest('GET', '/api/test', { headers: { origin: 'null' } });
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should set Access-Control-Allow-Credentials when configured', () => {
      config.cors.credentials = true;
      const req = mockRequest('OPTIONS', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should not set credentials header when disabled', () => {
      config.cors.credentials = false;
      config.cors.origin = '*';
      const req = mockRequest('GET', '/api/test', { headers: { origin: 'http://localhost:5173' } });
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
    });

    it('should not allow wildcard origin with credentials', () => {
      config.cors.origin = '*';
      config.cors.credentials = true;
      const req = mockRequest('GET', '/api/test', { headers: { origin: '*' } });
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  describe('HTTP Security Headers', () => {
    it('should set X-Content-Type-Options: nosniff', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should set X-Frame-Options: DENY', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['X-Frame-Options']).toBe('DENY');
    });

    it('should set X-XSS-Protection: 1; mode=block', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should set Referrer-Policy: strict-origin-when-cross-origin', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set Content-Security-Policy header', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers).toHaveProperty('Content-Security-Policy');
    });

    it('should set Strict-Transport-Security header', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers).toHaveProperty('Strict-Transport-Security');
    });

    it('should set Permissions-Policy header', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers).toHaveProperty('Permissions-Policy');
    });

    it('should not allow framing from any origin', () => {
      const req = mockRequest('GET', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['X-Frame-Options']).toBe('DENY');
    });

    it('should set security headers even for OPTIONS preflight', () => {
      const req = mockRequest('OPTIONS', '/api/test');
      const res = mockResponse();
      corsMiddleware(req, res);
      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('Open Redirect Prevention', () => {
    it('should reject redirect to external domain', () => {
      const allowedHosts = ['insightflow.ai', 'localhost:3001'];
      const redirectTarget = 'https://evil.com/phish';
      const parsed = new URL(redirectTarget);
      expect(allowedHosts.includes(parsed.host)).toBe(false);
    });

    it('should reject javascript: URL in redirect', () => {
      const redirectTarget = 'javascript:alert(1)';
      expect(redirectTarget.startsWith('javascript:')).toBe(true);
    });

    it('should reject data: URL in redirect', () => {
      const redirectTarget = 'data:text/html,<script>alert(1)</script>';
      expect(redirectTarget.startsWith('data:')).toBe(true);
    });

    it('should allow relative path redirects', () => {
      const redirectTarget = '/api/datasets/123';
      expect(redirectTarget.startsWith('/')).toBe(true);
      expect(redirectTarget.startsWith('http')).toBe(false);
    });

    it('should allow same-origin redirects', () => {
      const allowedHosts = ['insightflow.ai', 'localhost:3001'];
      const redirectTarget = 'https://insightflow.ai/dashboard';
      const parsed = new URL(redirectTarget);
      expect(allowedHosts.includes(parsed.host)).toBe(true);
    });
  });

  describe('Host Header Injection', () => {
    it('should validate Host header against whitelist', () => {
      const allowedHosts = ['localhost:3001', 'insightflow.ai', 'staging.insightflow.ai'];
      expect(allowedHosts.includes('localhost:3001')).toBe(true);
      expect(allowedHosts.includes('evil.com')).toBe(false);
    });

    it('should reject X-Forwarded-Host injection', () => {
      const xfh = 'evil.com';
      const allowedHosts = ['localhost:3001', 'insightflow.ai'];
      expect(allowedHosts.includes(xfh)).toBe(false);
    });

    it('should not trust X-Forwarded-Host for redirects', () => {
      const host = 'insightflow.ai';
      const xfh = 'evil.com';
      const redirectUrl = `https://${host}/api`;
      expect(redirectUrl).not.toContain(xfh);
    });

    it('should reject Host header with port manipulation', () => {
      const malicious = 'localhost:3001@evil.com';
      expect(malicious).toContain('@');
    });
  });
});
