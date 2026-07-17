import { verifyAccessToken } from '../auth/token-service.js';
import { sendError } from '../utils/response-utils.js';
import { ensureRequestContext } from './request-context.js';

export async function authenticateRequest(request) {
  ensureRequestContext(request);
  if (request.auth) return request.auth;
  const authorization = request.headers?.authorization || request.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization));
  if (!match) return null;
  const user = await verifyAccessToken(match[1]);
  if (!user) return null;
  request.auth = user;
  return user;
}

export async function requireAuthentication(request, response) {
  const user = await authenticateRequest(request);
  if (user) return user;
  sendError(response, 401, 'Authentication is required.', 'AUTH_REQUIRED');
  return null;
}

export function demoEvaluator() {
  return { userId: null, email: 'evaluator@kavach.local', roleCode: 'EVALUATOR', districtId: null, unitId: null, clearanceLevel: 1, demo: true };
}

