import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAuthRoutes } from '../../routes/auth.js';
import { authService } from '../../auth/auth-service.js';

process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-long-enough-for-signing-token-keys-32bytes!';

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
      } catch {
        return { error: 'Invalid JSON body' };
      }
    },
  };
}

function makeRequest({ method = 'GET', pathname = '', headers = {}, body = null }) {
  const jsonString = body !== null ? JSON.stringify(body) : '';
  return {
    method,
    pathname,
    headers: { host: 'localhost', 'content-type': 'application/json', ...headers },
    searchParams: new URLSearchParams(),
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(jsonString);
    },
  };
}

describe('Auth Flow (End-to-End)', () => {
  describe('Login endpoint (/api/auth/login)', () => {
    it('rejects empty credentials with 400', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { email: '', password: '' } });
      const res = makeResponse();
      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
    });

    it('rejects missing email with 400', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { password: 'test123' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(400);
    });

    it('rejects missing password with 400', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { email: 'test@test.com' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid email format with 400', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { email: 'not-an-email', password: 'test123' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(400);
    });

    it('rejects SQL injection attempt in email', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { email: "' OR 1=1 --", password: 'password' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('INVALID_LOGIN_PAYLOAD');
    });

    it('rejects XSS payload in email', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { email: '<script>alert(1)</script>@kavach.local', password: 'password' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(400);
    });

    it('handles oversized payload with 413', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/login', body: { email: 'test@test.com', password: 'x'.repeat(40000) } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(413);
    });
  });

  describe('Token refresh endpoint (/api/auth/refresh)', () => {
    it('rejects refresh with no token', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/refresh', body: {} });
      const res = makeResponse();
      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects refresh with invalid token string', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/refresh', body: { refreshToken: 'invalid-token-value' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect([401, 503]).toContain(res.statusCode);
    });
  });

  describe('Protected /api/auth/me endpoint', () => {
    it('rejects request without auth header', async () => {
      const req = makeRequest({ method: 'GET', pathname: '/api/auth/me' });
      const res = makeResponse();
      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects request with empty Bearer token', async () => {
      const req = makeRequest({ method: 'GET', pathname: '/api/auth/me', headers: { authorization: 'Bearer ' } });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(401);
    });

    it('rejects tampered JWT', async () => {
      const req = makeRequest({
        method: 'GET',
        pathname: '/api/auth/me',
        headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.tampered.tampered' },
      });
      const res = makeResponse();
      await handleAuthRoutes(req, res, req.pathname);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Logout endpoint (/api/auth/logout)', () => {
    it('handles logout without auth', async () => {
      const req = makeRequest({ method: 'POST', pathname: '/api/auth/logout', body: {} });
      const res = makeResponse();
      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(true);
      expect([200, 401]).toContain(res.statusCode);
    });
  });

  describe('Non-existent auth routes', () => {
    it('returns false for unknown auth path', async () => {
      const req = makeRequest({ method: 'GET', pathname: '/api/auth/unknown' });
      const res = makeResponse();
      const handled = await handleAuthRoutes(req, res, req.pathname);
      expect(handled).toBe(false);
    });
  });
});
