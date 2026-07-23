import { z } from 'zod';

export const KAVACH_IMPORT_SOURCE_TYPES = Object.freeze([
  'CaseMaster', 'ComplainantDetails', 'Victim', 'Accused', 'ArrestSurrender',
  'ActSectionAssociation', 'ChargesheetDetails', 'District', 'Unit', 'Employee',
  'SocioeconomicIndicators',
]);

const importPayloadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  sourceType: z.enum(KAVACH_IMPORT_SOURCE_TYPES),
  rows: z.array(z.record(z.unknown())).max(10_000).default([]),
  mapping: z.record(z.string()).default({}),
}).passthrough();

const validGenderCodes = new Set(['M', 'F', 'T', 'U']);
const validReportTypes = new Set(['A', 'B', 'C']);

function field(row, mapping, canonical) {
  const configured = mapping[canonical];
  const candidates = [configured, canonical, canonical.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())].filter(Boolean);
  for (const candidate of candidates) {
    if (row[candidate] !== undefined && row[candidate] !== null && String(row[candidate]).trim() !== '') return row[candidate];
  }
  return null;
}

function validDate(value) {
  return value && !Number.isNaN(Date.parse(String(value)));
}

function addError(errors, rowNumber, columnName, errorCode, errorMessage, rawValue) {
  errors.push({
    rowNumber,
    columnName,
    errorCode,
    errorMessage,
    rawValue: rawValue === undefined || rawValue === null ? null : String(rawValue).slice(0, 500),
  });
}

function validateRow(sourceType, row, mapping, rowNumber, errors) {
  const before = errors.length;
  const age = field(row, mapping, 'age_year') ?? field(row, mapping, 'age');
  const gender = field(row, mapping, 'gender_code') ?? field(row, mapping, 'gender');

  if (['CaseMaster', 'ComplainantDetails', 'Victim', 'Accused'].includes(sourceType) && age !== null) {
    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 0 || numericAge > 120) addError(errors, rowNumber, 'age_year', 'INVALID_AGE', 'Age must be a whole number between 0 and 120.', age);
  }
  if (gender !== null && !validGenderCodes.has(String(gender).trim().toUpperCase())) addError(errors, rowNumber, 'gender_code', 'UNKNOWN_GENDER', 'Gender code must be M, F, T, or U.', gender);

  if (sourceType === 'CaseMaster') {
    const crimeNo = field(row, mapping, 'crime_no') ?? field(row, mapping, 'fir_number');
    const latitude = field(row, mapping, 'latitude');
    const longitude = field(row, mapping, 'longitude');
    const incidentFrom = field(row, mapping, 'incident_from_at') ?? field(row, mapping, 'incident_date');
    const incidentTo = field(row, mapping, 'incident_to_at');
    const registeredAt = field(row, mapping, 'crime_registered_at') ?? field(row, mapping, 'registered_date');
    const informationAt = field(row, mapping, 'info_received_ps_at');
    const caseStatus = field(row, mapping, 'case_status') ?? field(row, mapping, 'status');

    if (crimeNo && !/^\d{18}$/.test(String(crimeNo))) addError(errors, rowNumber, 'crime_no', 'INVALID_CRIME_NUMBER', 'Crime number must contain exactly 18 digits.', crimeNo);
    if (!caseStatus) addError(errors, rowNumber, 'case_status', 'MISSING_CASE_STATUS', 'A case status is required.', caseStatus);
    if ((latitude === null) !== (longitude === null)) addError(errors, rowNumber, 'coordinates', 'INCOMPLETE_COORDINATES', 'Latitude and longitude must be supplied together.', `${latitude ?? ''},${longitude ?? ''}`);
    if (latitude !== null && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) addError(errors, rowNumber, 'latitude', 'INVALID_LATITUDE', 'Latitude must be between -90 and 90.', latitude);
    if (longitude !== null && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) addError(errors, rowNumber, 'longitude', 'INVALID_LONGITUDE', 'Longitude must be between -180 and 180.', longitude);
    if (incidentFrom && !validDate(incidentFrom)) addError(errors, rowNumber, 'incident_from_at', 'INVALID_DATE', 'Incident start time is invalid.', incidentFrom);
    if (incidentTo && !validDate(incidentTo)) addError(errors, rowNumber, 'incident_to_at', 'INVALID_DATE', 'Incident end time is invalid.', incidentTo);
    if (incidentFrom && incidentTo && validDate(incidentFrom) && validDate(incidentTo) && new Date(incidentTo) < new Date(incidentFrom)) addError(errors, rowNumber, 'incident_to_at', 'INVALID_DATE_RANGE', 'Incident end time cannot be before incident start time.', incidentTo);
    if (informationAt && registeredAt && validDate(informationAt) && validDate(registeredAt) && new Date(registeredAt) < new Date(informationAt)) addError(errors, rowNumber, 'crime_registered_at', 'INVALID_REGISTRATION_RANGE', 'Registration time cannot be before information receipt time.', registeredAt);
  }
  if (sourceType === 'ActSectionAssociation') {
    if (!field(row, mapping, 'act_code')) addError(errors, rowNumber, 'act_code', 'MISSING_ACT', 'Act code is required.', null);
    if (!field(row, mapping, 'section_code')) addError(errors, rowNumber, 'section_code', 'MISSING_SECTION', 'Section code is required.', null);
  }
  if (sourceType === 'ChargesheetDetails') {
    const reportType = field(row, mapping, 'report_type');
    if (!reportType || !validReportTypes.has(String(reportType).trim().toUpperCase())) addError(errors, rowNumber, 'report_type', 'INVALID_REPORT_TYPE', 'Report type must be A, B, or C.', reportType);
  }
  if (sourceType === 'SocioeconomicIndicators') {
    const population = field(row, mapping, 'population');
    if (population !== null && (!Number.isFinite(Number(population)) || Number(population) < 0)) addError(errors, rowNumber, 'population', 'INVALID_POPULATION', 'Population must be a non-negative number.', population);
  }
  return errors.length === before;
}

export function validateKavachImport(payload) {
  const parsed = importPayloadSchema.safeParse(payload);
  if (!parsed.success) return { valid: false, errors: [{ rowNumber: 0, columnName: null, errorCode: 'INVALID_IMPORT_PAYLOAD', errorMessage: 'Filename, supported source type, and rows are required.', rawValue: null }] };
  const { sourceType, rows, mapping } = parsed.data;
  const errors = [];
  let acceptedRows = 0;
  rows.forEach((row, index) => {
    if (validateRow(sourceType, row, mapping, index + 2, errors)) acceptedRows += 1;
  });
  return {
    valid: true,
    payload: parsed.data,
    totalRows: rows.length,
    acceptedRows,
    rejectedRows: rows.length - acceptedRows,
    duplicateRows: 0,
    errors,
    previewRows: rows.slice(0, 20),
  };
}

