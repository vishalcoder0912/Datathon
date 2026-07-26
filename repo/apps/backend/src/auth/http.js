import { createHash } from 'node:crypto';

const DEFAULT_BODY_LIMIT = 1_000_000;

export async function readRequestBody(request, maxBytes = DEFAULT_BODY_LIMIT) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large.');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJsonBody(request, maxBytes = DEFAULT_BODY_LIMIT) {
  const body = await readRequestBody(request, maxBytes);
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

export function parseCookies(header = '') {
  return String(header).split(';').reduce((cookies, pair) => {
    const separator = pair.indexOf('=');
    if (separator < 0) return cookies;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

export function createRefreshCookie(value, options = {}) {
  const maxAgeSeconds = Math.max(1, Number(options.maxAgeSeconds || 60 * 60 * 24 * 7));
  const parts = [
    `kavach_refresh=${encodeURIComponent(value)}`,
    'HttpOnly',
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
    `SameSite=${options.sameSite || 'Lax'}`,
    'Path=/api/auth',
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearRefreshCookie(options = {}) {
  const parts = ['kavach_refresh=', 'HttpOnly', 'Max-Age=0', `SameSite=${options.sameSite || 'Lax'}`, 'Path=/api/auth'];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function hashIpAddress(ip = '') {
  if (!ip) return null;
  return createHash('sha256').update(String(ip)).digest('hex');
}

