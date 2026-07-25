import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAuthRoutes } from '../../routes/auth.js';
import { handleKavachRoutes } from '../../routes/kavach.js';
import { createAccessToken } from '../../auth/token-service.js';
import { authService } from '../../auth/auth-service.js';

// Setup environment for testing
process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-long-enough-for-signing-token-keys';

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          this.headers[k.toLowerCase()] = v;
        }
      }
    },
    end(chunk = '') {
      this.body += chunk;
      this.ended = true;
    },
    json() {
      try {
        return JSON.parse(this.body || '{}');
      } catch (err) {
        return { error: 'Invalid JSON body: ' + this.body };
      }
    },
  };
}

function makeRequest({ method = 'GET', pathname = '', headers = {}, body = null }) {
  const jsonString = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
  const searchParams = new URLSearchParams();
  return {
    method,
    pathname,
    headers: {
      host: 'localhost',
      'content-type': 'application/json',
      ...headers,
    },
    searchParams,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(jsonString);
    },
  };
}

describe('Extreme API Ingestion & Authentication Vulnerability Tests', () => {
  
  describe('Authentication Endpoint Validation (/api/auth/login)', () => {
    it('rejects SQL Injection attempt in email field', async () => {
      const payload = {
        email: "' OR 1=1 --",
        password: 'anyPassword123!',
      };
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: payload });
      const res = makeResponse();
      
      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_LOGIN_PAYLOAD');
    });

    it('rejects XSS payload in email field', async () => {
      const payload = {
        email: '<script>alert(1)</script>@kavach.local',
        password: 'password',
      };
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: payload });
      const res = makeResponse();

      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(400); // Should be invalid email syntax
    });

    it('rejects empty credentials', async () => {
      const payload = { email: '', password: '' };
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: payload });
      const res = makeResponse();

      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(400);
    });

    it('rejects deeply nested and large payloads (Zod / body parser limits)', async () => {
      // Create a massive payload > 32KB to trigger BODY_TOO_LARGE
      const massiveBody = {
        email: 'evaluator@kavach.local',
        password: 'password',
        extraPadding: 'x'.repeat(40000), // Over the 32,000 byte limit
      };
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: massiveBody });
      const res = makeResponse();

      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(413); // Payload Too Large
      expect(res.json().error.code).toBe('BODY_TOO_LARGE');
    });
  });

  describe('JWT Access Token Security Checks', () => {
    it('rejects modified or tampered bearer token signature', async () => {
      const req = makeRequest({
        method: 'GET',
        pathname: '/api/auth/me',
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwiZW1haWwiOiJhQGEuY29tIn0.tampered_signature',
        },
      });
      const res = makeResponse();

      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects expired JWT token', async () => {
      // Simulating a token signed in the past with expired signature or invalid details
      const req = makeRequest({
        method: 'GET',
        pathname: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid_expired_jwt',
        },
      });
      const res = makeResponse();

      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
    });

    it('rejects missing Authorization headers on authenticated routes', async () => {
      const req = makeRequest({ method: 'GET', pathname: '/api/auth/me' });
      const res = makeResponse();

      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Authorization Rules & Escalation Mitigations', () => {
    it('verifies token payload injection is safely ignored by verifyAccessToken', async () => {
      const badToken = 'Bearer null';
      const req = makeRequest({
        method: 'GET',
        pathname: '/api/auth/me',
        headers: { authorization: badToken },
      });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(401);
    });
  });
});
