import { randomUUID } from 'node:crypto';
import { hashIpAddress } from '../auth/http.js';

export function ensureRequestContext(request) {
  if (request.context) return request.context;
  const requestId = request.headers?.['x-request-id'] || randomUUID();
  const forwarded = request.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || request.socket?.remoteAddress || '').split(',')[0].trim();
  request.context = {
    requestId: String(requestId).slice(0, 100),
    startedAt: Date.now(),
    ipHash: hashIpAddress(ip),
  };
  return request.context;
}

export function requestContext(request, response) {
  const context = ensureRequestContext(request);
  response.setHeader('X-Request-ID', context.requestId);
}

export default requestContext;
