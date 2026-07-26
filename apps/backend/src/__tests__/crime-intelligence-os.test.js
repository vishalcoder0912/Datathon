import {describe, expect, it} from 'vitest';
import {
  analyzeCrimeDataQuality,
  buildInvestigationPlan,
  evaluateRealtimeAlertRule,
  explainGraphConnection,
  getCrimeIntelligenceOSManifest,
  inferCanonicalCrimeModel,
  normalizeDateValue,
  normalizeDistrictName,
  planReportPackage,
  runPredictionSandbox,
} from '../kavach/services/crime-intelligence-os.js';

describe('Crime Intelligence OS normalization', () => {
  it('normalizes common Karnataka district aliases', () => {
    expect(normalizeDistrictName('BLR')).toBe('Bengaluru Urban');
    expect(normalizeDistrictName("B'lore")).toBe('Bengaluru Urban');
    expect(normalizeDistrictName('Mysore')).toBe('Mysuru');
  });

  it('normalizes Indian date formats deterministically', () => {
    expect(normalizeDateValue('01/02/24')).toBe('2024-02-01');
    expect(normalizeDateValue('1 Feb 2024')).toBe('2024-02-01');
    expect(normalizeDateValue('2024-02-01')).toBe('2024-02-01');
  });
});

describe('Crime Intelligence OS schema and quality intelligence', () => {
  const rows = [
    {fir_number: '202400000000000001', district: 'BLR', incident_date: '01/02/24', latitude: 12.9716, longitude: 77.5946, suspect_name: 'Masked A', crime_type: 'Robbery'},
    {fir_number: '202400000000000001', district: 'Bengaluru', incident_date: '02/02/24', latitude: 99, longitude: 77.6, victim_name: 'Masked B', crime_type: 'Robbery'},
  ];

  it('infers canonical crime entities without sending raw rows to a model', () => {
    const result = inferCanonicalCrimeModel(rows);
    expect(result.entities.map((entity) => entity.name)).toContain('Incident');
    expect(result.entities.map((entity) => entity.name)).toContain('Location');
    expect(result.schemaOnly).toBe(true);
    expect(result.rawRowsSentToModel).toBe(0);
  });

  it('detects duplicates, aliases, and impossible coordinates', () => {
    const result = analyzeCrimeDataQuality(rows);
    expect(result.duplicateRows).toBe(1);
    expect(result.corrections.some((item) => item.to === 'Bengaluru Urban')).toBe(true);
    expect(result.issues.some((item) => item.code === 'OUTSIDE_KARNATAKA_BOUNDS')).toBe(true);
    expect(result.humanApprovalRequired).toBe(true);
  });
});

describe('Crime Intelligence OS investigation planning', () => {
  it('combines relational, spatial, and graph planning for officer questions', () => {
    const result = buildInvestigationPlan(
      'Show all robbery cases linked with a white Swift car within 15 km during the last 6 months involving repeat offenders in Mysuru',
    );
    expect(result.parsedIntent).toMatchObject({
      crimeType: 'Robbery',
      vehicleColor: 'white',
      vehicleModel: 'swift',
      distanceKm: 15,
      months: 6,
      repeatOffenders: true,
    });
    expect(result.executionPlan.relational.template).toContain('$1');
    expect(result.executionPlan.spatial.template).toContain('ST_DWithin');
    expect(result.executionPlan.graph.template).toContain('MATCH');
    expect(result.safety.executesArbitrarySql).toBe(false);
    expect(result.safety.humanVerificationRequired).toBe(true);
  });

  it('explains graph links using evidence-backed reason codes', () => {
    const result = explainGraphConnection({
      source: 'person-a',
      target: 'person-b',
      evidence: ['Shared phone number', 'Both appear in FIR-42'],
    });
    expect(result.reasons.map((reason) => reason.code)).toContain('SHARED_PHONE');
    expect(result.reasons.map((reason) => reason.code)).toContain('SHARED_INCIDENT');
    expect(result.status).toBe('explainable_lead');
  });
});

describe('Crime Intelligence OS operational decision support', () => {
  it('detects a spatiotemporal incident cluster without sending notifications directly', () => {
    const events = Array.from({length: 5}, (_, index) => ({
      id: `incident-${index + 1}`,
      latitude: 12.9716 + index * 0.0001,
      longitude: 77.5946 + index * 0.0001,
      occurredAt: `2024-02-01T10:${String(index).padStart(2, '0')}:00Z`,
    }));
    const result = evaluateRealtimeAlertRule(events, {thresholdCount: 5, radiusKm: 2, windowHours: 2, channels: ['dashboard', 'email']});
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].deliveryStatus).toBe('planned');
    expect(result.alerts[0].reasonCodes).toContain('SPATIAL_PROXIMITY');
  });

  it('runs a bounded prediction sandbox with explicit limitations', () => {
    const result = runPredictionSandbox({baselineRisk: 65, patrolChangePercent: 20, festivalIntensity: 50, recentTrendPercent: 10});
    expect(result.simulatedRisk).toBeGreaterThanOrEqual(0);
    expect(result.simulatedRisk).toBeLessThanOrEqual(100);
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.humanVerificationRequired).toBe(true);
  });

  it('plans multi-format reports with review and signing requirements', () => {
    const result = planReportPackage({reportType: 'SCRB_MONTHLY', formats: ['pdf', 'powerpoint', 'excel']});
    expect(result.formats).toEqual(['PDF', 'POWERPOINT', 'EXCEL']);
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.signingRequired).toBe(true);
  });

  it('publishes a capability manifest for all requested modules', () => {
    const manifest = getCrimeIntelligenceOSManifest();
    expect(manifest.capabilities).toHaveLength(15);
    expect(manifest.agents.length).toBeGreaterThanOrEqual(7);
    expect(manifest.safetyBoundary.frontendCallsModelsDirectly).toBe(false);
  });
});
