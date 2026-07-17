import 'dotenv/config';
import {createAdminAccount} from './create-admin.js';
import {closePool} from '../src/db/pool.js';
import {runMigrations} from '../src/db/migration-runner.js';

try {
  const result = await runMigrations();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const user = password
    ? await createAdminAccount({
      email: process.env.SEED_ADMIN_EMAIL || 'admin@kavach.local',
      password,
      displayName: process.env.SEED_ADMIN_NAME || 'KAVACH Administrator',
    })
    : null;
  console.log(JSON.stringify({
    status: 'ok',
    message: user
      ? 'Reference data and the configured local administrator are ready.'
      : 'Reference data is ready. Set SEED_ADMIN_PASSWORD and rerun db:seed or create-admin to enable local login.',
    user,
    ...result,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({status: 'error', message: error.message}, null, 2));
  process.exitCode = 1;
} finally {
  await closePool();
}
