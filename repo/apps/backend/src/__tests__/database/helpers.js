import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

let testDataDir = '';

export function createTestDatabase() {
  testDataDir = join(tmpdir(), 'insightflow-test-' + randomUUID());
  mkdirSync(testDataDir, { recursive: true });
  const originalDataDir = process.env.DATA_DIR;
  const originalDbPath = process.env.DATABASE_PATH;

  process.env.DATA_DIR = testDataDir;
  process.env.DATABASE_PATH = join(testDataDir, 'test-insightflow.sqlite');

  return {
    dataDir: testDataDir,
    dbPath: process.env.DATABASE_PATH,
    restore() {
      process.env.DATA_DIR = originalDataDir;
      process.env.DATABASE_PATH = originalDbPath;
    },
  };
}

export function dropTestDatabase() {
  try {
    if (testDataDir && existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch {
    // cleanup best-effort
  }
}

export function runMigrations() {
  const db = new DatabaseSync(process.env.DATABASE_PATH);

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, source_type TEXT NOT NULL,
      file_name TEXT, uploaded_at TEXT NOT NULL, row_count INTEGER NOT NULL,
      column_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dataset_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id TEXT NOT NULL,
      name TEXT NOT NULL, type TEXT NOT NULL, sample_json TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dataset_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id TEXT NOT NULL,
      row_index INTEGER NOT NULL, row_json TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, role TEXT NOT NULL,
      content TEXT NOT NULL, sql_text TEXT, chart_json TEXT,
      insights_json TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dataset_files (
      id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, file_path TEXT,
      optimized_path TEXT, size_bytes INTEGER DEFAULT 0, created_at TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dataset_schemas (
      id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, schema_json TEXT NOT NULL,
      profile_json TEXT NOT NULL, row_count INTEGER NOT NULL,
      column_count INTEGER NOT NULL, raw_rows_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS column_profiles (
      id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, schema_id TEXT NOT NULL,
      name TEXT NOT NULL, role TEXT, type TEXT, profile_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
      FOREIGN KEY(schema_id) REFERENCES dataset_schemas(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dashboard_artifacts (
      id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, pipeline_run_id TEXT,
      dashboard_json TEXT NOT NULL, raw_rows_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
  `);

  db.close();
}

export function seedTestData() {
  const db = new DatabaseSync(process.env.DATABASE_PATH);

  const now = new Date().toISOString();

  db.exec(`
    INSERT INTO datasets (id, name, source_type, file_name, uploaded_at, row_count, column_count)
    VALUES ('test-ds-1', 'Test Dataset', 'upload', 'test.csv', '${now}', 3, 2);

    INSERT INTO dataset_columns (dataset_id, name, type, sample_json)
    VALUES ('test-ds-1', 'name', 'string', '["Alice","Bob"]');

    INSERT INTO dataset_columns (dataset_id, name, type, sample_json)
    VALUES ('test-ds-1', 'score', 'number', '[95,87]');

    INSERT INTO dataset_rows (dataset_id, row_index, row_json)
    VALUES ('test-ds-1', 0, '{"name":"Alice","score":95}');

    INSERT INTO dataset_rows (dataset_id, row_index, row_json)
    VALUES ('test-ds-1', 1, '{"name":"Bob","score":87}');

    INSERT INTO dataset_rows (dataset_id, row_index, row_json)
    VALUES ('test-ds-1', 2, '{"name":"Charlie","score":92}');
  `);

  db.close();
}

export { testDataDir };
