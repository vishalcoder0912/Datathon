import { describe, expect, it } from 'vitest';
import { validateKavachImport } from '../kavach/validators/import-validator.js';

describe('KAVACH import validation', () => {
  it('accepts a valid CaseMaster preview row', () => {
    const result = validateKavachImport({
      filename: 'synthetic-cases.csv',
      sourceType: 'CaseMaster',
      rows: [{ crime_no: '104430006202600001', case_status: 'PENDING', latitude: '12.9716', longitude: '77.5946', incident_from_at: '2026-01-01T10:00:00Z', incident_to_at: '2026-01-01T11:00:00Z' }],
    });
    expect(result.valid).toBe(true);
    expect(result.acceptedRows).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('reports invalid numbers, coordinates, dates, and report types instead of discarding rows', () => {
    const cases = validateKavachImport({
      filename: 'broken.csv', sourceType: 'CaseMaster',
      rows: [{ crime_no: 'FIR-X', case_status: '', latitude: '200', longitude: '', incident_from_at: '2026-02-02T10:00:00Z', incident_to_at: '2026-02-01T10:00:00Z' }],
    });
    expect(cases.acceptedRows).toBe(0);
    expect(cases.rejectedRows).toBe(1);
    expect(cases.errors.map((error) => error.errorCode)).toEqual(expect.arrayContaining(['INVALID_CRIME_NUMBER', 'MISSING_CASE_STATUS', 'INCOMPLETE_COORDINATES', 'INVALID_LATITUDE', 'INVALID_DATE_RANGE']));

    const chargesheets = validateKavachImport({ filename: 'charges.csv', sourceType: 'ChargesheetDetails', rows: [{ report_type: 'X' }] });
    expect(chargesheets.errors[0].errorCode).toBe('INVALID_REPORT_TYPE');
  });
});

