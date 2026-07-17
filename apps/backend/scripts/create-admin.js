import 'dotenv/config';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hashPassword} from '../src/auth/password-service.js';
import {closePool, query} from '../src/db/pool.js';

export const allowedAdminRoles = new Set([
  'STATE_ADMIN',
  'SCRB_ANALYST',
  'DISTRICT_OFFICER',
  'STATION_OFFICER',
  'INVESTIGATOR',
  'EVALUATOR',
  'AUDITOR',
  'DATA_ENGINEER',
]);

const optionValue = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

export const createAdminAccount = async ({
  email,
  password,
  displayName = 'KAVACH Administrator',
  roleCode = 'STATE_ADMIN',
  districtId = null,
  unitId = null,
} = {}) => {
  const normalizedRoleCode = roleCode.toUpperCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Provide a valid administrator email address.');
  }
  if (!password || password.length < 12) {
    throw new Error('Provide an administrator password with at least 12 characters.');
  }
  if (!allowedAdminRoles.has(normalizedRoleCode)) {
    throw new Error('The requested role is not supported.');
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO user_account (email, password_hash, display_name, role_code, district_id, unit_id, clearance_level, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         role_code = EXCLUDED.role_code,
         district_id = EXCLUDED.district_id,
         unit_id = EXCLUDED.unit_id,
         active = true,
         updated_at = now()
     RETURNING user_id, email, display_name, role_code`,
    [email, passwordHash, displayName, normalizedRoleCode, Number.isFinite(districtId) ? districtId : null, Number.isFinite(unitId) ? unitId : null, normalizedRoleCode === 'STATE_ADMIN' ? 5 : 2],
  );
  return result.rows[0];
};

const runCli = async () => {
  const email = optionValue('email') || process.env.SEED_ADMIN_EMAIL || 'admin@kavach.local';
  const password = optionValue('password') || process.env.SEED_ADMIN_PASSWORD;
  const displayName = optionValue('name') || process.env.SEED_ADMIN_NAME || 'KAVACH Administrator';
  const roleCode = (optionValue('role') || 'STATE_ADMIN').toUpperCase();
  const districtId = optionValue('district-id') ? Number.parseInt(optionValue('district-id'), 10) : null;
  const unitId = optionValue('unit-id') ? Number.parseInt(optionValue('unit-id'), 10) : null;

  try {
    const user = await createAdminAccount({email, password, displayName, roleCode, districtId, unitId});
    console.log(JSON.stringify({status: 'ok', user}, null, 2));
  } catch (error) {
    console.error(JSON.stringify({status: 'error', message: error.message}, null, 2));
    process.exitCode = 1;
  } finally {
    await closePool();
  }
};

const invokedAsScript = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  await runCli();
}
