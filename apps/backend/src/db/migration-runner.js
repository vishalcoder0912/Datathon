import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getPool} from './pool.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultMigrationsDirectory = resolve(moduleDirectory, '../../../../infra/postgres/migrations');

const migrationFilePattern = /^(\d+)_([a-z0-9_]+)\.sql$/i;

const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version varchar(32) PRIMARY KEY,
      name varchar(255) NOT NULL,
      checksum varchar(128) NOT NULL,
      executed_at timestamptz NOT NULL DEFAULT now(),
      execution_ms integer NOT NULL CHECK (execution_ms >= 0)
    )
  `);
};

const checksum = (sql) => createHash('sha256').update(sql, 'utf8').digest('hex');

export const discoverMigrations = async (migrationsDirectory = defaultMigrationsDirectory) => {
  const names = await readdir(migrationsDirectory);
  const migrationNames = names.filter((name) => migrationFilePattern.test(name)).sort((left, right) => left.localeCompare(right, undefined, {numeric: true}));

  return Promise.all(migrationNames.map(async (fileName) => {
    const match = fileName.match(migrationFilePattern);
    const sql = await readFile(resolve(migrationsDirectory, fileName), 'utf8');
    return {
      version: match[1],
      name: match[2],
      fileName,
      sql,
      checksum: checksum(sql),
    };
  }));
};

export const runMigrations = async (options = {}) => {
  const migrations = await discoverMigrations(options.migrationsDirectory);
  const pool = getPool();
  const client = await pool.connect();
  const result = {applied: [], skipped: []};

  try {
    await client.query("SELECT pg_advisory_lock(hashtext('kavach_schema_migrations'))");
    await ensureMigrationTable(client);

    for (const migration of migrations) {
      const previous = await client.query(
        'SELECT checksum, name FROM schema_migrations WHERE version = $1',
        [migration.version],
      );

      if (previous.rowCount > 0) {
        if (previous.rows[0].checksum !== migration.checksum || previous.rows[0].name !== migration.name) {
          throw new Error(`Migration ${migration.fileName} was changed after it had been applied. Create a new migration instead.`);
        }
        result.skipped.push(migration.fileName);
        continue;
      }

      const startedAt = performance.now();
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        const executionMs = Math.max(0, Math.round(performance.now() - startedAt));
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, migration.checksum, executionMs],
        );
        await client.query('COMMIT');
        result.applied.push(migration.fileName);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('kavach_schema_migrations'))");
    } finally {
      client.release();
    }
  }

  return result;
};
