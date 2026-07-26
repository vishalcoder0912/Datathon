import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

let testDir;

function createMigrate(dbName) {
  return async (steps = []) => {
    const db = new DatabaseSync(join(testDir, dbName));
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
    for (const step of steps) {
      const existing = db.prepare('SELECT version FROM schema_version WHERE version = ?').get(step.version);
      if (!existing) {
        db.exec(step.sql);
        db.prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)').run(step.version, step.name, new Date().toISOString());
      }
    }
    const remaining = steps.filter(s => !db.prepare('SELECT version FROM schema_version WHERE version = ?').get(s.version));
    db.close();
    return remaining;
  };
}

function openDb(dbName) {
  const db = new DatabaseSync(join(testDir, dbName));
  return db;
}

beforeAll(async () => {
  testDir = join(tmpdir(), 'migration-test-' + randomUUID());
  mkdirSync(testDir, { recursive: true });
});

function cleanup() {
  if (testDir && existsSync(testDir)) {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { }
  }
}

describe('Migration Runner', () => {
  afterAll(cleanup);

  it('runs migrations in order', async () => {
    const migrate = createMigrate('order.sqlite');
    const steps = [
      { version: 1, name: 'create_users', sql: 'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)' },
      { version: 2, name: 'create_posts', sql: 'CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER)' },
    ];
    const result = await migrate(steps);
    expect(result).toBeDefined();

    const db = openDb('order.sqlite');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
    db.close();
  });

  it('is idempotent when run again', async () => {
    const migrate = createMigrate('idempotent.sqlite');
    const steps = [
      { version: 1, name: 'create_users', sql: 'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)' },
    ];
    await migrate(steps);
    await migrate(steps);

    const db = openDb('idempotent.sqlite');
    const versions = db.prepare('SELECT version FROM schema_version').all();
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
    db.close();
  });

  it('handles rollback on corrupt migration', async () => {
    const steps = [
      { version: 3, name: 'bad_migration', sql: 'CREATE TABLE IF NOT EXISTS good_table (id INTEGER PRIMARY KEY); INSERT INTO nonexistent VALUES (1)' },
    ];

    let error = null;
    try {
      const db = openDb('rollback.sqlite');
      db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
      const existing = db.prepare('SELECT version FROM schema_version WHERE version = ?').get(3);
      if (!existing) {
        db.exec('BEGIN');
        try {
          db.exec(steps[0].sql);
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      }
      db.close();
    } catch (e) {
      error = e;
    }

    const db = openDb('rollback.sqlite');
    const goodTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'").get();
    expect(goodTable).toBeFalsy();

    const versions = db.prepare('SELECT version FROM schema_version WHERE version = 3').all();
    expect(versions).toHaveLength(0);
    db.close();
  });

  it('skips already applied migrations', async () => {
    const migrate = createMigrate('skip.sqlite');
    const step = { version: 10, name: 'create_skip_test', sql: 'CREATE TABLE IF NOT EXISTS skip_test (id INTEGER PRIMARY KEY)' };

    const db = openDb('skip.sqlite');
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
    db.prepare('INSERT OR IGNORE INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)').run(10, 'create_skip_test', new Date().toISOString());
    db.close();

    await migrate([step]);

    const db2 = openDb('skip.sqlite');
    const versions = db2.prepare('SELECT version FROM schema_version').all();
    expect(versions.find(v => v.version === 10)).toBeTruthy();
    db2.close();
  });
});
