import 'dotenv/config';
import {afterAll, describe, expect, it} from 'vitest';
import {discoverMigrations} from '../../db/migration-runner.js';
import {createFilterBuilder, parsePagination} from '../../db/sql-filters.js';

describe('KAVACH PostgreSQL integration contract', () => {
  it('discovers the ordered, checksummed PostGIS migration set', async () => {
    const migrations = await discoverMigrations();
    expect(migrations.map((migration) => migration.fileName)).toEqual([
      '001_extensions.sql',
      '002_reference_tables.sql',
      '003_case_tables.sql',
      '004_identity_tables.sql',
      '005_analytics_tables.sql',
      '006_security_tables.sql',
      '007_indexes.sql',
      '008_views.sql',
      '009_functions.sql',
      '010_seed_reference_data.sql',
    ]);
    expect(migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum))).toBe(true);
  });

  it('builds parameterized scope and pagination filters', () => {
    const filters = createFilterBuilder();
    filters.equals('vi.district_id', 31).dateRange('vi.incident_date', '2026-01-01', '2026-01-31');
    expect(filters.whereClause).toBe('WHERE vi.district_id = $1 AND vi.incident_date >= $2 AND vi.incident_date <= $3');
    expect(filters.parameters).toEqual([31, '2026-01-01', '2026-01-31']);
    expect(parsePagination({page: '3', pageSize: '500'})).toMatchObject({page: 3, pageSize: 100, offset: 200});
  });
});

const databaseIt = process.env.DATABASE_URL ? it : it.skip;

describe('KAVACH live PostgreSQL/PostGIS integration', () => {
  let closePool;

  afterAll(async () => {
    if (closePool) await closePool();
  });

  databaseIt('applies the migration history idempotently and exposes PostGIS', async () => {
    const database = await import('../../db/pool.js');
    const migrations = await import('../../db/migration-runner.js');
    closePool = database.closePool;

    await migrations.runMigrations();
    const secondRun = await migrations.runMigrations();
    const postgis = await database.query('SELECT postgis_version() AS version');
    const history = await database.query('SELECT COUNT(*)::integer AS count FROM schema_migrations');

    expect(secondRun.applied).toEqual([]);
    expect(postgis.rows[0].version).toBeTruthy();
    expect(history.rows[0].count).toBe(10);
  }, 120_000);
});
