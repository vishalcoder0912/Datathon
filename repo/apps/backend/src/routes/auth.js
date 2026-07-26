import { z } from 'zod';
import { authService } from '../auth/auth-service.js';
import { clearRefreshCookie, createRefreshCookie, parseCookies, readJsonBody } from '../auth/http.js';
import { refreshTokenTtlSeconds } from '../auth/token-service.js';
import { authenticateRequest } from '../middleware/authenticate.js';
import { writeAuditEvent } from '../middleware/audit.js';
import { ensureRequestContext } from '../middleware/request-context.js';
import { sendError, sendSuccess } from '../utils/response-utils.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
});

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

function requestKey(request, email = '') {
  const context = ensureRequestContext(request);
  return `${context.ipHash || 'unknown'}:${email.toLowerCase()}`;
}

function allowLogin(request, email) {
  const key = requestKey(request, email);
  const now = Date.now();
  const existing = loginAttempts.get(key) || { count: 0, startedAt: now };
  if (now - existing.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return true;
  }
  return existing.count < MAX_LOGIN_ATTEMPTS;
}

function recordLoginAttempt(request, email, succeeded) {
  const key = requestKey(request, email);
  if (succeeded) {
    loginAttempts.delete(key);
    return;
  }
  const now = Date.now();
  const existing = loginAttempts.get(key);
  loginAttempts.set(key, now - (existing?.startedAt || now) > LOGIN_WINDOW_MS ? { count: 1, startedAt: now } : { count: (existing?.count || 0) + 1, startedAt: existing?.startedAt || now });
}

function setRefreshCookie(response, token) {
  response.setHeader('Set-Cookie', createRefreshCookie(token, {
    maxAgeSeconds: refreshTokenTtlSeconds(),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.AUTH_COOKIE_SAME_SITE || process.env.COOKIE_SAME_SITE || 'Lax',
  }));
}

function clearCookie(response) {
  response.setHeader('Set-Cookie', clearRefreshCookie({ secure: process.env.NODE_ENV === 'production', sameSite: process.env.AUTH_COOKIE_SAME_SITE || process.env.COOKIE_SAME_SITE || 'Lax' }));
}

export async function handleAuthRoutes(request, response, pathname) {
  if (!pathname.startsWith('/api/auth')) return false;
  ensureRequestContext(request);

  try {
    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const parsed = loginSchema.safeParse(await readJsonBody(request, 32_000));
      if (!parsed.success) {
        sendError(response, 400, 'Email and password are required.', 'INVALID_LOGIN_PAYLOAD');
        return true;
      }
      if (!allowLogin(request, parsed.data.email)) {
        sendError(response, 429, 'Too many login attempts. Try again later.', 'LOGIN_RATE_LIMITED');
        return true;
      }
      const session = await authService.login(parsed.data.email, parsed.data.password);
      recordLoginAttempt(request, parsed.data.email, Boolean(session));
      if (!session) {
        await writeAuditEvent(request, { action: 'FAILED_LOGIN', entityType: 'USER_ACCOUNT', metadata: { emailHashOnly: true } });
        sendError(response, 401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
        return true;
      }
      request.auth = session.user;
      setRefreshCookie(response, session.refreshToken);
      await writeAuditEvent(request, { action: 'LOGIN', entityType: 'USER_ACCOUNT', entityId: session.user.userId });
      sendSuccess(response, { accessToken: session.accessToken, user: session.user, expiresInSeconds: Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15) * 60 }, 'Login successful');
      return true;
    }

    if (pathname === '/api/auth/refresh' && request.method === 'POST') {
      const body = await readJsonBody(request, 32_000);
      const token = parseCookies(request.headers?.cookie || '').kavach_refresh || body.refreshToken;
      const session = await authService.refresh(token);
      if (!session) {
        clearCookie(response);
        sendError(response, 401, 'Refresh session is invalid or expired.', 'INVALID_REFRESH_TOKEN');
        return true;
      }
      request.auth = session.user;
      setRefreshCookie(response, session.refreshToken);
      await writeAuditEvent(request, { action: 'TOKEN_REFRESH', entityType: 'USER_ACCOUNT', entityId: session.user.userId });
      sendSuccess(response, { accessToken: session.accessToken, user: session.user, expiresInSeconds: Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15) * 60 }, 'Session refreshed');
      return true;
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      const body = await readJsonBody(request, 32_000);
      const token = parseCookies(request.headers?.cookie || '').kavach_refresh || body.refreshToken;
      const user = await authenticateRequest(request);
      await authService.logout(token);
      clearCookie(response);
      await writeAuditEvent(request, { action: 'LOGOUT', entityType: 'USER_ACCOUNT', entityId: user?.userId || null });
      sendSuccess(response, null, 'Logged out');
      return true;
    }

    if (pathname === '/api/auth/me' && request.method === 'GET') {
      const user = await authenticateRequest(request);
      if (!user) {
        sendError(response, 401, 'Authentication is required.', 'AUTH_REQUIRED');
        return true;
      }
      const currentUser = await authService.getUser(user.userId);
      if (!currentUser) {
        sendError(response, 401, 'Session is no longer active.', 'SESSION_INACTIVE');
        return true;
      }
      request.auth = currentUser;
      sendSuccess(response, currentUser, 'Current user retrieved');
      return true;
    }

    return false;
  } catch (error) {
    if (error.code === 'BODY_TOO_LARGE') {
      sendError(response, 413, 'Request body is too large.', 'BODY_TOO_LARGE');
    } else if (error.code === 'INVALID_JSON') {
      sendError(response, 400, 'Request body must be valid JSON.', 'INVALID_JSON');
    } else {
      sendError(response, 503, 'Authentication service is temporarily unavailable.', 'AUTH_SERVICE_UNAVAILABLE');
    }
    return true;
  }
}

export default { handleAuthRoutes };
