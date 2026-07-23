import "dotenv/config";
import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {closePool, getPool} from "../apps/backend/src/db/pool.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoDirectory = resolve(projectRoot, "data/demo");
const reportPath = resolve(projectRoot, "reports/demo-data-migration-report.json");
const sourceSystem = "KAVACH_SYNTHETIC_DEMO";
const nowYear = new Date().getUTCFullYear();
const caseCategoryId = 1;
const defaultIdentityConfidence = 0.8;
const defaultRoleConfidence = 0.9;
const maximumGeneratedIdentifiersInReport = 2_000;

const report = {
  source: {
    sourceSystem,
    files: {},
    rowCounts: {},
  },
  inserted: {},
  updated: {},
  skipped: {},
  duplicate: {},
  invalidRows: [],
  generatedIdentifiers: [],
  foreignKeyFailures: [],
  completedAt: null,
};

function increment(group, key) {
  group[key] = (group[key] ?? 0) + 1;
}

function countInserted(key) {
  increment(report.inserted, key);
}

function countUpdated(key) {
  increment(report.updated, key);
}

function countSkipped(key) {
  increment(report.skipped, key);
}

function countDuplicate(key) {
  increment(report.duplicate, key);
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "").map((header) => header.trim());
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
}

function hashValue(value) {
  if (!value) return null;
  const pepper = process.env.KAVACH_HASH_PEPPER ?? "synthetic-kavach-demo-pepper";
  return createHash("sha256").update(`${pepper}:${value}`, "utf8").digest("hex");
}

function normalizeName(value) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function parseDateTime(date, time = "00:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function daypartFromTime(time) {
  const hour = Number.parseInt(time?.slice(0, 2) ?? "", 10);
  if (!Number.isFinite(hour)) return "UNKNOWN";
  if (hour < 6) return "EARLY_MORNING";
  if (hour < 12) return "MORNING";
  if (hour < 18) return "AFTERNOON";
  return "NIGHT";
}

function asFiniteCoordinate(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function sourceMapKey(entityType, sourceRecordId) {
  return `${entityType}:${sourceRecordId}`;
}

function recordInvalid(rowNumber, code, message, rawRow) {
  report.invalidRows.push({rowNumber, code, message, rawRow});
}

async function loadDemoData() {
  const files = {
    incidents: "karnataka-crime-incidents.csv",
    persons: "karnataka-persons.json",
    incidentPersons: "karnataka-incident-persons.json",
    relationships: "karnataka-relationships.json",
    stations: "karnataka-police-stations.json",
    indicators: "karnataka-district-indicators.csv",
  };
  const loaded = {};
  for (const [key, fileName] of Object.entries(files)) {
    const filePath = resolve(demoDirectory, fileName);
    const content = await readFile(filePath, "utf8");
    report.source.files[key] = fileName;
    loaded[key] = fileName.endsWith(".csv") ? parseCsv(content) : JSON.parse(content);
  }
  report.source.rowCounts = Object.fromEntries(Object.entries(loaded).map(([key, value]) => [key, Array.isArray(value) ? value.length : Object.keys(value).length]));
  return loaded;
}

async function findOrCreateImport(client, totalRows) {
  const existing = await client.query(
    `SELECT import_id FROM data_import
     WHERE filename = $1 AND source_type = $2 AND status = 'COMMITTED'
     ORDER BY started_at DESC LIMIT 1`,
    ["karnataka-crime-incidents.csv", "CaseMaster"],
  );
  if (existing.rowCount) return existing.rows[0].import_id;

  const inserted = await client.query(
    `INSERT INTO data_import (filename, source_type, status, total_rows, accepted_rows, completed_at, mapping)
     VALUES ($1, $2, 'COMMITTED', $3, $3, now(), $4::jsonb)
     RETURNING import_id`,
    ["karnataka-crime-incidents.csv", "CaseMaster", totalRows, JSON.stringify({sourceSystem, synthetic: true})],
  );
  countInserted("data_import");
  return inserted.rows[0].import_id;
}

async function mapSourceRecord(client, sourceRecordId, entityType, entityId, importId, metadata = {}) {
  await client.query(
    `INSERT INTO source_record_map (source_system, source_record_id, entity_type, entity_id, import_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (source_system, source_record_id, entity_type)
     DO UPDATE SET entity_id = EXCLUDED.entity_id, import_id = EXCLUDED.import_id, metadata = EXCLUDED.metadata, mapped_at = now()`,
    [sourceSystem, sourceRecordId, entityType, String(entityId), importId, JSON.stringify(metadata)],
  );
}

async function seedDistrictsAndStations(client, incidents, indicators, stationsByDistrict) {
  const stateResult = await client.query("SELECT state_id FROM state WHERE state_name = 'Karnataka'");
  if (!stateResult.rowCount) throw new Error("Karnataka reference state was not seeded.");
  const stateId = stateResult.rows[0].state_id;
  const typeResult = await client.query("SELECT unit_type_id FROM unit_type WHERE unit_type_name = 'POLICE_STATION'");
  if (!typeResult.rowCount) throw new Error("POLICE_STATION unit type was not seeded.");
  const policeStationTypeId = typeResult.rows[0].unit_type_id;

  const districtCoordinates = new Map();
  for (const incident of incidents) {
    const latitude = asFiniteCoordinate(incident.latitude);
    const longitude = asFiniteCoordinate(incident.longitude);
    if (!incident.district || latitude === null || longitude === null) continue;
    const bucket = districtCoordinates.get(incident.district) ?? {latitude: 0, longitude: 0, count: 0};
    bucket.latitude += latitude;
    bucket.longitude += longitude;
    bucket.count += 1;
    districtCoordinates.set(incident.district, bucket);
  }

  const districtNames = [...new Set([
    ...incidents.map((incident) => incident.district),
    ...indicators.map((indicator) => indicator.district),
    ...Object.keys(stationsByDistrict),
  ].filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const existingDistricts = await client.query("SELECT district_id, district_name, btrim(district_code) AS district_code FROM district WHERE state_id = $1", [stateId]);
  const districtByName = new Map(existingDistricts.rows.map((row) => [row.district_name, row]));
  const usedDistrictCodes = new Set(existingDistricts.rows.map((row) => Number.parseInt(row.district_code, 10)).filter(Number.isFinite));
  let districtCodeCandidate = 1;

  for (const districtName of districtNames) {
    if (districtByName.has(districtName)) {
      countSkipped("district");
      continue;
    }
    while (usedDistrictCodes.has(districtCodeCandidate)) districtCodeCandidate += 1;
    const districtCode = String(districtCodeCandidate).padStart(4, "0");
    usedDistrictCodes.add(districtCodeCandidate);
    districtCodeCandidate += 1;
    const coordinate = districtCoordinates.get(districtName);
    const latitude = coordinate ? coordinate.latitude / coordinate.count : 14.5;
    const longitude = coordinate ? coordinate.longitude / coordinate.count : 76.2;
    const inserted = await client.query(
      `INSERT INTO district (district_code, district_name, state_id, boundary)
       VALUES ($1, $2, $3, ST_Multi(ST_MakeEnvelope($4, $5, $6, $7, 4326)))
       RETURNING district_id, district_name, btrim(district_code) AS district_code`,
      [districtCode, districtName, stateId, longitude - 0.2, latitude - 0.14, longitude + 0.2, latitude + 0.14],
    );
    districtByName.set(districtName, inserted.rows[0]);
    countInserted("district");
  }

  const stationCoordinates = new Map();
  for (const incident of incidents) {
    const latitude = asFiniteCoordinate(incident.latitude);
    const longitude = asFiniteCoordinate(incident.longitude);
    if (!incident.district || !incident.police_station || latitude === null || longitude === null) continue;
    const key = `${incident.district}:${incident.police_station}`;
    const bucket = stationCoordinates.get(key) ?? {latitude: 0, longitude: 0, count: 0};
    bucket.latitude += latitude;
    bucket.longitude += longitude;
    bucket.count += 1;
    stationCoordinates.set(key, bucket);
  }

  const existingStations = await client.query("SELECT unit_id, unit_name, district_id, btrim(unit_code) AS unit_code FROM police_unit WHERE type_id = $1", [policeStationTypeId]);
  const stationByDistrictAndName = new Map(existingStations.rows.map((row) => [`${row.district_id}:${row.unit_name}`, row]));
  const usedUnitCodes = new Set(existingStations.rows.map((row) => Number.parseInt(row.unit_code, 10)).filter(Number.isFinite));
  let stationCodeCandidate = 1;
  const stationIdByKey = new Map();

  for (const [districtName, district] of districtByName) {
    const stationNames = new Set(stationsByDistrict[districtName] ?? []);
    incidents.filter((incident) => incident.district === districtName).forEach((incident) => stationNames.add(incident.police_station));
    for (const stationName of [...stationNames].filter(Boolean).sort((left, right) => left.localeCompare(right))) {
      const key = `${district.district_id}:${stationName}`;
      const existing = stationByDistrictAndName.get(key);
      if (existing) {
        stationIdByKey.set(`${districtName}:${stationName}`, existing.unit_id);
        countSkipped("police_unit");
        continue;
      }
      while (usedUnitCodes.has(stationCodeCandidate)) stationCodeCandidate += 1;
      const unitCode = String(stationCodeCandidate).padStart(4, "0");
      usedUnitCodes.add(stationCodeCandidate);
      stationCodeCandidate += 1;
      const coordinate = stationCoordinates.get(`${districtName}:${stationName}`) ?? districtCoordinates.get(districtName);
      const latitude = coordinate ? coordinate.latitude / coordinate.count : null;
      const longitude = coordinate ? coordinate.longitude / coordinate.count : null;
      const inserted = await client.query(
        `INSERT INTO police_unit (unit_code, unit_name, type_id, state_id, district_id, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING unit_id`,
        [unitCode, stationName, policeStationTypeId, stateId, district.district_id, latitude, longitude],
      );
      stationIdByKey.set(`${districtName}:${stationName}`, inserted.rows[0].unit_id);
      countInserted("police_unit");
    }
  }

  for (const [districtName, district] of districtByName) {
    for (const stationName of stationsByDistrict[districtName] ?? []) {
      if (stationIdByKey.has(`${districtName}:${stationName}`)) continue;
      const existing = stationByDistrictAndName.get(`${district.district_id}:${stationName}`);
      if (existing) stationIdByKey.set(`${districtName}:${stationName}`, existing.unit_id);
    }
  }

  return {districtByName, stationIdByKey};
}

async function loadReferenceMaps(client) {
  const [gender, severity, status, heads] = await Promise.all([
    client.query("SELECT gender_id, code FROM gender"),
    client.query("SELECT gravity_offence_id, lookup_value FROM gravity_offence"),
    client.query("SELECT case_status_id, case_status_name FROM case_status"),
    client.query("SELECT crime_head_id, crime_group_name FROM crime_head"),
  ]);
  return {
    genderByCode: new Map(gender.rows.map((row) => [row.code, row.gender_id])),
    severityByName: new Map(severity.rows.map((row) => [row.lookup_value, row.gravity_offence_id])),
    statusByName: new Map(status.rows.map((row) => [row.case_status_name, row.case_status_id])),
    crimeHeadByName: new Map(heads.rows.map((row) => [row.crime_group_name, row.crime_head_id])),
    crimeSubHeadByName: new Map(),
  };
}

async function ensureCrimeReference(client, references, crimeType) {
  let crimeHeadId = references.crimeHeadByName.get(crimeType);
  if (!crimeHeadId) {
    const result = await client.query("INSERT INTO crime_head (crime_group_name) VALUES ($1) ON CONFLICT (crime_group_name) DO UPDATE SET active = true RETURNING crime_head_id", [crimeType]);
    crimeHeadId = result.rows[0].crime_head_id;
    references.crimeHeadByName.set(crimeType, crimeHeadId);
    countInserted("crime_head");
  }
  const subHeadKey = `${crimeHeadId}:${crimeType}`;
  let crimeSubHeadId = references.crimeSubHeadByName.get(subHeadKey);
  if (!crimeSubHeadId) {
    const result = await client.query(
      `INSERT INTO crime_sub_head (crime_head_id, crime_head_name, seq_id)
       VALUES ($1, $2, 1)
       ON CONFLICT (crime_head_id, crime_head_name) DO UPDATE SET active = true
       RETURNING crime_sub_head_id`,
      [crimeHeadId, crimeType],
    );
    crimeSubHeadId = result.rows[0].crime_sub_head_id;
    references.crimeSubHeadByName.set(subHeadKey, crimeSubHeadId);
    countInserted("crime_sub_head");
  }
  return {crimeHeadId, crimeSubHeadId};
}

async function migratePersons(client, persons, references, importId) {
  const mapped = await client.query("SELECT source_record_id, entity_id FROM source_record_map WHERE source_system = $1 AND entity_type = 'PERSON'", [sourceSystem]);
  const personIdBySourceId = new Map(mapped.rows.map((row) => [row.source_record_id, row.entity_id]));
  for (const person of persons) {
    if (!person.person_id || !person.name) {
      recordInvalid(0, "INVALID_PERSON", "A synthetic person record is missing a person_id or name.", person);
      countSkipped("person");
      continue;
    }
    const existingPersonId = personIdBySourceId.get(person.person_id);
    const genderCode = /^f/i.test(person.gender ?? "") ? "F" : /^m/i.test(person.gender ?? "") ? "M" : "U";
    const genderId = references.genderByCode.get(genderCode) ?? references.genderByCode.get("U");
    const age = Number.parseInt(person.age, 10);
    const birthYear = Number.isFinite(age) && age >= 0 && age <= 120 ? nowYear - age : null;
    if (existingPersonId) {
      await client.query(
        `UPDATE person
         SET full_name = $2, normalized_name = $3, estimated_birth_year = $4, gender_id = $5,
             mobile_hash = $6, address_hash = $7, identity_confidence = $8, verification_status = 'SUGGESTED'
         WHERE person_id = $1`,
        [existingPersonId, person.name, normalizeName(person.name), birthYear, genderId, hashValue(person.phone), hashValue(person.address), defaultIdentityConfidence],
      );
      countUpdated("person");
      continue;
    }
    const inserted = await client.query(
      `INSERT INTO person (full_name, normalized_name, estimated_birth_year, gender_id, mobile_hash, address_hash, identity_confidence, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUGGESTED') RETURNING person_id`,
      [person.name, normalizeName(person.name), birthYear, genderId, hashValue(person.phone), hashValue(person.address), defaultIdentityConfidence],
    );
    const personId = inserted.rows[0].person_id;
    personIdBySourceId.set(person.person_id, personId);
    await mapSourceRecord(client, person.person_id, "PERSON", personId, importId, {synthetic: true});
    countInserted("person");
  }
  return personIdBySourceId;
}

async function migrateCases(client, incidents, references, districts, stations, importId) {
  const mapped = await client.query("SELECT source_record_id, entity_id FROM source_record_map WHERE source_system = $1 AND entity_type = 'CASE'", [sourceSystem]);
  const caseIdByFir = new Map(mapped.rows.map((row) => [row.source_record_id, Number(row.entity_id)]));
  for (const [index, incident] of incidents.entries()) {
    const rowNumber = index + 2;
    const district = districts.get(incident.district);
    const stationId = stations.get(`${incident.district}:${incident.police_station}`);
    const crimeRegisteredAt = parseDateTime(incident.incident_date, incident.incident_time);
    const latitude = asFiniteCoordinate(incident.latitude);
    const longitude = asFiniteCoordinate(incident.longitude);
    if (!district || !stationId || !crimeRegisteredAt || latitude === null || longitude === null || !incident.crime_type || !incident.fir_number) {
      recordInvalid(rowNumber, "INVALID_CASE_REFERENCE", "The case is missing a valid district, station, timestamp, coordinate, crime type, or source identifier.", incident);
      countSkipped("case_master");
      continue;
    }
    const caseYear = Number.parseInt(incident.incident_date.slice(0, 4), 10);
    if (!Number.isInteger(caseYear)) {
      recordInvalid(rowNumber, "INVALID_CASE_YEAR", "Incident date does not contain a usable year.", incident);
      countSkipped("case_master");
      continue;
    }
    const {crimeHeadId, crimeSubHeadId} = await ensureCrimeReference(client, references, incident.crime_type);
    const severityId = references.severityByName.get(String(incident.severity).toUpperCase()) ?? references.severityByName.get("MEDIUM");
    const normalizedStatus = String(incident.status).toUpperCase() === "CHARGE_SHEET_FILED" ? "CHARGESHEETED" : String(incident.status).toUpperCase();
    const statusId = references.statusByName.get(normalizedStatus) ?? references.statusByName.get("PENDING");
    const existingCaseId = caseIdByFir.get(incident.fir_number);
    if (existingCaseId) {
      await client.query(
        `UPDATE case_master
         SET crime_registered_at = $2, police_station_id = $3, gravity_offence_id = $4, crime_major_head_id = $5,
             crime_minor_head_id = $6, case_status_id = $7, incident_from_at = $2, incident_to_at = $2::timestamptz + interval '1 hour',
             info_received_ps_at = $2::timestamptz - interval '15 minutes', latitude = $8, longitude = $9, brief_facts = $10,
             source_system = $11, data_classification = 'RESTRICTED'
         WHERE case_master_id = $1`,
        [existingCaseId, crimeRegisteredAt, stationId, severityId, crimeHeadId, crimeSubHeadId, statusId, latitude, longitude, incident.description, sourceSystem],
      );
      countUpdated("case_master");
      continue;
    }
    const numberResult = await client.query("SELECT * FROM generate_crime_number($1, $2, $3, $4)", [caseCategoryId, district.district_id, stationId, caseYear]);
    const generated = numberResult.rows[0];
    const inserted = await client.query(
      `INSERT INTO case_master (
         crime_no, case_no, case_year, running_serial, crime_registered_at, police_station_id, case_category_id,
         gravity_offence_id, crime_major_head_id, crime_minor_head_id, case_status_id, incident_from_at, incident_to_at,
         info_received_ps_at, latitude, longitude, brief_facts, source_system, source_record_id, data_classification
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $5, $5::timestamptz + interval '1 hour',
         $5::timestamptz - interval '15 minutes', $12, $13, $14, $15, $16, 'RESTRICTED') RETURNING case_master_id`,
      [generated.crime_no, generated.case_no, caseYear, generated.running_serial, crimeRegisteredAt, stationId, caseCategoryId, severityId, crimeHeadId, crimeSubHeadId, statusId, latitude, longitude, incident.description, sourceSystem, incident.fir_number],
    );
    const caseMasterId = inserted.rows[0].case_master_id;
    caseIdByFir.set(incident.fir_number, caseMasterId);
    await mapSourceRecord(client, incident.fir_number, "CASE", caseMasterId, importId, {generatedCrimeNo: generated.crime_no, originalFirNumber: incident.fir_number});
    if (report.generatedIdentifiers.length < maximumGeneratedIdentifiersInReport) report.generatedIdentifiers.push({sourceRecordId: incident.fir_number, crimeNo: generated.crime_no, caseNo: generated.case_no});
    countInserted("case_master");
  }
  return caseIdByFir;
}

async function migrateLocationsAndModusOperandi(client, incidents, cases, districts, stations, importId) {
  const mappedLocations = await client.query("SELECT source_record_id, entity_id FROM source_record_map WHERE source_system = $1 AND entity_type = 'LOCATION'", [sourceSystem]);
  const locationIdBySourceId = new Map(mappedLocations.rows.map((row) => [row.source_record_id, row.entity_id]));
  for (const incident of incidents) {
    const caseMasterId = cases.get(incident.fir_number);
    const district = districts.get(incident.district);
    const stationId = stations.get(`${incident.district}:${incident.police_station}`);
    if (!caseMasterId || !district || !stationId) continue;
    const locationSourceId = `${incident.fir_number}:INCIDENT_LOCATION`;
    let locationId = locationIdBySourceId.get(locationSourceId);
    if (!locationId) {
      const inserted = await client.query(
        `INSERT INTO location (location_type, address_text, district_id, police_station_id, latitude, longitude)
         VALUES ('INCIDENT_LOCATION', $1, $2, $3, $4, $5) RETURNING location_id`,
        [incident.description, district.district_id, stationId, asFiniteCoordinate(incident.latitude), asFiniteCoordinate(incident.longitude)],
      );
      locationId = inserted.rows[0].location_id;
      locationIdBySourceId.set(locationSourceId, locationId);
      await mapSourceRecord(client, locationSourceId, "LOCATION", locationId, importId, {caseMasterId});
      countInserted("location");
    } else {
      countSkipped("location");
    }
    await client.query(
      `INSERT INTO case_location (case_master_id, location_id, relationship_type, confidence)
       VALUES ($1, $2, 'INCIDENT_LOCATION', 1)
       ON CONFLICT (case_master_id, location_id, relationship_type) DO UPDATE SET confidence = EXCLUDED.confidence`,
      [caseMasterId, locationId],
    );
    const existingMo = await client.query("SELECT mo_id FROM modus_operandi WHERE case_master_id = $1 LIMIT 1", [caseMasterId]);
    const daypart = daypartFromTime(incident.incident_time);
    const moParameters = [incident.modus_operandi, incident.crime_type, daypart, incident.description, JSON.stringify({crimeCategory: incident.crime_type, daypart, source: "synthetic-demo"}), caseMasterId];
    if (existingMo.rowCount) {
      await client.query("UPDATE modus_operandi SET entry_method = $1, target_type = $2, time_pattern = $3, mo_text = $4, extracted_features = $5::jsonb, confidence = 0.8, verification_status = 'SUGGESTED' WHERE case_master_id = $6", moParameters);
      countUpdated("modus_operandi");
    } else {
      await client.query("INSERT INTO modus_operandi (entry_method, target_type, time_pattern, mo_text, extracted_features, confidence, verification_status, case_master_id) VALUES ($1, $2, $3, $4, $5::jsonb, 0.8, 'SUGGESTED', $6)", moParameters);
      countInserted("modus_operandi");
    }
  }
}

async function migrateCasePersonRoles(client, incidentPersons, personsBySourceId, cases, references) {
  for (const link of incidentPersons) {
    const personId = personsBySourceId.get(link.person_id);
    const caseMasterId = cases.get(link.incident_id);
    if (!personId || !caseMasterId) {
      countSkipped("case_person_role");
      continue;
    }
    const normalizedRole = String(link.role).toUpperCase() === "OFFENDER" ? "ACCUSED" : String(link.role).toUpperCase();
    const roleType = ["ACCUSED", "VICTIM", "COMPLAINANT", "WITNESS", "PERSON_OF_INTEREST", "ARRESTED_PERSON", "ASSOCIATE"].includes(normalizedRole) ? normalizedRole : "ASSOCIATE";
    await client.query(
      `INSERT INTO case_person_role (case_master_id, person_id, role_type, source_table, source_record_id, confidence, is_verified)
       VALUES ($1, $2, $3, 'karnataka-incident-persons.json', $4, $5, false)
       ON CONFLICT (case_master_id, person_id, role_type, source_table, source_record_id)
       DO UPDATE SET confidence = EXCLUDED.confidence`,
      [caseMasterId, personId, roleType, `${link.incident_id}:${link.person_id}`, defaultRoleConfidence],
    );
    countInserted("case_person_role");
    const personResult = await client.query("SELECT full_name, estimated_birth_year, gender_id FROM person WHERE person_id = $1", [personId]);
    const person = personResult.rows[0];
    const age = person?.estimated_birth_year ? Math.max(0, nowYear - person.estimated_birth_year) : null;
    if (roleType === "ACCUSED") {
      await client.query(
        `INSERT INTO accused (case_master_id, canonical_person_id, accused_name, age_year, gender_id, accused_sequence, accused_status)
         SELECT $1, $2, $3, $4, $5, $6, 'LISTED'
         WHERE NOT EXISTS (SELECT 1 FROM accused WHERE case_master_id = $1 AND canonical_person_id = $2)`,
        [caseMasterId, personId, person?.full_name ?? "Synthetic person", age, person?.gender_id ?? references.genderByCode.get("U"), `A${link.person_id.replaceAll(/\D/g, "") || "1"}`],
      );
    } else if (roleType === "VICTIM") {
      await client.query(
        `INSERT INTO victim (case_master_id, canonical_person_id, victim_name, age_year, gender_id)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (SELECT 1 FROM victim WHERE case_master_id = $1 AND canonical_person_id = $2)`,
        [caseMasterId, personId, person?.full_name ?? "Synthetic person", age, person?.gender_id ?? references.genderByCode.get("U")],
      );
    } else if (roleType === "COMPLAINANT") {
      await client.query(
        `INSERT INTO complainant_details (case_master_id, canonical_person_id, complainant_name, age_year, gender_id)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (SELECT 1 FROM complainant_details WHERE case_master_id = $1 AND canonical_person_id = $2)`,
        [caseMasterId, personId, person?.full_name ?? "Synthetic person", age, person?.gender_id ?? references.genderByCode.get("U")],
      );
    }
  }
}

async function migrateIndicators(client, indicators, districts) {
  for (const indicator of indicators) {
    const district = districts.get(indicator.district);
    if (!district) {
      recordInvalid(0, "UNKNOWN_INDICATOR_DISTRICT", "A socioeconomic indicator did not map to a seeded district.", indicator);
      countSkipped("district_socioeconomic_indicator");
      continue;
    }
    await client.query(
      `INSERT INTO district_socioeconomic_indicator (
        district_id, period_start, period_end, population, literacy_rate, unemployment_rate, poverty_rate,
        police_presence, urbanization_rate, source_name, is_synthetic
      ) VALUES ($1, '2025-01-01', '2025-12-31', $2, $3, $4, $5, $6, $7, 'KAVACH synthetic district indicators', true)
      ON CONFLICT (district_id, period_start, period_end, source_name)
      DO UPDATE SET population = EXCLUDED.population, literacy_rate = EXCLUDED.literacy_rate, unemployment_rate = EXCLUDED.unemployment_rate,
        poverty_rate = EXCLUDED.poverty_rate, police_presence = EXCLUDED.police_presence, urbanization_rate = EXCLUDED.urbanization_rate`,
      [district.district_id, Number(indicator.population), Number(indicator.literacyRate), Number(indicator.unemploymentRate), Number(indicator.povertyRate), Number(indicator.policePresence), Number(indicator.urbanizationRate)],
    );
    countInserted("district_socioeconomic_indicator");
  }
}

async function migrate() {
  const data = await loadDemoData();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const importId = await findOrCreateImport(client, data.incidents.length);
    const {districtByName, stationIdByKey} = await seedDistrictsAndStations(client, data.incidents, data.indicators, data.stations);
    const references = await loadReferenceMaps(client);
    const personIdBySourceId = await migratePersons(client, data.persons, references, importId);
    const caseIdByFir = await migrateCases(client, data.incidents, references, districtByName, stationIdByKey, importId);
    await migrateLocationsAndModusOperandi(client, data.incidents, caseIdByFir, districtByName, stationIdByKey, importId);
    await migrateCasePersonRoles(client, data.incidentPersons, personIdBySourceId, caseIdByFir, references);
    await migrateIndicators(client, data.indicators, districtByName);
    await client.query("COMMIT");
    report.completedAt = new Date().toISOString();
  } catch (error) {
    await client.query("ROLLBACK");
    report.foreignKeyFailures.push({message: error?.code === "23503" ? "A foreign-key lookup failed during migration." : "Migration transaction rolled back."});
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

try {
  await migrate();
  await mkdir(dirname(reportPath), {recursive: true});
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({status: "ok", reportPath: "reports/demo-data-migration-report.json", inserted: report.inserted, updated: report.updated, skipped: report.skipped}, null, 2));
} catch (error) {
  report.completedAt = new Date().toISOString();
  await mkdir(dirname(reportPath), {recursive: true});
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(JSON.stringify({status: "error", message: error instanceof Error ? error.message : "Demo migration failed", reportPath: "reports/demo-data-migration-report.json"}, null, 2));
  process.exitCode = 1;
}
