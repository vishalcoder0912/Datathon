import 'dotenv/config';
import {closePool, getPool} from '../src/db/pool.js';
import {runMigrations} from '../src/db/migration-runner.js';

const force = process.argv.includes('--force');

if (process.env.NODE_ENV === 'production' && !force) {
  console.error('Database reset is disabled in production. Pass --force only after an approved recovery decision.');
  process.exitCode = 1;
} else {
  try {
    const pool = getPool();
    await pool.query('DROP SCHEMA IF EXISTS analytics CASCADE');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await closePool();

    const result = await runMigrations();
    console.log(JSON.stringify({status: 'ok', message: 'The local KAVACH database was reset and reseeded with reference data.', ...result}, null, 2));
  } catch (error) {
    console.error(JSON.stringify({status: 'error', message: error.message}, null, 2));
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
