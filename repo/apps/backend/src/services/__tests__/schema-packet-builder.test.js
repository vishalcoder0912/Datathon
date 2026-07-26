import { describe, it, expect } from 'vitest';
import {
  buildSchemaPacket,
  formatSchemaForPrompt,
  validateColumnsExist,
  getDataQualityScore,
} from '../schema-packet-builder.js';

describe('Schema Packet Builder', () => {
  const mockDataset = {
    name: 'Test Dataset',
    rowCount: 100,
    columns: [
      { name: 'age', type: 'number' },
      { name: 'category', type: 'string' },
    ],
    rows: Array.from({ length: 100 }, (_, i) => ({
      age: Math.floor(Math.random() * 60) + 20,
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
    })),
  };

  it('builds valid schema packet', () => {
    const packet = buildSchemaPacket(mockDataset);
    expect(packet).toBeDefined();
    expect(packet.name).toBe('Test Dataset');
    expect(packet.rowCount).toBe(100);
    expect(packet.columns.length).toBe(2);
  });

  it('extracts numeric statistics', () => {
    const packet = buildSchemaPacket(mockDataset);
    const ageColumn = packet.columns.find(c => c.name === 'age');
    expect(ageColumn.type).toBe('numeric');
    expect(ageColumn.isValid).toBe(true);
    expect(ageColumn.min).toBeLessThan(ageColumn.max);
    expect(ageColumn.mean).toBeGreaterThan(0);
  });

  it('extracts categorical statistics', () => {
    const packet = buildSchemaPacket(mockDataset);
    const catColumn = packet.columns.find(c => c.name === 'category');
    expect(catColumn.type).toBe('categorical');
    expect(catColumn.isValid).toBe(true);
    expect(Object.keys(catColumn.topValues).length).toBeGreaterThan(0);
  });

  it('handles empty datasets', () => {
    expect(() => {
      buildSchemaPacket({ ...mockDataset, rows: [] });
    }).toThrow();
  });

  it('validates columns exist', () => {
    const packet = buildSchemaPacket(mockDataset);
    expect(() => {
      validateColumnsExist(['age', 'category'], packet);
    }).not.toThrow();
  });

  it('rejects invalid columns', () => {
    const packet = buildSchemaPacket(mockDataset);
    expect(() => {
      validateColumnsExist(['age', 'invalid_column'], packet);
    }).toThrow();
  });

  it('calculates data quality score', () => {
    const packet = buildSchemaPacket(mockDataset);
    const score = getDataQualityScore(packet);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('formats schema for prompt', () => {
    const packet = buildSchemaPacket(mockDataset);
    const text = formatSchemaForPrompt(packet);
    expect(text).toContain('Test Dataset');
    expect(text).toContain('age');
    expect(text).toContain('category');
  });
});
