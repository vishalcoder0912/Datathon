import { afterEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../auth/password-service.js';
import { createAccessToken, verifyAccessToken } from '../auth/token-service.js';

const originalAccessSecret = process.env.JWT_ACCESS_SECRET;

afterEach(() => {
  if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
});

describe('KAVACH authentication primitives', () => {
  it('creates and verifies a signed access token without exposing credentials', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough';
    const token = await createAccessToken({
      userId: '1d6d9cee-1b98-4b9a-a03a-4e5a790e7414',
      email: 'evaluator@kavach.local',
      roleCode: 'EVALUATOR',
      districtId: null,
      unitId: null,
      clearanceLevel: 1,
    });

    const user = await verifyAccessToken(token);
    expect(user).toMatchObject({ email: 'evaluator@kavach.local', roleCode: 'EVALUATOR', clearanceLevel: 1 });
    expect(token).not.toContain('test-access-secret');
  });

  it('rejects a tampered token', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough';
    const token = await createAccessToken({ userId: '1d6d9cee-1b98-4b9a-a03a-4e5a790e7414', email: 'a@kavach.local', roleCode: 'EVALUATOR' });
    expect(await verifyAccessToken(`${token}x`)).toBeNull();
  });

  it('uses a one-way password verifier', async () => {
    const hashed = await hashPassword('A secure local demo password');
    expect(hashed).not.toContain('A secure local demo password');
    expect(await verifyPassword('A secure local demo password', hashed)).toBe(true);
    expect(await verifyPassword('wrong password', hashed)).toBe(false);
  });
});

