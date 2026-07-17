import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function base64Url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function fromBase64Url(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function secretFor(kind) {
  const value = kind === 'refresh' ? process.env.JWT_REFRESH_SECRET : process.env.JWT_ACCESS_SECRET;
  if (value && value.trim()) return value;
  if (process.env.NODE_ENV === 'production') throw new Error(`${kind === 'refresh' ? 'JWT_REFRESH_SECRET' : 'JWT_ACCESS_SECRET'} is required in production.`);
  return `kavach-development-${kind}-secret-change-me`;
}

function sign(payload, secret) {
  const header = base64Url({ alg: 'HS256', typ: 'JWT' });
  const encodedPayload = base64Url(payload);
  const signature = createHmac('sha256', secret).update(`${header}.${encodedPayload}`).digest('base64url');
  return `${header}.${encodedPayload}.${signature}`;
}

function verify(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const payload = fromBase64Url(parts[1]);
  if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) return null;
  return payload;
}

export function accessTokenTtlSeconds() {
  return Math.max(60, Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15) * 60);
}

export function refreshTokenTtlSeconds() {
  return Math.max(60 * 60, Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7) * 24 * 60 * 60);
}

export async function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: user.userId,
    email: user.email,
    role: user.roleCode,
    districtId: user.districtId || null,
    unitId: user.unitId || null,
    clearanceLevel: user.clearanceLevel || null,
    iat: now,
    exp: now + accessTokenTtlSeconds(),
    typ: 'access',
  }, secretFor('access'));
}

export async function verifyAccessToken(token) {
  const payload = verify(token, secretFor('access'));
  if (!payload || payload.typ !== 'access') return null;
  return {
    userId: payload.sub,
    email: payload.email,
    roleCode: payload.role,
    districtId: payload.districtId || null,
    unitId: payload.unitId || null,
    clearanceLevel: payload.clearanceLevel || null,
  };
}

export function createOpaqueRefreshToken() {
  return randomBytes(48).toString('base64url');
}

