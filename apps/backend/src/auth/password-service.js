import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

async function bcrypt() {
  try {
    return await import('bcryptjs');
  } catch {
    return null;
  }
}

/** bcrypt is used when installed; scrypt is a local-development fallback only. */
export async function hashPassword(password) {
  const implementation = await bcrypt();
  if (implementation) return implementation.hash(password, 12);
  const salt = randomBytes(16).toString('base64url');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('scrypt$')) {
    const [, salt, encoded] = storedHash.split('$');
    if (!salt || !encoded) return false;
    const candidate = Buffer.from(await scrypt(password, salt, 64));
    const expected = Buffer.from(encoded, 'base64url');
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  }
  const implementation = await bcrypt();
  return implementation ? implementation.compare(password, storedHash) : false;
}

