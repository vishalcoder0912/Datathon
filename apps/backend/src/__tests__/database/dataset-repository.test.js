import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, dropTestDatabase, runMigrations, seedTestData } from './helpers.js';

let dbEnv;

beforeAll(() => {
  dbEnv = createTestDatabase();
  runMigrations();
});

afterAll(() => {
  dropTestDatabase();
  if (dbEnv) dbEnv.restore();
});

describe('Dataset Repository', () => {
  let repo;
  let createDataset, getDatasetById, listDatasets, deleteDataset, getDatasetRecord;

  beforeAll(async () => {
    const mod = await import('../../database/dataset-repository.js');
    createDataset = mod.createDataset;
    getDatasetById = mod.getDatasetById;
    listDatasets = mod.listDatasets;
    deleteDataset = mod.deleteDataset;
    repo = mod;
  });

  it('inserts a dataset and verifies stored data', () => {
    const ds = createDataset({
      name: 'Insertion Test',
      columns: [{ name: 'col1', type: 'string' }],
      rows: [{ col1: 'a' }, { col1: 'b' }],
      sourceType: 'upload',
    });
    expect(ds).toBeTruthy();
    expect(ds.id).toBeTruthy();
    expect(ds.name).toBe('Insertion Test');
    expect(ds.rowCount).toBe(2);
    expect(ds.columns).toHaveLength(1);
    expect(ds.rows).toHaveLength(2);
  });

  it('queries a dataset by id and returns correct data', () => {
    const ds = createDataset({
      name: 'Query Test',
      columns: [{ name: 'x', type: 'number' }],
      rows: [{ x: 10 }, { x: 20 }, { x: 30 }],
      sourceType: 'upload',
    });
    const found = getDatasetById(ds.id);
    expect(found).toBeTruthy();
    expect(found.id).toBe(ds.id);
    expect(found.name).toBe('Query Test');
    expect(found.rows).toHaveLength(3);
    expect(found.columns).toHaveLength(1);
  });

  it('returns null for non-existent dataset id', () => {
    const found = getDatasetById('non-existent-id-' + Date.now());
    expect(found).toBeNull();
  });

  it('lists all datasets', () => {
    const list = listDatasets();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('deletes a dataset and it is no longer queryable', () => {
    const ds = createDataset({
      name: 'Delete Test',
      columns: [{ name: 'v', type: 'string' }],
      rows: [{ v: 'delete-me' }],
      sourceType: 'upload',
    });
    const id = ds.id;
    expect(getDatasetById(id)).toBeTruthy();

    const deleted = deleteDataset(id);
    expect(deleted).toBe(true);

    expect(getDatasetById(id)).toBeNull();
  });

  it('returns false when deleting non-existent dataset', () => {
    const result = deleteDataset('does-not-exist-' + Date.now());
    expect(result).toBe(false);
  });

  it('stores an empty dataset with 0 rows', () => {
    const ds = createDataset({
      name: 'Empty Dataset',
      columns: [{ name: 'empty_col', type: 'string' }],
      rows: [],
      sourceType: 'upload',
    });
    expect(ds.rowCount).toBe(0);
    expect(ds.rows).toHaveLength(0);
    const found = getDatasetById(ds.id);
    expect(found).toBeTruthy();
    expect(found.rowCount).toBe(0);
    expect(found.rows).toHaveLength(0);
  });

  it('handles dataset with special characters in names', () => {
    const ds = createDataset({
      name: 'Special Chárs & Symbols 🚀',
      columns: [{ name: '测试列', type: 'string' }],
      rows: [{ '测试列': 'value-中文' }],
      sourceType: 'upload',
    });
    expect(ds).toBeTruthy();
    expect(ds.name).toBe('Special Chárs & Symbols 🚀');
    const found = getDatasetById(ds.id);
    expect(found).toBeTruthy();
  });

  it('handles large number of columns (50 columns)', () => {
    const columns = Array.from({ length: 50 }, (_, i) => ({ name: `col_${i}`, type: 'string' }));
    const row = Object.fromEntries(columns.map(c => [c.name, `val`]));
    const rows = Array.from({ length: 10 }, () => ({ ...row }));
    const ds = createDataset({
      name: 'Wide Dataset',
      columns,
      rows,
      sourceType: 'upload',
    });
    expect(ds.columns).toHaveLength(50);
    expect(ds.rowCount).toBe(10);
  });

  it('handles duplicate column names gracefully', () => {
    const ds = createDataset({
      name: 'Dup Cols',
      columns: [{ name: 'dup', type: 'string' }, { name: 'dup', type: 'string' }],
      rows: [{ dup: 'a' }, { dup: 'b' }],
      sourceType: 'upload',
    });
    expect(ds).toBeTruthy();
    expect(ds.columns).toHaveLength(2);
  });

  it('stores rows with null values correctly', () => {
    const ds = createDataset({
      name: 'Null Values',
      columns: [{ name: 'a', type: 'string' }, { name: 'b', type: 'number' }],
      rows: [{ a: 'hello', b: null }, { a: null, b: 42 }],
      sourceType: 'upload',
    });
    const found = getDatasetById(ds.id);
    expect(found.rows[0].a).toBe('hello');
    expect(found.rows[0].b).toBeNull();
    expect(found.rows[1].a).toBeNull();
    expect(found.rows[1].b).toBe(42);
  });
});
