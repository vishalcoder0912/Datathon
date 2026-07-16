import { describe, it, expect } from 'vitest';
import { normalizeDistrictName, detectMappings, validateRequiredColumns, PIIMask } from '../normalization.js';

describe('normalizeDistrictName', () => {
  it('returns null for null/undefined input', () => {
    expect(normalizeDistrictName(null)).toBeNull();
    expect(normalizeDistrictName(undefined)).toBeNull();
    expect(normalizeDistrictName('')).toBeNull();
  });

  it('normalizes full district names with proper casing', () => {
    expect(normalizeDistrictName('bengaluru urban')).toBe('Bengaluru Urban');
    expect(normalizeDistrictName('BENGALURU RURAL')).toBe('Bengaluru Rural');
    expect(normalizeDistrictName('Belagavi')).toBe('Belagavi');
  });

  it('resolves aliases to canonical names', () => {
    expect(normalizeDistrictName('bangalore')).toBe('Bengaluru Urban');
    expect(normalizeDistrictName('bangalore urban')).toBe('Bengaluru Urban');
    expect(normalizeDistrictName('belgaum')).toBe('Belagavi');
    expect(normalizeDistrictName('bellary')).toBe('Ballari');
    expect(normalizeDistrictName('mysore')).toBe('Mysuru');
    expect(normalizeDistrictName('shimoga')).toBe('Shivamogga');
    expect(normalizeDistrictName('tumkur')).toBe('Tumakuru');
    expect(normalizeDistrictName('gulbarga')).toBe('Kalaburagi');
    expect(normalizeDistrictName('bijapur')).toBe('Vijayapura');
    expect(normalizeDistrictName('coorg')).toBe('Kodagu');
    expect(normalizeDistrictName('north kannada')).toBe('Uttara Kannada');
    expect(normalizeDistrictName('south kannada')).toBe('Dakshina Kannada');
    expect(normalizeDistrictName('chickballapur')).toBe('Chikkaballapur');
    expect(normalizeDistrictName('chikmagalur')).toBe('Chikkamagaluru');
    expect(normalizeDistrictName('karwar')).toBe('Uttara Kannada');
    expect(normalizeDistrictName('yadgir')).toBe('Yadgiri');
  });

  it('trims whitespace', () => {
    expect(normalizeDistrictName('  bangalore  ')).toBe('Bengaluru Urban');
    expect(normalizeDistrictName('\tmysore\n')).toBe('Mysuru');
  });

  it('returns null for unknown district names', () => {
    expect(normalizeDistrictName('unknown')).toBeNull();
    expect(normalizeDistrictName('New York')).toBeNull();
    expect(normalizeDistrictName('Mumbai')).toBeNull();
  });
});

describe('detectMappings', () => {
  it('detects exact column matches with high confidence', () => {
    const columns = ['FIR_No', 'Crime_Category', 'District_Name', 'Incident_Date'];
    const mappings = detectMappings(columns);
    expect(mappings.fir_number).toEqual({ column: 'FIR_No', confidence: 0.95 });
    expect(mappings.crime_type).toEqual({ column: 'Crime_Category', confidence: 0.95 });
    expect(mappings.district).toEqual({ column: 'District_Name', confidence: 0.95 });
    expect(mappings.incident_date).toEqual({ column: 'Incident_Date', confidence: 0.95 });
  });

  it('detects fuzzy matches with lower confidence', () => {
    const columns = ['crimecat', 'victim_info', 'station_info'];
    const mappings = detectMappings(columns);
    expect(mappings.crime_type).toBeDefined();
    expect(mappings.crime_type.confidence).toBe(0.7);
    expect(mappings.victim_name).toBeDefined();
    expect(mappings.victim_name.confidence).toBe(0.7);
    expect(mappings.police_station).toBeDefined();
    expect(mappings.police_station.confidence).toBe(0.7);
  });

  it('handles underscore/space/hyphen variations', () => {
    const columns = ['firNumber', 'crime-type', 'police_station'];
    const mappings = detectMappings(columns);
    expect(mappings.fir_number).toEqual({ column: 'firNumber', confidence: 0.95 });
    expect(mappings.crime_type).toBeDefined();
    expect(mappings.police_station).toBeDefined();
  });

  it('returns empty object for no matching columns', () => {
    const mappings = detectMappings(['col1', 'col2', 'col3']);
    expect(Object.keys(mappings)).toHaveLength(0);
  });

  it('maps multiple schema columns correctly', () => {
    const columns = ['FIR_No', 'offence_type', 'PS_Name', 'district', 'Accused_ID', 'crime_date', 'time'];
    const mappings = detectMappings(columns);
    expect(Object.keys(mappings).length).toBeGreaterThanOrEqual(6);
    expect(mappings.fir_number).toBeDefined();
    expect(mappings.crime_type).toBeDefined();
    expect(mappings.police_station).toBeDefined();
    expect(mappings.district).toBeDefined();
    expect(mappings.offender_id).toBeDefined();
    expect(mappings.incident_date).toBeDefined();
    expect(mappings.incident_time).toBeDefined();
  });
});

describe('validateRequiredColumns', () => {
  it('returns empty array when all required columns present', () => {
    const row = { fir_number: 'FIR001', crime_type: 'Theft', incident_date: '2024-01-01', district: 'Bengaluru Urban' };
    expect(validateRequiredColumns(row)).toEqual([]);
  });

  it('returns missing columns when fields are empty/null', () => {
    const row = { fir_number: '', crime_type: null, incident_date: undefined, district: 'Bengaluru Urban' };
    const missing = validateRequiredColumns(row);
    expect(missing).toContain('fir_number');
    expect(missing).toContain('crime_type');
    expect(missing).toContain('incident_date');
    expect(missing).not.toContain('district');
  });

  it('returns all required when row is empty', () => {
    const missing = validateRequiredColumns({});
    expect(missing).toEqual(['fir_number', 'crime_type', 'incident_date', 'district']);
  });

  it('identifies only specific missing fields', () => {
    const row = { fir_number: 'FIR001', crime_type: 'Robbery', incident_date: '2024-06-15' };
    const missing = validateRequiredColumns(row);
    expect(missing).toEqual(['district']);
  });
});

describe('PIIMask', () => {
  describe('name masking', () => {
    it('masks names with first and last characters visible', () => {
      expect(PIIMask('Rajesh Kumar', 'name')).toBe('R****h K***r');
    });

    it('handles single-word names', () => {
      expect(PIIMask('Raju', 'name')).toBe('R**u');
    });

    it('handles short names (2 chars or less)', () => {
      expect(PIIMask('An', 'name')).toBe('An');
      expect(PIIMask('A', 'name')).toBe('A');
    });

    it('returns null/undefined untouched', () => {
      expect(PIIMask(null, 'name')).toBeNull();
      expect(PIIMask(undefined, 'name')).toBeUndefined();
    });
  });

  describe('phone masking', () => {
    it('shows first 2 and last 2 digits', () => {
      expect(PIIMask('9876543210', 'phone')).toBe('98****10');
    });

    it('handles short phone numbers', () => {
      expect(PIIMask('1234', 'phone')).toBe('12****34');
    });
  });

  describe('vehicle masking', () => {
    it('shows first 2 and last 3 characters', () => {
      expect(PIIMask('KA01AB1234', 'vehicle')).toBe('KA**234');
    });

    it('handles short vehicle numbers', () => {
      expect(PIIMask('KA01', 'vehicle')).toBe('KA**A01');
    });
  });
});
