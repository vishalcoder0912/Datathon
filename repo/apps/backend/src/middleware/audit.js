import { createHash } from 'node:crypto';
import { ensureRequestContext } from './request-context.js';

function scrub(value) {
  if (!value || typeof value !== 'object') return value;
  const copy = Array.isArray(value) ? [] : {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|token|authorization|cookie|hash/i.test(key)) continue;
    copy[key] = typeof item === 'object' && item ? scrub(item) : item;
  }
  return copy;
}

export async function writeAuditEvent(request, event = {}) {
  try {
    const context = ensureRequestContext(request);
    const database = await import('../db/pool.js');
    const userId = event.userId || request.auth?.userId || null;
    await database.query(`
      INSERT INTO audit_log (audit_id, user_id, action, entity_type, entity_id, request_id, ip_hash, user_agent, before_data, after_data, metadata, created_at)
      VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, NOW())
    `, [
      userId,
      String(event.action || 'UNKNOWN').slice(0, 100),
      String(event.entityType || 'SYSTEM').slice(0, 100),
      event.entityId ? String(event.entityId).slice(0, 100) : null,
      context.requestId,
      context.ipHash,
      String(request.headers?.['user-agent'] || '').slice(0, 1000),
      JSON.stringify(scrub(event.beforeData || null)),
      JSON.stringify(scrub(event.afterData || null)),
      JSON.stringify(scrub(event.metadata || {})),
    ]);
  } catch {
    // Auditing must not expose internal details or prevent a safe read response.
  }
}

export function auditEntityId(value) {
  if (value === undefined || value === null) return null;
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

