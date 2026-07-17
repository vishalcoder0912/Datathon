import { createHash, randomUUID } from 'node:crypto';
import { createOpaqueRefreshToken, createAccessToken, refreshTokenTtlSeconds } from './token-service.js';
import { verifyPassword } from './password-service.js';

function hashToken(value) {
  return createHash('sha256').update(value).digest('hex');
}

function publicUser(row) {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    roleCode: row.role_code,
    districtId: row.district_id,
    unitId: row.unit_id,
    clearanceLevel: row.clearance_level,
  };
}

async function database() {
  return import('../db/pool.js');
}

export class AuthService {
  async login(email, password) {
    const db = await database();
    const result = await db.query(`
      SELECT user_id, email, password_hash, display_name, role_code, district_id, unit_id, clearance_level, active
      FROM user_account WHERE email = $1::citext LIMIT 1
    `, [email]);
    const row = result.rows?.[0];
    if (!row || !row.active || !(await verifyPassword(password, row.password_hash))) return null;
    const user = publicUser(row);
    const session = await this._createSession(user);
    await db.query('UPDATE user_account SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1::uuid', [user.userId]);
    return { user, ...session };
  }

  async refresh(rawToken) {
    if (!rawToken) return null;
    const db = await database();
    const result = await db.query(`
      SELECT rt.refresh_token_id, ua.user_id, ua.email, ua.display_name, ua.role_code, ua.district_id, ua.unit_id, ua.clearance_level, ua.active
      FROM refresh_token rt JOIN user_account ua ON ua.user_id = rt.user_id
      WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW() LIMIT 1
    `, [hashToken(rawToken)]);
    const row = result.rows?.[0];
    if (!row || !row.active) return null;
    await db.query('UPDATE refresh_token SET revoked_at = NOW() WHERE refresh_token_id = $1::uuid', [row.refresh_token_id]);
    const user = publicUser(row);
    return { user, ...(await this._createSession(user)) };
  }

  async logout(rawToken) {
    if (!rawToken) return;
    const db = await database();
    await db.query('UPDATE refresh_token SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(rawToken)]);
  }

  async getUser(userId) {
    const db = await database();
    const result = await db.query(`SELECT user_id, email, display_name, role_code, district_id, unit_id, clearance_level FROM user_account WHERE user_id = $1::uuid AND active = TRUE`, [userId]);
    return result.rows?.[0] ? publicUser(result.rows[0]) : null;
  }

  async _createSession(user) {
    const refreshToken = createOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + (refreshTokenTtlSeconds() * 1000));
    const db = await database();
    await db.query(`INSERT INTO refresh_token (refresh_token_id, user_id, token_hash, expires_at, created_at) VALUES ($1::uuid, $2::uuid, $3, $4, NOW())`, [randomUUID(), user.userId, hashToken(refreshToken), expiresAt]);
    return { accessToken: await createAccessToken(user), refreshToken, refreshExpiresAt: expiresAt.toISOString() };
  }
}

export const authService = new AuthService();

