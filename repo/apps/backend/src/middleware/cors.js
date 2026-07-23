// CORS middleware
import config from '../config/environment.js';

export function corsMiddleware(request, response) {
  const origin = request.headers.origin;
  const allowedOrigin = config.cors.origin;
  const allowedOrigins = String(allowedOrigin).split(',').map((value) => value.trim()).filter(Boolean);
  const credentialed = config.cors.credentials;
  const permitsAnyOrigin = allowedOrigins.includes('*') && !credentialed;
  const requestedOriginAllowed = origin && (permitsAnyOrigin || allowedOrigins.includes(origin));

  // Set CORS headers
  if (requestedOriginAllowed) response.setHeader('Access-Control-Allow-Origin', origin);
  else if (permitsAnyOrigin) response.setHeader('Access-Control-Allow-Origin', '*');
  else if (!origin && allowedOrigins.length === 1) response.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);

  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID, Accept, Origin');
  response.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Total-Count, X-Page-Count');
  
  if (credentialed) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Set max age for preflight requests
  response.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Add security headers
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add request ID if not present
  if (!request.headers['x-request-id']) {
    request.headers['x-request-id'] = generateRequestId();
  }
  response.setHeader('X-Request-ID', request.headers['x-request-id']);
}

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

export default corsMiddleware;
