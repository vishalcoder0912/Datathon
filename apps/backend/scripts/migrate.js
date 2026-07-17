import 'dotenv/config';
import {closePool} from '../src/db/pool.js';
import {runMigrations} from '../src/db/migration-runner.js';

try {
  const result = await runMigrations();
  console.log(JSON.stringify({status: 'ok', ...result}, null, 2));
} catch (error) {
  console.error(JSON.stringify({status: 'error', message: error.message}, null, 2));
  process.exitCode = 1;
} finally {
  await closePool();
}
