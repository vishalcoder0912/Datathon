import { KARNATAKA_DISTRICTS } from './enums.js';

export const SCHEMA_MAPPINGS = Object.freeze({
  fir_number: ['FIR_No', 'firNumber', 'FIRNumber', 'case_id', 'case_no', 'Crime_No'],
  crime_type: ['Crime_Category', 'offence_type', 'offense_type', 'crimeType', 'crime_category', 'offence', 'crime'],
  police_station: ['Police_Station', 'PS_Name', 'station', 'police_station_name', 'ps_name', 'station_name'],
  district: ['District_Name', 'districtName', 'district_name', 'district'],
  offender_id: ['Accused_ID', 'offender_id', 'criminal_id', 'accused_id', 'suspect_id'],
  incident_date: ['Incident_Date', 'occurrence_date', 'date_of_occurrence', 'crime_date', 'date'],
  incident_time: ['Incident_Time', 'occurrence_time', 'time_of_occurrence', 'crime_time', 'time'],
  severity: ['Severity', 'crime_severity', 'severity_level', 'offence_severity'],
  status: ['Status', 'investigation_status', 'case_status', 'current_status'],
  latitude: ['Latitude', 'lat', 'latitude'],
  longitude: ['Longitude', 'lng', 'long', 'longitude'],
  description: ['Description', 'incident_description', 'narrative', 'details'],
  modus_operandi: ['Modus_Operandi', 'MO', 'm_o', 'modus_operandi', 'method'],
  victim_name: ['Victim_Name', 'victim', 'victim_name', 'complainant'],
  accused_name: ['Accused_Name', 'accused', 'suspect_name', 'offender_name'],
});

export function detectMappings(columns) {
  const mappings = {};
  const columnLower = columns.map((c, i) => ({ name: c, index: i, lower: c.toLowerCase().replace(/[\s_-]/g, '') }));

  for (const [canonical, alternatives] of Object.entries(SCHEMA_MAPPINGS)) {
    const altLower = alternatives.map((a) => a.toLowerCase().replace(/[\s_-]/g, ''));
    for (const col of columnLower) {
      if (altLower.includes(col.lower)) {
        mappings[canonical] = { column: col.name, confidence: 0.95 };
        break;
      }
    }
  }

  for (const col of columnLower) {
    if (mappings[col.name]) continue;
    for (const [canonical, alternatives] of Object.entries(SCHEMA_MAPPINGS)) {
      if (mappings[canonical]) continue;
      for (const alt of alternatives) {
        const altNorm = alt.toLowerCase().replace(/[\s_-]/g, '');
        if (col.lower.includes(altNorm) || altNorm.includes(col.lower)) {
          mappings[canonical] = { column: col.name, confidence: 0.7 };
          break;
        }
      }
      if (mappings[canonical]) break;
    }
  }

  return mappings;
}

const DISTRICT_ALIASES = Object.freeze({
  'bengaluru urban': 'Bengaluru Urban',
  'bengaluru': 'Bengaluru Urban',
  'bangalore': 'Bengaluru Urban',
  'bangalore urban': 'Bengaluru Urban',
  'bengaluru rural': 'Bengaluru Rural',
  'bangalore rural': 'Bengaluru Rural',
  'belagavi': 'Belagavi',
  'belgaum': 'Belagavi',
  'ballari': 'Ballari',
  'bellary': 'Ballari',
  'bidar': 'Bidar',
  'chamarajanagar': 'Chamarajanagar',
  'chikkaballapur': 'Chikkaballapur',
  'chickballapur': 'Chikkaballapur',
  'chikkamagaluru': 'Chikkamagaluru',
  'chikmagalur': 'Chikkamagaluru',
  'chitradurga': 'Chitradurga',
  'dakshina kannada': 'Dakshina Kannada',
  'dakshin kannada': 'Dakshina Kannada',
  'south kannada': 'Dakshina Kannada',
  'davanagere': 'Davanagere',
  'dharwad': 'Dharwad',
  'gadag': 'Gadag',
  'hassan': 'Hassan',
  'haveri': 'Haveri',
  'kalaburagi': 'Kalaburagi',
  'gulbarga': 'Kalaburagi',
  'kodagu': 'Kodagu',
  'coorg': 'Kodagu',
  'kolar': 'Kolar',
  'koppal': 'Koppal',
  'mandya': 'Mandya',
  'mysuru': 'Mysuru',
  'mysore': 'Mysuru',
  'raichur': 'Raichur',
  'ramanagara': 'Ramanagara',
  'shivamogga': 'Shivamogga',
  'shimoga': 'Shivamogga',
  'tumakuru': 'Tumakuru',
  'tumkur': 'Tumakuru',
  'udupi': 'Udupi',
  'uttara kannada': 'Uttara Kannada',
  'north kannada': 'Uttara Kannada',
  'karwar': 'Uttara Kannada',
  'vijayanagara': 'Vijayanagara',
  'vijayapura': 'Vijayapura',
  'bijapur': 'Vijayapura',
  'yadgiri': 'Yadgiri',
  'yadgir': 'Yadgiri',
});

export function normalizeDistrictName(name) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return DISTRICT_ALIASES[normalized] || null;
}

export function normalizeColumnRow(row, mappings) {
  const result = {};
  for (const [canonical, mapping] of Object.entries(mappings)) {
    result[canonical] = row[mapping.column] !== undefined ? row[mapping.column] : undefined;
  }
  return result;
}

export function validateRequiredColumns(normalizedRow) {
  const required = ['fir_number', 'crime_type', 'incident_date', 'district'];
  const missing = required.filter((r) => !normalizedRow[r]);
  return missing;
}

export function PIIMask(value, type = 'name') {
  if (!value) return value;
  if (type === 'name') {
    const parts = value.split(' ');
    return parts.map((p) => (p.length > 2 ? p[0] + '*'.repeat(p.length - 2) + p[p.length - 1] : p)).join(' ');
  }
  if (type === 'phone') {
    return value.slice(0, 2) + '****' + value.slice(-2);
  }
  if (type === 'vehicle') {
    return value.slice(0, 2) + '**' + value.slice(-3);
  }
  return value;
}
