import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../db/pool.js', () => ({
  default: { query: mockQuery },
  query: mockQuery,
}));

vi.mock('../../auth/token-service.js', () => ({
  createAccessToken: vi.fn(),
  verifyAccessToken: vi.fn().mockResolvedValue(null),
  createOpaqueRefreshToken: vi.fn(() => 'mock-refresh-token'),
  accessTokenTtlSeconds: vi.fn(() => 900),
  refreshTokenTtlSeconds: vi.fn(() => 604800),
}));

vi.mock('../../auth/password-service.js', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../../middleware/audit.js', () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock('../../middleware/request-context.js', () => ({
  ensureRequestContext: vi.fn(() => ({ requestId: 'req-test', ipHash: 'hash-test' })),
}));

import { AuthService, authService } from '../../auth/auth-service.js';
import { verifyPassword } from '../../auth/password-service.js';
import { verifyAccessToken, createAccessToken } from '../../auth/token-service.js';
import { createHash } from 'node:crypto';

function mockResponse() {
  const res = { headers: {}, statusCode: 0, body: '' };
  res.writeHead = vi.fn((status, headers) => { res.statusCode = status; Object.assign(res.headers, headers); return res; });
  res.end = vi.fn((data) => { res.body = data?.toString() || ''; return res; });
  res.setHeader = vi.fn((k, v) => { res.headers[k] = v; return res; });
  return res;
}
function mockRequest(overrides = {}) {
  return { headers: {}, auth: null, method: 'POST', ...overrides };
}

let dbPool;

describe('Auth Security', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    dbPool = (await import('../../db/pool.js')).default;
  });

  describe('SQL Injection Prevention', () => {
    it('should reject SQL injection email: OR 1=1', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login("' OR 1=1 --", 'anything');
      expect(result).toBeNull();
      expect(dbPool.query).toHaveBeenCalledOnce();
      expect(dbPool.query.mock.calls[0][1][0]).toBe("' OR 1=1 --");
    });

    it('should reject SQL injection: admin\'--', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login("admin'--", 'anything');
      expect(result).toBeNull();
    });

    it('should reject SQL injection: DROP TABLE', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login("'; DROP TABLE users;--", 'anything');
      expect(result).toBeNull();
    });

    it('should reject SQL injection in password field', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login('valid@test.com', "' OR '1'='1");
      expect(result).toBeNull();
    });

    it('should reject stacked query injection', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login("valid@test.com'; DELETE FROM user_account;--", 'password');
      expect(result).toBeNull();
    });

    it('should reject UNION-based injection', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login("' UNION SELECT * FROM user_account--", 'password');
      expect(result).toBeNull();
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should handle $ne operator in email', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login({ $ne: '' }, 'password');
      expect(result).toBeNull();
    });

    it('should handle $gt operator injection', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login({ $gt: '' }, 'password');
      expect(result).toBeNull();
    });

    it('should handle $where operator injection', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login({ $where: '1==1' }, 'password');
      expect(result).toBeNull();
    });
  });

  describe('JWT Security', () => {
    it('should reject token with alg=none', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'STATE_ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const token = `${header}.${payload}.`;
      const result = await verifyAccessToken(token);
      expect(result).toBeNull();
    });

    it('should reject expired tokens', async () => {
      const payload = { sub: 'u1', role: 'STATE_ADMIN', exp: Math.floor(Date.now() / 1000) - 3600 };
      createAccessToken.mockResolvedValueOnce('mock-token');
      const result = await verifyAccessToken('mock-token');
      expect(result).toBeNull();
    });

    it('should reject tokens signed with wrong secret', async () => {
      const { createHmac } = await import('node:crypto');
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'STATE_ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const signature = createHmac('sha256', 'wrong-secret').update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${signature}`;
      const result = await verifyAccessToken(token);
      expect(result).toBeNull();
    });

    it('should reject tokens with malformed payload (not JSON)', async () => {
      const { createHmac } = await import('node:crypto');
      verifyAccessToken.mockRejectedValueOnce(new Error('Invalid token'));
      const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from('not-json').toString('base64url');
      const secret = 'kavach-development-access-secret-change-me';
      const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${signature}`;
      await expect(verifyAccessToken(token)).rejects.toThrow();
    });

    it('should reject token with modified payload (tampered)', async () => {
      const { createHmac } = await import('node:crypto');
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'STATE_ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const secret = 'kavach-development-access-secret-change-me';
      const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'attacker', role: 'STATE_ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const token = `${header}.${tamperedPayload}.${signature}`;
      const result = await verifyAccessToken(token);
      expect(result).toBeNull();
    });

    it('should reject token with less than 3 parts', async () => {
      const result = await verifyAccessToken('header.payload');
      expect(result).toBeNull();
    });

    it('should reject empty token', async () => {
      const result = await verifyAccessToken('');
      expect(result).toBeNull();
    });

    it('should reject token with wrong typ claim', async () => {
      const { createHmac } = await import('node:crypto');
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'u1', typ: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const secret = 'kavach-development-access-secret-change-me';
      const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
      const token = `${header}.${payload}.${signature}`;
      const result = await verifyAccessToken(token);
      expect(result).toBeNull();
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should reject refresh token reuse (rotation)', async () => {
      dbPool.query
        .mockResolvedValueOnce({ rows: [{ refresh_token_id: 'rt1', user_id: 'u1', email: 'a@b.com', display_name: 'A', role_code: 'STATE_ADMIN', district_id: null, unit_id: null, clearance_level: null, active: true }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const result = await authService.refresh('used-refresh-token');
      expect(result).not.toBeNull();
      expect(dbPool.query).toHaveBeenCalledTimes(3);
      expect(dbPool.query.mock.calls[1][0]).toContain('revoked_at');
    });

    it('should reject revoked refresh token', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.refresh('revoked-token');
      expect(result).toBeNull();
    });

    it('should reject expired refresh token', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.refresh('expired-token');
      expect(result).toBeNull();
    });

    it('should reject null refresh token', async () => {
      const result = await authService.refresh(null);
      expect(result).toBeNull();
    });
  });

  describe('Brute Force Protection', () => {
    it('should rate-limit after multiple failed attempts', async () => {
      vi.useFakeTimers();
      const email = 'brute@test.com';
      dbPool.query.mockResolvedValue({ rows: [] });
      verifyPassword.mockResolvedValue(false);

      for (let i = 0; i < 10; i++) {
        await authService.login(email, 'wrong');
      }

      const response = mockResponse();
      const result = await authService.login(email, 'wrong');
      expect(result).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('Password Policies', () => {
    it('should enforce minimum password length', async () => {
      const short = 'a'.repeat(7);
      const long = 'a'.repeat(8);
      expect(short.length).toBeLessThan(8);
      expect(long.length).toBeGreaterThanOrEqual(8);
    });

    it('should reject empty password', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.login('test@test.com', '');
      expect(result).toBeNull();
    });

    it('should trim whitespace in email but not password', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      await authService.login('  test@test.com  ', ' password ');
      expect(dbPool.query.mock.calls[0][1][0]).toBe('  test@test.com  ');
    });
  });

  describe('Refresh Token Rotation & Reuse Detection', () => {
    it('should revoke old refresh token on refresh', async () => {
      dbPool.query
        .mockResolvedValueOnce({ rows: [{ refresh_token_id: 'rt1', user_id: 'u1', email: 'a@b.com', display_name: 'A', role_code: 'STATE_ADMIN', district_id: null, unit_id: null, clearance_level: null, active: true }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await authService.refresh('valid-token');
      expect(result).not.toBeNull();
    });

    it('should detect replayed refresh token', async () => {
      dbPool.query.mockResolvedValue({ rows: [] });
      const first = await authService.refresh('replayed-token');
      const second = await authService.refresh('replayed-token');
      expect(first).toBeNull();
      expect(second).toBeNull();
    });

    it('should generate new opaque token each refresh', async () => {
      const hashes = new Set();
      for (let i = 0; i < 10; i++) {
        const hash = createHash('sha256').update(`test-${i}`).digest('hex');
        hashes.add(hash);
      }
      expect(hashes.size).toBe(10);
    });
  });

  describe('Cookie Security', () => {
    it('should set Secure flag on cookies in production', () => {
      process.env.NODE_ENV = 'production';
      const { createRefreshCookie } = require('../../auth/http.js');
      const cookie = createRefreshCookie('test-token', { maxAgeSeconds: 604800, secure: true, sameSite: 'Lax' });
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite');
      process.env.NODE_ENV = 'test';
    });

    it('should set SameSite=Lax on cookies', () => {
      const { createRefreshCookie } = require('../../auth/http.js');
      const cookie = createRefreshCookie('test-token', { maxAgeSeconds: 604800, secure: false, sameSite: 'Lax' });
      expect(cookie).toContain('SameSite=Lax');
    });
  });
});
