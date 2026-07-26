import {profileDataset} from './profiler.js';

export const CRIME_INTELLIGENCE_AGENTS = Object.freeze([
  {id: 'coordinator', name: 'Coordinator Agent', responsibility: 'Decomposes officer questions, applies safety policy, and coordinates approved analytical tools.', inputBoundary: 'query + authorized scope', outputBoundary: 'execution plan'},
  {id: 'schema', name: 'Schema Intelligence Agent', responsibility: 'Infers canonical entities, fields, relationships, PII, and source-to-domain mappings.', inputBoundary: 'schema profiles only', outputBoundary: 'mapping proposal'},
  {id: 'quality', name: 'Data Quality Agent', responsibility: 'Detects aliases, duplicates, invalid dates, impossible coordinates, and missing critical fields.', inputBoundary: 'authorized import preview', outputBoundary: 'quality findings + corrections'},
  {id: 'crime-analysis', name: 'Crime Analysis Agent', responsibility: 'Builds deterministic trend, hotspot, anomaly, and district-comparison plans.', inputBoundary: 'aggregated crime facts', outputBoundary: 'approved analytics calls'},
  {id: 'network', name: 'Network Agent', responsibility: 'Explains person, vehicle, phone, incident, location, weapon, organization, and account links.', inputBoundary: 'authorized graph projection', outputBoundary: 'evidence-linked graph findings'},
  {id: 'prediction', name: 'Prediction Sandbox Agent', responsibility: 'Runs bounded what-if scenarios and exposes assumptions, uncertainty, and non-causal limitations.', inputBoundary: 'aggregate scenario parameters', outputBoundary: 'simulated score delta'},
  {id: 'report', name: 'Report Agent', responsibility: 'Builds reviewable SCRB, officer, executive, PDF, PowerPoint, and Excel report packages.', inputBoundary: 'approved intelligence results', outputBoundary: 'report plan'},
  {id: 'visualization', name: 'Visualization Agent', responsibility: 'Selects map, timeline, chart, graph, and explainability views without inventing unsupported facts.', inputBoundary: 'validated result schema', outputBoundary: 'visualization specification'},
]);

export const CRIME_INTELLIGENCE_CAPABILITIES = Object.freeze([
  {id: 'universal-data-gateway', name: 'Universal Data Gateway', status: 'implemented', route: '/api/kavach/data-sources'},
  {id: 'schema-intelligence', name: 'Schema Intelligence Engine', status: 'implemented', route: '/api/kavach/intelligence-os/schema/infer'},
  {id: 'data-quality-ai', name: 'Data Quality AI', status: 'implemented', route: '/api/kavach/intelligence-os/data-quality/analyze'},
  {id: 'crime-knowledge-graph', name: 'Crime Knowledge Graph', status: 'implemented', route: '/api/kavach/intelligence/graph'},
  {id: 'investigation-copilot', name: 'Investigation Copilot', status: 'implemented', route: '/api/kavach/intelligence-os/investigate'},
  {id: 'natural-language-dashboard', name: 'Natural Language Dashboard', status: 'implemented', route: '/api/kavach/intelligence-os/investigate'},
  {id: 'multi-agent-ai', name: 'Multi-Agent AI', status: 'implemented', route: '/api/kavach/intelligence-os/agents'},
  {id: 'digital-twin', name: 'Karnataka Crime Digital Twin', status: 'prototype', route: '/geo-intelligence'},
  {id: 'timeline-investigation', name: 'Timeline Investigation', status: 'implemented', route: '/api/kavach/intelligence/evolution'},
  {id: 'report-generator', name: 'AI Report Generator', status: 'implemented', route: '/api/kavach/intelligence-os/reports/plan'},
  {id: 'explainable-ai', name: 'Explainable AI Panel', status: 'implemented', route: '/risk-intelligence'},
  {id: 'realtime-alerts', name: 'Real-Time Alert Engine', status: 'implemented', route: '/api/kavach/intelligence-os/alerts/evaluate'},
  {id: 'prediction-sandbox', name: 'Prediction Sandbox', status: 'implemented', route: '/api/kavach/intelligence-os/sandbox/simulate'},
  {id: 'explainable-graph-ai', name: 'Explainable Graph AI', status: 'implemented', route: '/api/kavach/intelligence-os/graph/explain'},
  {id: 'cloud-connectors', name: 'Cloud Connectors', status: 'adapter-ready', route: '/api/kavach/data-sources/providers'},
]);

const DISTRICT_ALIASES = Object.freeze({
  bangalore: 'Bengaluru Urban',
  bengaluru: 'Bengaluru Urban',
  "b'lore": 'Bengaluru Urban',
  blr: 'Bengaluru Urban',
  bengaluruurban: 'Bengaluru Urban',
  mysore: 'Mysuru',
  mysuru: 'Mysuru',
  mangalore: 'Dakshina Kannada',
  mangaluru: 'Dakshina Kannada',
  hubli: 'Dharwad',
  hubballi: 'Dharwad',
  belgaum: 'Belagavi',
  belagavi: 'Belagavi',
});

const CRIME_TYPE_ALIASES = Object.freeze({
  cyber: 'Cybercrime',
  cybercrime: 'Cybercrime',
  robbery: 'Robbery',
  burglary: 'Burglary',
  theft: 'Theft',
  assault: 'Assault',
  fraud: 'Fraud',
  narcotics: 'Narcotics',
  kidnapping: 'Kidnapping',
  homicide: 'Homicide',
});

const ENTITY_BY_SEMANTIC = Object.freeze({
  fir_number: 'Incident',
  incident_date: 'Incident',
  incident_time: 'Incident',
  crime_type: 'Incident',
  severity: 'Incident',
  status: 'Incident',
  description: 'Incident',
  modus_operandi: 'ModusOperandi',
  accused_name: 'Person',
  victim_name: 'Person',
  phone: 'Phone',
  vehicle: 'Vehicle',
  district: 'Location',
  latitude: 'Location',
  longitude: 'Location',
  police_station: 'PoliceStation',
});

const KARNATAKA_BOUNDS = Object.freeze({minLatitude: 11.5, maxLatitude: 18.6, minLongitude: 74.0, maxLongitude: 78.7});

function firstValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return null;
}

function isoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function normalizeDistrictName(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const key = text.toLowerCase().replace(/[^a-z]/g, '');
  return DISTRICT_ALIASES[key] || text.replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeDateValue(value, defaultYear = new Date().getUTCFullYear()) {
  const text = String(value || '').trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) return isoDate(new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))));

  const dmyMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (dmyMatch) {
    const year = Number(dmyMatch[3]) < 100 ? 2000 + Number(dmyMatch[3]) : Number(dmyMatch[3]);
    return isoDate(new Date(Date.UTC(year, Number(dmyMatch[2]) - 1, Number(dmyMatch[1]))));
  }

  const monthNameMatch = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{2}|\d{4}))?$/);
  if (monthNameMatch) {
    const year = monthNameMatch[3] ? (Number(monthNameMatch[3]) < 100 ? 2000 + Number(monthNameMatch[3]) : Number(monthNameMatch[3])) : defaultYear;
    return isoDate(new Date(`${monthNameMatch[1]} ${monthNameMatch[2]} ${year} UTC`));
  }

  return isoDate(new Date(text));
}

export function normalizeCrimeRow(row = {}) {
  const districtRaw = firstValue(row, ['district', 'district_name', 'District']);
  const incidentDateRaw = firstValue(row, ['incident_date', 'incidentDate', 'date_of_occurrence', 'Date']);
  const registeredDateRaw = firstValue(row, ['registered_date', 'registeredAt', 'crime_registered_at']);
  const crimeTypeRaw = firstValue(row, ['crime_type', 'crimeType', 'category', 'offence']);
  const crimeTypeKey = String(crimeTypeRaw || '').toLowerCase().replace(/[^a-z]/g, '');

  return {
    ...row,
    crimeNo: firstValue(row, ['crime_no', 'crimeNo', 'fir_number', 'fir_no', 'case_number']),
    district: normalizeDistrictName(districtRaw),
    incidentDate: normalizeDateValue(incidentDateRaw),
    registeredDate: normalizeDateValue(registeredDateRaw),
    crimeType: CRIME_TYPE_ALIASES[crimeTypeKey] || (crimeTypeRaw ? String(crimeTypeRaw).trim() : null),
    latitude: firstValue(row, ['latitude', 'lat']) === null ? null : Number(firstValue(row, ['latitude', 'lat'])),
    longitude: firstValue(row, ['longitude', 'lng', 'lon']) === null ? null : Number(firstValue(row, ['longitude', 'lng', 'lon'])),
  };
}

function issue(code, severity, rowNumber, field, message, rawValue, suggestedValue = null) {
  return {code, severity, rowNumber, field, message, rawValue: rawValue ?? null, suggestedValue};
}

export function analyzeCrimeDataQuality(rows = []) {
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : [];
  const normalizedRows = safeRows.map(normalizeCrimeRow);
  const issues = [];
  const corrections = [];
  const crimeNumbers = new Map();
  const today = new Date();

  normalizedRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const original = safeRows[index];
    const rawDistrict = firstValue(original, ['district', 'district_name', 'District']);
    if (rawDistrict && row.district && String(rawDistrict).trim() !== row.district) {
      corrections.push({rowNumber, field: 'district', from: rawDistrict, to: row.district, reason: 'district_alias_normalization'});
    }

    if (!row.crimeNo) {
      issues.push(issue('MISSING_CRIME_NUMBER', 'HIGH', rowNumber, 'crime_no', 'A stable FIR or crime number is required.', null));
    } else {
      const key = String(row.crimeNo).trim().toLowerCase();
      if (crimeNumbers.has(key)) {
        issues.push(issue('DUPLICATE_CRIME_NUMBER', 'CRITICAL', rowNumber, 'crime_no', `Duplicate crime number also appears on row ${crimeNumbers.get(key)}.`, row.crimeNo));
      } else {
        crimeNumbers.set(key, rowNumber);
      }
    }

    if (!row.incidentDate) {
      issues.push(issue('INVALID_INCIDENT_DATE', 'HIGH', rowNumber, 'incident_date', 'Incident date is missing or could not be normalized.', firstValue(original, ['incident_date', 'incidentDate', 'date_of_occurrence', 'Date'])));
    } else if (new Date(`${row.incidentDate}T00:00:00Z`) > today) {
      issues.push(issue('FUTURE_INCIDENT_DATE', 'CRITICAL', rowNumber, 'incident_date', 'Incident date cannot be in the future.', row.incidentDate));
    }

    if ((row.latitude === null) !== (row.longitude === null)) {
      issues.push(issue('INCOMPLETE_COORDINATES', 'HIGH', rowNumber, 'coordinates', 'Latitude and longitude must be supplied together.', `${row.latitude ?? ''},${row.longitude ?? ''}`));
    }
    if (row.latitude !== null && row.longitude !== null) {
      if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
        issues.push(issue('INVALID_COORDINATES', 'CRITICAL', rowNumber, 'coordinates', 'Coordinates must be numeric.', `${row.latitude},${row.longitude}`));
      } else if (row.latitude < KARNATAKA_BOUNDS.minLatitude || row.latitude > KARNATAKA_BOUNDS.maxLatitude || row.longitude < KARNATAKA_BOUNDS.minLongitude || row.longitude > KARNATAKA_BOUNDS.maxLongitude) {
        issues.push(issue('OUTSIDE_KARNATAKA_BOUNDS', 'HIGH', rowNumber, 'coordinates', 'Coordinates fall outside the configured Karnataka prototype boundary.', `${row.latitude},${row.longitude}`));
      }
    } else {
      issues.push(issue('MISSING_COORDINATES', 'MEDIUM', rowNumber, 'coordinates', 'Missing coordinates reduce hotspot and jurisdiction accuracy.', null));
    }

    if (row.registeredDate && row.incidentDate && row.registeredDate < row.incidentDate) {
      issues.push(issue('IMPOSSIBLE_REGISTRATION_TIME', 'CRITICAL', rowNumber, 'registered_date', 'Registration date cannot be before incident date.', row.registeredDate));
    }
  });

  const severityWeight = {CRITICAL: 8, HIGH: 5, MEDIUM: 2, LOW: 1};
  const penalty = issues.reduce((total, item) => total + (severityWeight[item.severity] || 1), 0);
  const denominator = Math.max(1, safeRows.length * 10);
  const qualityScore = Number(Math.max(0, 100 - (penalty / denominator) * 100).toFixed(1));

  return {
    totalRows: safeRows.length,
    qualityScore,
    issueCount: issues.length,
    duplicateRows: issues.filter((item) => item.code === 'DUPLICATE_CRIME_NUMBER').length,
    criticalIssues: issues.filter((item) => item.severity === 'CRITICAL').length,
    autoCorrections: corrections.length,
    issues,
    corrections,
    normalizedPreview: normalizedRows.slice(0, 25),
    humanApprovalRequired: corrections.length > 0 || issues.length > 0,
  };
}

export function inferCanonicalCrimeModel(rowsOrProfiles = []) {
  const profiles = rowsOrProfiles.length > 0 && rowsOrProfiles[0]?.detectedSemanticMeaning
    ? rowsOrProfiles
    : profileDataset(rowsOrProfiles);
  const entities = new Map();
  const ignoredFields = [];

  for (const profile of profiles) {
    const entity = ENTITY_BY_SEMANTIC[profile.detectedSemanticMeaning];
    if (!entity) {
      ignoredFields.push(profile.sourceName);
      continue;
    }
    if (!entities.has(entity)) entities.set(entity, []);
    entities.get(entity).push({
      sourceField: profile.sourceName,
      canonicalField: profile.detectedSemanticMeaning,
      dataType: profile.inferredDataType,
      confidence: profile.confidenceScore,
      potentialPii: profile.isPotentialPII,
    });
  }

  const entityList = [...entities.entries()].map(([name, fields]) => ({name, fields}));
  const entityNames = new Set(entityList.map((entity) => entity.name));
  const relationships = [];
  if (entityNames.has('Person') && entityNames.has('Incident')) relationships.push({from: 'Person', type: 'INVOLVED_IN', to: 'Incident', reviewRequired: true});
  if (entityNames.has('Incident') && entityNames.has('Location')) relationships.push({from: 'Incident', type: 'OCCURRED_AT', to: 'Location'});
  if (entityNames.has('Incident') && entityNames.has('PoliceStation')) relationships.push({from: 'Incident', type: 'REPORTED_AT', to: 'PoliceStation'});
  if (entityNames.has('Incident') && entityNames.has('ModusOperandi')) relationships.push({from: 'Incident', type: 'USES_MO', to: 'ModusOperandi', reviewRequired: true});
  if (entityNames.has('Person') && entityNames.has('Phone')) relationships.push({from: 'Person', type: 'USES', to: 'Phone', reviewRequired: true});
  if (entityNames.has('Person') && entityNames.has('Vehicle')) relationships.push({from: 'Person', type: 'USES', to: 'Vehicle', reviewRequired: true});

  const mappedFields = entityList.reduce((total, entity) => total + entity.fields.length, 0);
  return {
    entities: entityList,
    relationships,
    ignoredFields,
    mappedFields,
    totalFields: profiles.length,
    mappingCoverage: profiles.length ? Number(((mappedFields / profiles.length) * 100).toFixed(1)) : 0,
    schemaOnly: true,
    rawRowsSentToModel: 0,
    humanApprovalRequired: true,
  };
}

function numberFrom(query, pattern, fallback) {
  const match = String(query).match(pattern);
  return match ? Number(match[1]) : fallback;
}

function findCrimeType(query) {
  const normalized = String(query || '').toLowerCase();
  return Object.values(CRIME_TYPE_ALIASES).find((type) => normalized.includes(type.toLowerCase())) || null;
}

export function buildInvestigationPlan(query, filters = {}) {
  const question = String(query || '').trim();
  const normalized = question.toLowerCase();
  const distanceKm = numberFrom(normalized, /(\d+(?:\.\d+)?)\s*(?:km|kilomet(?:er|re)s?)/i, Number(filters.distanceKm || 15));
  const months = numberFrom(normalized, /(?:last|past|within)\s+(\d+)\s+months?/i, Number(filters.months || 6));
  const vehicleColor = normalized.match(/\b(white|black|silver|grey|gray|red|blue|green|yellow)\b\s+(?:maruti\s+)?(?:swift|car|vehicle)/i)?.[1] || null;
  const vehicleModel = normalized.match(/\b(swift|innova|creta|scorpio|alto|wagonr|baleno|ertiga|fortuner)\b/i)?.[1] || null;
  const crimeType = findCrimeType(question);
  const repeatOffenders = /repeat\s+offenders?|multiple\s+cases?/i.test(normalized);
  const district = filters.district || normalizeDistrictName(normalized.match(/\bin\s+([a-z][a-z\s]+?)(?:\s+within|\s+last|\s+involving|$)/i)?.[1]);

  const parameters = {
    crimeType,
    district: district || null,
    distanceMeters: Math.round(Math.max(0.1, distanceKm) * 1000),
    dateFromExpression: `${Math.max(1, months)} months`,
    vehicleColor,
    vehicleModel,
    repeatOffenders,
  };

  const sql = `SELECT vi.fir_number, vi.incident_date, vi.district, vi.crime_type, vi.latitude, vi.longitude\nFROM analytics.v_incidents vi\nWHERE ($1::text IS NULL OR LOWER(vi.crime_type) = LOWER($1))\n  AND ($2::text IS NULL OR LOWER(vi.district) = LOWER($2))\n  AND vi.incident_date >= CURRENT_DATE - ($3::text)::interval\nORDER BY vi.incident_date DESC\nLIMIT 500;`;

  const spatial = `ST_DWithin(incident_geometry::geography, reference_geometry::geography, $4::double precision)`;
  const graph = `MATCH (p:Person)-[r:INVOLVED_IN]->(i:Incident)\nOPTIONAL MATCH (p)-[:USES]->(v:Vehicle)\nWHERE ($5 IS NULL OR toLower(v.color) = toLower($5))\n  AND ($6 IS NULL OR toLower(v.model) CONTAINS toLower($6))\nRETURN p, r, i, v;`;

  return {
    query: question,
    parsedIntent: {crimeType, district: district || null, distanceKm, months, vehicleColor, vehicleModel, repeatOffenders},
    agents: CRIME_INTELLIGENCE_AGENTS.filter((agent) => ['coordinator', 'crime-analysis', 'network', 'visualization'].includes(agent.id)).map((agent, index) => ({...agent, order: index + 1, status: 'planned'})),
    approvedTools: ['parameterized-postgres-query', 'postgis-radius-filter', 'authorized-graph-projection', 'repeat-offender-summary', 'visualization-spec'],
    executionPlan: {
      relational: {engine: 'PostgreSQL', template: sql, parameterOrder: ['$1 crimeType', '$2 district', '$3 date interval'], parameters},
      spatial: {engine: 'PostGIS', template: spatial, parameterOrder: ['$4 distanceMeters'], parameters},
      graph: {engine: 'KAVACH knowledge graph adapter', template: graph, parameterOrder: ['$5 vehicleColor', '$6 vehicleModel'], parameters},
    },
    visualizationSpec: [
      {type: 'map', purpose: 'Plot filtered incidents and radius boundary'},
      {type: 'timeline', purpose: 'Show incidents across the selected period'},
      {type: 'network', purpose: 'Explain people, vehicles, incidents, phones, and shared associates'},
      {type: 'evidence-panel', purpose: 'Show reason codes, source records, confidence, and review status'},
    ],
    safety: {
      executesArbitrarySql: false,
      predictsGuilt: false,
      recommendsEnforcement: false,
      humanVerificationRequired: true,
      note: 'The plan uses approved parameterized tools. It is an investigative lead workflow, not a factual allegation.',
    },
  };
}

export function explainGraphConnection(payload = {}) {
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  const attributes = payload.attributes || {};
  const reasons = [];
  if (attributes.sharedPhone || evidence.some((item) => /phone|mobile/i.test(String(item)))) reasons.push({code: 'SHARED_PHONE', label: 'Shared phone', weight: 0.9});
  if (attributes.sharedVehicle || evidence.some((item) => /vehicle|car|registration/i.test(String(item)))) reasons.push({code: 'SHARED_VEHICLE', label: 'Shared vehicle', weight: 0.85});
  if (attributes.sharedAddress || evidence.some((item) => /address|residence/i.test(String(item)))) reasons.push({code: 'SHARED_ADDRESS', label: 'Shared address', weight: 0.75});
  if (attributes.sharedIncident || evidence.some((item) => /fir|incident|case/i.test(String(item)))) reasons.push({code: 'SHARED_INCIDENT', label: 'Shared FIR or incident', weight: 0.95});
  if (attributes.sharedAssociate || evidence.some((item) => /associate|contact|community/i.test(String(item)))) reasons.push({code: 'SHARED_ASSOCIATE', label: 'Shared associate', weight: 0.65});
  if (attributes.sharedLocation || evidence.some((item) => /location|visited|tower/i.test(String(item)))) reasons.push({code: 'SHARED_LOCATION', label: 'Shared location', weight: 0.7});
  if (attributes.modusOperandi || evidence.some((item) => /modus|\bmo\b/i.test(String(item)))) reasons.push({code: 'MO_SIMILARITY', label: 'Similar modus operandi', weight: 0.6});

  const confidence = reasons.length
    ? Number(Math.min(0.99, reasons.reduce((total, reason) => total + reason.weight, 0) / reasons.length).toFixed(2))
    : 0;
  return {
    source: payload.source || null,
    target: payload.target || null,
    relationshipType: payload.relationshipType || 'POTENTIAL_ASSOCIATION',
    reasons,
    confidence,
    evidenceCount: evidence.length,
    status: reasons.length ? 'explainable_lead' : 'insufficient_evidence',
    humanVerificationRequired: true,
    warning: 'A graph connection is an investigative lead and does not establish guilt or direct contact.',
  };
}

function toRadians(value) {
  return Number(value) * Math.PI / 180;
}

function distanceKm(a, b) {
  const earthRadius = 6371;
  const dLat = toRadians(Number(b.latitude) - Number(a.latitude));
  const dLon = toRadians(Number(b.longitude) - Number(a.longitude));
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function evaluateRealtimeAlertRule(events = [], rule = {}) {
  const thresholdCount = Math.max(2, Number(rule.thresholdCount || 5));
  const radiusKm = Math.max(0.1, Number(rule.radiusKm || 2));
  const windowHours = Math.max(0.25, Number(rule.windowHours || 2));
  const safeEvents = events.filter((event) => Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude)) && !Number.isNaN(Date.parse(String(event.occurredAt || event.incidentDate))));
  const alerts = [];
  const emitted = new Set();

  for (const seed of safeEvents) {
    const seedTime = new Date(seed.occurredAt || seed.incidentDate).getTime();
    const cluster = safeEvents.filter((candidate) => {
      const candidateTime = new Date(candidate.occurredAt || candidate.incidentDate).getTime();
      const withinTime = Math.abs(candidateTime - seedTime) <= windowHours * 60 * 60 * 1000;
      return withinTime && distanceKm(seed, candidate) <= radiusKm;
    });
    if (cluster.length < thresholdCount) continue;
    const ids = cluster.map((item) => String(item.id || item.crimeNo || item.firNumber || item.occurredAt)).sort();
    const fingerprint = ids.join('|');
    if (emitted.has(fingerprint)) continue;
    emitted.add(fingerprint);
    alerts.push({
      alertType: 'SPATIOTEMPORAL_CLUSTER',
      severity: cluster.length >= thresholdCount * 2 ? 'CRITICAL' : 'HIGH',
      title: `${cluster.length} incidents within ${radiusKm} km and ${windowHours} hours`,
      incidentIds: ids,
      centroid: {
        latitude: Number((cluster.reduce((sum, item) => sum + Number(item.latitude), 0) / cluster.length).toFixed(6)),
        longitude: Number((cluster.reduce((sum, item) => sum + Number(item.longitude), 0) / cluster.length).toFixed(6)),
      },
      reasonCodes: ['INCIDENT_COUNT_THRESHOLD', 'SPATIAL_PROXIMITY', 'TIME_WINDOW_MATCH'],
      channels: rule.channels || ['dashboard', 'email'],
      deliveryStatus: 'planned',
      humanReviewRequired: true,
    });
  }

  return {
    evaluatedEvents: safeEvents.length,
    rule: {thresholdCount, radiusKm, windowHours, channels: rule.channels || ['dashboard', 'email']},
    alerts,
    note: 'Dashboard and email delivery can be executed by configured notification workers. SMS and WhatsApp require approved provider credentials and templates.',
  };
}

export function runPredictionSandbox(input = {}) {
  const baselineRisk = Math.min(100, Math.max(0, Number(input.baselineRisk ?? 65)));
  const patrolChangePercent = Math.min(100, Math.max(-100, Number(input.patrolChangePercent || 0)));
  const festivalIntensity = Math.min(100, Math.max(0, Number(input.festivalIntensity || 0)));
  const recentTrendPercent = Math.min(200, Math.max(-100, Number(input.recentTrendPercent || 0)));
  const reportingCoverageChange = Math.min(100, Math.max(-100, Number(input.reportingCoverageChange || 0)));

  const patrolEffect = patrolChangePercent * -0.08;
  const festivalEffect = festivalIntensity * 0.12;
  const trendEffect = recentTrendPercent * 0.1;
  const reportingEffect = reportingCoverageChange * 0.04;
  const simulatedRisk = Number(Math.min(100, Math.max(0, baselineRisk + patrolEffect + festivalEffect + trendEffect + reportingEffect)).toFixed(1));
  const delta = Number((simulatedRisk - baselineRisk).toFixed(1));

  return {
    baselineRisk,
    simulatedRisk,
    delta,
    direction: delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no_change',
    factors: [
      {name: 'Patrol change', input: patrolChangePercent, contribution: Number(patrolEffect.toFixed(1))},
      {name: 'Festival intensity', input: festivalIntensity, contribution: Number(festivalEffect.toFixed(1))},
      {name: 'Recent recorded trend', input: recentTrendPercent, contribution: Number(trendEffect.toFixed(1))},
      {name: 'Reporting coverage change', input: reportingCoverageChange, contribution: Number(reportingEffect.toFixed(1))},
    ],
    confidence: 0.55,
    limitations: [
      'This is a bounded scenario calculation, not a causal forecast.',
      'Recorded crime can change when reporting coverage changes.',
      'The result must not be used as the sole basis for deployment or enforcement decisions.',
    ],
    humanVerificationRequired: true,
  };
}

export function planReportPackage(input = {}) {
  const reportType = input.reportType || 'SCRB_MONTHLY';
  const formats = Array.isArray(input.formats) && input.formats.length ? input.formats : ['PDF', 'POWERPOINT', 'EXCEL'];
  const allowedFormats = formats.map((format) => String(format).toUpperCase()).filter((format) => ['PDF', 'POWERPOINT', 'EXCEL', 'HTML', 'JSON'].includes(format));
  return {
    reportType,
    formats: [...new Set(allowedFormats)],
    sections: [
      'Executive summary',
      'Data sources and quality',
      'District and station trends',
      'Hotspots and emerging alerts',
      'Knowledge graph findings',
      'Risk explanation and limitations',
      'Officer action-review notes',
      'Methodology and audit appendix',
    ],
    audiences: input.audiences || ['SCRB', 'District Officers', 'Executive Leadership'],
    status: 'planned',
    requiresHumanApproval: true,
    signingRequired: true,
    retentionPolicyRequired: true,
  };
}

export function getCrimeIntelligenceOSManifest() {
  return {
    name: 'KAVACH Crime Intelligence Operating System',
    version: '1.0.0',
    capabilities: CRIME_INTELLIGENCE_CAPABILITIES,
    agents: CRIME_INTELLIGENCE_AGENTS,
    safetyBoundary: {
      predictsIndividualGuilt: false,
      recommendsArrest: false,
      biometricIdentification: false,
      frontendCallsModelsDirectly: false,
      humanVerificationRequired: true,
    },
    architecture: [
      'Universal Data Gateway',
      'Schema Intelligence Engine',
      'Data Quality and Normalization',
      'PostgreSQL and PostGIS',
      'Crime Knowledge Graph',
      'FastAPI Analytics and Multi-Agent Orchestration',
      'Investigation Copilot API',
      'Officer Intelligence Portal',
    ],
  };
}
