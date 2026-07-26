import { describe, expect, it } from 'vitest';
import { profileColumn, profileDataset } from '../kavach/services/profiler.js';

describe('KAVACH Schema Profiler', () => {
  it('profiles string columns and identifies PII flags', () => {
    const values = ['Ramesh K.', 'Suresh L.', 'Nithin M.', null, ''];
    const result = profileColumn('suspect_name', values, 5);
    
    expect(result.sourceName).toBe('suspect_name');
    expect(result.inferredDataType).toBe('string');
    expect(result.nullablePercentage).toBe(40);
    expect(result.uniquenessPercentage).toBe(60);
    expect(result.isPotentialPII).toBe(true);
    expect(result.detectedSemanticMeaning).toBe('accused_name');
  });

  it('profiles numeric columns and calculates min, max, average stats', () => {
    const values = [10, 20, 30, 40, null];
    const result = profileColumn('stolen_value', values, 5);
    
    expect(result.inferredDataType).toBe('number');
    expect(result.min).toBe(10);
    expect(result.max).toBe(40);
    expect(result.avg).toBe(25);
    expect(result.nullablePercentage).toBe(20);
    expect(result.isPotentialPII).toBe(false);
  });

  it('profiles date columns and infers start and end date ranges', () => {
    const values = ['2026-06-01', '2026-06-15', '2026-06-30'];
    const result = profileColumn('incident_date', values, 3);
    
    expect(result.inferredDataType).toBe('date');
    expect(result.dateRange).toEqual({
      start: '2026-06-01',
      end: '2026-06-30'
    });
    expect(result.detectedSemanticMeaning).toBe('incident_date');
  });

  it('profiles entire dataset and returns structured profiles', () => {
    const dataset = [
      { fir_no: 'FIR-001', district: 'MYSORE', lat: 12.31 },
      { fir_no: 'FIR-002', district: 'MYSORE', lat: 12.32 }
    ];
    const result = profileDataset(dataset);
    
    expect(result.length).toBe(3);
    expect(result[0].detectedSemanticMeaning).toBe('fir_number');
    expect(result[1].detectedSemanticMeaning).toBe('district');
    expect(result[2].detectedSemanticMeaning).toBe('latitude');
  });
});
