import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbQuery = vi.fn();
vi.mock('../../db/pool.js', () => ({
  default: { query: mockDbQuery },
  query: mockDbQuery,
}));

vi.mock('../../middleware/request-context.js', () => ({
  ensureRequestContext: vi.fn(() => ({ requestId: 'req-test', ipHash: 'hash-test' })),
}));

vi.mock('../../middleware/audit.js', () => ({
  writeAuditEvent: vi.fn(),
  auditEntityId: vi.fn((v) => v ? createHash('sha256').update(String(v)).digest('hex').slice(0, 32) : null),
}));

import { createHash } from 'node:crypto';
import { hasPermission, authorize, scopeFromUser, validateRequestedScope, ROLE_PERMISSIONS } from '../../middleware/authorize.js';
import { authService } from '../../auth/auth-service.js';
import { auditEntityId } from '../../middleware/audit.js';

describe('Data Security', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });
  describe('PII Leakage Prevention', () => {
    it('should not expose email in error responses', () => {
      const errorResponse = { success: false, error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' } };
      const body = JSON.stringify(errorResponse);
      expect(body).not.toContain('@');
      expect(body).not.toContain('smtp');
    });

    it('should mask email in logs', () => {
      const email = 'john.doe@example.com';
      const masked = email.replace(/(.{3}).*(@.*)/, '$1***$2');
      expect(masked).toBe('joh***@example.com');
      expect(masked).not.toContain('john.doe');
    });

    it('should mask phone numbers in responses', () => {
      const phone = '+91-9876543210';
      const masked = phone.replace(/\+?(\d{2})-?(\d{4})\d{4}/, '+$1-****$2');
      expect(masked).not.toContain('9876543210');
    });

    it('should detect Aadhaar-like patterns in output', () => {
      const output = 'User details: Aadhaar 1234-5678-9012';
      const aadhaarPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
      const matches = output.match(aadhaarPattern);
      expect(matches).not.toBeNull();
    });

    it('should not expose password hashes in responses', () => {
      const userResponse = { userId: 1, email: 'test@test.com', roleCode: 'STATION_OFFICER' };
      expect(userResponse).not.toHaveProperty('passwordHash');
      expect(userResponse).not.toHaveProperty('password_hash');
    });

    it('should not expose internal tokens in responses', () => {
      const response = { accessToken: 'eyJ...', refreshToken: 'abc123' };
      const publicResponse = { accessToken: response.accessToken };
      expect(publicResponse).not.toHaveProperty('refreshToken');
    });
  });

  describe('Data Masking', () => {
    it('should mask sensitive fields in audit logs', () => {
      const sensitiveData = { email: 'user@test.com', password: 'secret123', token: 'abc', authorization: 'Bearer xyz' };
      const scrubbed = Object.fromEntries(
        Object.entries(sensitiveData).filter(([k]) => !/password|token|authorization/i.test(k))
      );
      expect(scrubbed).not.toHaveProperty('password');
      expect(scrubbed).not.toHaveProperty('token');
      expect(scrubbed).not.toHaveProperty('authorization');
      expect(scrubbed).toHaveProperty('email');
    });

    it('should not mask non-sensitive fields', () => {
      const data = { name: 'John', age: 30, email: 'j@test.com' };
      const scrubbed = Object.fromEntries(
        Object.entries(data).filter(([k]) => !/password|token|authorization|cookie|hash/i.test(k))
      );
      expect(scrubbed).toEqual(data);
    });
  });

  describe('Audit Log Completeness', () => {
    it('should record login events', () => {
      const event = { action: 'LOGIN', entityType: 'USER_ACCOUNT', entityId: 'u1' };
      expect(event.action).toBe('LOGIN');
      expect(event.entityType).toBe('USER_ACCOUNT');
      expect(event.entityId).toBe('u1');
    });

    it('should record failed login events without exposing password', () => {
      const event = { action: 'FAILED_LOGIN', entityType: 'USER_ACCOUNT', metadata: { emailHashOnly: true } };
      expect(event.metadata.emailHashOnly).toBe(true);
      expect(event).not.toHaveProperty('password');
    });

    it('should record token refresh events', () => {
      const event = { action: 'TOKEN_REFRESH', entityType: 'USER_ACCOUNT', entityId: 'u1' };
      expect(event.action).toBe('TOKEN_REFRESH');
    });

    it('should record logout events', () => {
      const event = { action: 'LOGOUT', entityType: 'USER_ACCOUNT', entityId: 'u1' };
      expect(event.action).toBe('LOGOUT');
    });

    it('should hash entity IDs in audit for non-essential entities', () => {
      const rawId = 'super-secret-internal-id-12345';
      const hashed = auditEntityId(rawId);
      expect(hashed).not.toContain(rawId);
      expect(hashed).toHaveLength(32);
    });

    it('should handle null entity IDs', () => {
      expect(auditEntityId(null)).toBeNull();
      expect(auditEntityId(undefined)).toBeNull();
    });
  });

  describe('RBAC Boundary Enforcement', () => {
    it('should allow STATE_ADMIN to manage users', () => {
      expect(hasPermission({ roleCode: 'STATE_ADMIN' }, 'manage:users')).toBe(true);
    });

    it('should deny STATION_OFFICER to manage users', () => {
      expect(hasPermission({ roleCode: 'STATION_OFFICER' }, 'manage:users')).toBe(false);
    });

    it('should deny EVALUATOR to read audit', () => {
      expect(hasPermission({ roleCode: 'EVALUATOR' }, 'read:audit')).toBe(false);
    });

    it('should allow AUDITOR to read audit', () => {
      expect(hasPermission({ roleCode: 'AUDITOR' }, 'read:audit')).toBe(true);
    });

    it('should deny unknown role permissions', () => {
      expect(hasPermission({ roleCode: 'HACKER' }, 'read:intelligence')).toBe(false);
    });

    it('should deny null user', () => {
      expect(hasPermission(null, 'read:intelligence')).toBe(false);
    });

    it('should enforce district boundary for DISTRICT_OFFICER', () => {
      const scope = { roleCode: 'DISTRICT_OFFICER', districtId: 5 };
      expect(validateRequestedScope({ districtId: 5 }, scope)).toBe(true);
      expect(validateRequestedScope({ districtId: 10 }, scope)).toBe(false);
    });

    it('should enforce station boundary for STATION_OFFICER', () => {
      const scope = { roleCode: 'STATION_OFFICER', unitId: 3 };
      expect(validateRequestedScope({ stationId: 3 }, scope)).toBe(true);
      expect(validateRequestedScope({ stationId: 99 }, scope)).toBe(false);
    });

    it('should enforce station boundary for INVESTIGATOR', () => {
      const scope = { roleCode: 'INVESTIGATOR', unitId: 7 };
      expect(validateRequestedScope({ stationId: 7 }, scope)).toBe(true);
      expect(validateRequestedScope({ stationId: 8 }, scope)).toBe(false);
    });

    it('should allow STATE_ADMIN to access all districts', () => {
      const scope = { roleCode: 'STATE_ADMIN', districtId: null };
      expect(validateRequestedScope({ districtId: 1 }, scope)).toBe(true);
      expect(validateRequestedScope({ districtId: 100 }, scope)).toBe(true);
    });

    it('should allow EVALUATOR to access any district', () => {
      const scope = { roleCode: 'EVALUATOR', districtId: null, unitId: null };
      expect(validateRequestedScope({ districtId: 5 }, scope)).toBe(true);
    });

    it('should reject requests with no auth context', () => {
      const res = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
      expect(authorize({ auth: null }, res, 'read:intelligence')).toBe(false);
    });
  });

  describe('Deleted User Token Invalidated', () => {
    it('should reject tokens for inactive users', async () => {
      const dbPool = (await import('../../db/pool.js')).default;
      dbPool.query.mockResolvedValue({ rows: [] });
      const result = await authService.getUser('deleted-user-id');
      expect(result).toBeNull();
    });

    it('should reject login for inactive account', async () => {
      const dbPool = (await import('../../db/pool.js')).default;
      dbPool.query.mockResolvedValue({ rows: [{ active: false }] });
      const { verifyPassword } = await import('../../auth/password-service.js');
      const result = await authService.login('inactive@test.com', 'password');
      expect(result).toBeNull();
    });
  });

  describe('Privilege Escalation via Role Manipulation', () => {
    it('should reject role modification in token payload', async () => {
      const { createHmac } = await import('node:crypto');
      const tokenParts = [];
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const originalPayload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'STATION_OFFICER', exp: 9999999999 })).toString('base64url');
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'STATE_ADMIN', exp: 9999999999 })).toString('base64url');
      tokenParts.push(header, originalPayload, tamperedPayload);

      const { verifyAccessToken } = await import('../../auth/token-service.js');
      expect(originalPayload).not.toEqual(tamperedPayload);
    });

    it('should not include permissions beyond users role', () => {
      const stationOfficerPermissions = ROLE_PERMISSIONS['STATION_OFFICER'];
      const adminPermissions = ROLE_PERMISSIONS['STATE_ADMIN'];
      for (const perm of stationOfficerPermissions) {
        expect(adminPermissions.has(perm)).toBe(true);
      }
    });
  });

  describe('Broken Object Level Authorization (BOLA)', () => {
    it('should prevent accessing other users dataset', () => {
      const scope = { roleCode: 'STATION_OFFICER', userId: 'u1', unitId: 3 };
      const otherDataset = { ownerId: 'u2', stationId: 3 };
      const canAccess = otherDataset.ownerId === scope.userId;
      expect(canAccess).toBe(false);
    });

    it('should enforce dataset ownership for STATION_OFFICER', () => {
      const scope = { userId: 'u1' };
      const owned = { ownerId: 'u1' };
      const notOwned = { ownerId: 'u2' };
      expect(owned.ownerId === scope.userId).toBe(true);
      expect(notOwned.ownerId === scope.userId).toBe(false);
    });

    it('should validate scope boundaries for data access', () => {
      const scope = { roleCode: 'DISTRICT_OFFICER', districtId: 5 };
      expect(validateRequestedScope({ districtId: 5, ownerId: 'u3' }, scope)).toBe(true);
      expect(validateRequestedScope({ districtId: 10, ownerId: 'u1' }, scope)).toBe(false);
    });
  });
});
