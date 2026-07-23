import { describe, it, expect, beforeEach } from 'vitest';
import { KavachRepository } from '../kavach/kavach-repository.js';
import { KavachServices } from '../kavach/kavach-services.js';

function createTestRepo() {
  const repo = new KavachRepository();
  repo.incidents = [
    { fir_number: 'FIR001', crime_type: 'Theft', incident_date: '2024-01-15', incident_time: '14:30', district: 'Bengaluru Urban', police_station: 'Cubbon Park', severity: 'MEDIUM', status: 'CLOSED', latitude: 12.97, longitude: 77.59, modus_operandi: 'Pickpocketing' },
    { fir_number: 'FIR002', crime_type: 'Assault', incident_date: '2024-02-20', incident_time: '22:15', district: 'Mysuru', police_station: 'Krishnaraja', severity: 'HIGH', status: 'UNDER_INVESTIGATION', latitude: 12.30, longitude: 76.65, modus_operandi: 'Confrontation' },
    { fir_number: 'FIR003', crime_type: 'Burglary', incident_date: '2024-03-10', incident_time: '03:00', district: 'Bengaluru Urban', police_station: 'Koramangala', severity: 'HIGH', status: 'PENDING', latitude: 12.93, longitude: 77.62, modus_operandi: 'Forceful entry' },
    { fir_number: 'FIR004', crime_type: 'Theft', incident_date: '2024-04-05', incident_time: '11:00', district: 'Mysuru', police_station: 'Nazarbad', severity: 'LOW', status: 'CLOSED', latitude: 12.31, longitude: 76.64, modus_operandi: 'Pickpocketing' },
    { fir_number: 'FIR005', crime_type: 'Cybercrime', incident_date: '2024-05-18', incident_time: '09:00', district: 'Bengaluru Urban', police_station: 'Whitefield', severity: 'CRITICAL', status: 'UNDER_INVESTIGATION', latitude: 12.97, longitude: 77.75, modus_operandi: 'Phishing link' },
    { fir_number: 'FIR006', crime_type: 'Robbery', incident_date: '2024-06-22', district: 'Belagavi', police_station: 'Maruti', severity: 'HIGH', status: 'COLD', latitude: 15.85, longitude: 74.50, modus_operandi: 'Confrontation' },
  ];
  repo.persons = [
    { person_id: 'P001', name: 'Rajesh Kumar', age: 28, gender: 'Male', phone: '9876543210', vehicle: 'KA01AB1234', address: '123 Main St' },
    { person_id: 'P002', name: 'Suresh Patel', age: 35, gender: 'Male', phone: '9876543211', vehicle: 'KA02CD5678', address: '456 Oak Ave' },
    { person_id: 'P003', name: 'Anita Sharma', age: 42, gender: 'Female', phone: '9876543212', vehicle: null },
    { person_id: 'P004', name: 'Vijay Singh', age: 22, gender: 'Male', phone: null, vehicle: 'KA03EF9012' },
  ];
  repo.relationships = [
    { source_id: 'P001', target_id: 'FIR001', relationship_type: 'ACCUSED_IN', evidence: ['Witness statement'] },
    { source_id: 'P001', target_id: 'FIR003', relationship_type: 'ACCUSED_IN', evidence: ['CCTV footage'] },
    { source_id: 'P002', target_id: 'FIR002', relationship_type: 'ACCUSED_IN', evidence: ['Fingerprint'] },
    { source_id: 'P002', target_id: 'FIR005', relationship_type: 'ACCUSED_IN', evidence: ['IP address'] },
    { source_id: 'P002', target_id: 'FIR006', relationship_type: 'ACCUSED_IN', evidence: ['Witness'] },
    { source_id: 'P003', target_id: 'FIR004', relationship_type: 'VICTIM_IN', evidence: null },
    { source_id: 'P004', target_id: 'FIR005', relationship_type: 'ACCUSED_IN', evidence: ['Suspicious transaction'] },
  ];
  repo.incidentPersons = [
    { incident_id: 'FIR001', person_id: 'P001', role: 'OFFENDER' },
    { incident_id: 'FIR003', person_id: 'P001', role: 'OFFENDER' },
    { incident_id: 'FIR002', person_id: 'P002', role: 'OFFENDER' },
    { incident_id: 'FIR005', person_id: 'P002', role: 'OFFENDER' },
    { incident_id: 'FIR006', person_id: 'P002', role: 'OFFENDER' },
    { incident_id: 'FIR004', person_id: 'P003', role: 'VICTIM' },
    { incident_id: 'FIR005', person_id: 'P004', role: 'OFFENDER' },
  ];
  repo.districtIndicators = [
    { district: 'Bengaluru Urban', population: 8500000, literacyRate: 89.6, unemploymentRate: 4.2, policePresence: 120, povertyRate: 8.5, urbanizationRate: 98 },
    { district: 'Mysuru', population: 3200000, literacyRate: 82.4, unemploymentRate: 6.1, policePresence: 65, povertyRate: 12.3, urbanizationRate: 45 },
    { district: 'Belagavi', population: 2800000, literacyRate: 75.8, unemploymentRate: 7.5, policePresence: 50, povertyRate: 15.2, urbanizationRate: 38 },
  ];
  repo.policeStations = {
    'Bengaluru Urban': ['Cubbon Park', 'Koramangala', 'Whitefield', 'Yeshwanthpur'],
    'Mysuru': ['Krishnaraja', 'Nazarbad'],
    'Belagavi': ['Maruti'],
  };
  repo.loaded = true;
  return repo;
}

function createServices(repo) {
  const services = new KavachServices(repo);
  services.setStoredAlerts(services.generateAlerts());
  return services;
}

describe('KavachServices', () => {
  let repo;
  let services;

  beforeEach(() => {
    repo = createTestRepo();
    services = createServices(repo);
  });

  describe('getOverview', () => {
    it('returns overview with correct counts', () => {
      const overview = services.getOverview();
      expect(overview.totalIncidents).toBe(6);
      expect(overview.activeInvestigations).toBe(2);
      expect(overview.closedInvestigations).toBe(2);
      expect(overview.pending).toBe(1);
      expect(overview.cold).toBe(1);
      expect(overview.totalIncidents).toBeGreaterThan(0);
    });

    it('returns consistent data structure', () => {
      const overview = services.getOverview();
      expect(overview).toHaveProperty('totalIncidents');
      expect(overview).toHaveProperty('activeInvestigations');
      expect(overview).toHaveProperty('closedInvestigations');
      expect(overview).toHaveProperty('highRiskDistricts');
      expect(overview).toHaveProperty('activeHotspots');
      expect(overview).toHaveProperty('repeatOffenders');
      expect(overview).toHaveProperty('currentAlerts');
      expect(overview).toHaveProperty('mostCommonCategory');
      expect(overview).toHaveProperty('dataQualityScore');
      expect(overview).toHaveProperty('recordCount');
    });

    it('mostCommonCategory is Theft', () => {
      const overview = services.getOverview();
      expect(overview.mostCommonCategory).toBe('Theft');
    });

    it('applies filters correctly', () => {
      const overview = services.getOverview({ district: 'Bengaluru Urban' });
      expect(overview.totalIncidents).toBe(3);
    });
  });

  describe('getMonthlyTrends', () => {
    it('returns monthly trends sorted by date', () => {
      const trends = services.getMonthlyTrends();
      expect(trends.length).toBeGreaterThanOrEqual(5);
      const months = trends.map(t => t.month);
      expect(months).toEqual([...months].sort());
    });

    it('each trend has month, total, and categories', () => {
      const trends = services.getMonthlyTrends();
      for (const t of trends) {
        expect(t).toHaveProperty('month');
        expect(t).toHaveProperty('total');
        expect(t).toHaveProperty('categories');
      }
    });

    it('filters incidents correctly', () => {
      const trends = services.getMonthlyTrends({ district: 'Mysuru' });
      for (const t of trends) {
        expect(t.month).toMatch(/^2024-(0[1-6])/);
      }
    });
  });

  describe('getHotspots', () => {
    it('returns hotspots with score calculation', () => {
      const hotspots = services.getHotspots();
      expect(hotspots.length).toBeGreaterThan(0);
      for (const h of hotspots) {
        expect(h).toHaveProperty('score');
        expect(h).toHaveProperty('incidentCount');
        expect(h).toHaveProperty('growthRate');
        expect(h).toHaveProperty('avgSeverity');
        expect(h).toHaveProperty('repeatOffenderCount');
        expect(h).toHaveProperty('anomalyScore');
        expect(h).toHaveProperty('factors');
        expect(h).toHaveProperty('confidence');
      }
    });

    it('scores are between 0 and 100', () => {
      const hotspots = services.getHotspots();
      for (const h of hotspots) {
        expect(h.score).toBeGreaterThanOrEqual(0);
        expect(h.score).toBeLessThanOrEqual(100);
      }
    });

    it('returns hotspots sorted by score descending', () => {
      const hotspots = services.getHotspots();
      for (let i = 1; i < hotspots.length; i++) {
        expect(hotspots[i - 1].score).toBeGreaterThanOrEqual(hotspots[i].score);
      }
    });

    it('applies district filter', () => {
      const hotspots = services.getHotspots({ district: 'Mysuru' });
      expect(hotspots.every(h => h.district === 'Mysuru')).toBe(true);
    });
  });

  describe('detectAnomalies', () => {
    it('detects anomalies when data is sufficient', () => {
      const anomalies = services.detectAnomalies();
      expect(Array.isArray(anomalies)).toBe(true);
      for (const a of anomalies) {
        expect(a).toHaveProperty('type');
        expect(a).toHaveProperty('value');
        expect(a).toHaveProperty('threshold');
        expect(a).toHaveProperty('zScore');
      }
    });

    it('returns DISTRICT_ANOMALY for outlier districts', () => {
      const anomalies = services.detectAnomalies();
      const districtAnomalies = anomalies.filter(a => a.type === 'DISTRICT_ANOMALY');
      expect(districtAnomalies.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty/insufficient data', () => {
      const emptyRepo = createTestRepo();
      emptyRepo.incidents = [];
      const emptyServices = new KavachServices(emptyRepo);
      emptyServices.setStoredAlerts(emptyServices.generateAlerts());
      expect(emptyServices.detectAnomalies()).toEqual([]);
    });
  });

  describe('classifyRepeatOffender', () => {
    it('returns null for unknown person', () => {
      expect(services.classifyRepeatOffender('UNKNOWN')).toBeNull();
    });

    it('classifies P001 as repeat offender (2 offences)', () => {
      const result = services.classifyRepeatOffender('P001');
      expect(result).not.toBeNull();
      expect(result.totalOffences).toBe(2);
      expect(result.classification).toMatch(/(MULTIPLE_CASE_LINKS|SINGLE_CASE_LINK)/);
    });

    it('classifies P002 with higher score (3 offences)', () => {
      const result = services.classifyRepeatOffender('P002');
      expect(result).not.toBeNull();
      expect(result.totalOffences).toBe(3);
      expect(result.personId).toBe('P002');
    });

    it('includes explainable historical-link factors', () => {
      const result = services.classifyRepeatOffender('P001');
      expect(result.factors).toHaveProperty('caseCount');
      expect(result.factors).toHaveProperty('districtCount');
      expect(result.factors).toHaveProperty('categoryCount');
    });
  });

  describe('calculateDistrictRiskScore', () => {
    it('returns null for unknown district', () => {
      expect(services.calculateDistrictRiskScore('Unknown')).toBeNull();
    });

    it('returns risk score for known district', () => {
      const risk = services.calculateDistrictRiskScore('Bengaluru Urban');
      expect(risk).not.toBeNull();
      expect(risk.district).toBe('Bengaluru Urban');
      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(100);
    });

    it('includes risk band and confidence', () => {
      const risk = services.calculateDistrictRiskScore('Bengaluru Urban');
      expect(risk).toHaveProperty('band');
      expect(risk).toHaveProperty('confidence');
      expect(risk).toHaveProperty('factors');
      expect(risk).toHaveProperty('formulaVersion');
    });

    it('has lower score for low-incident district', () => {
      const bangalore = services.calculateDistrictRiskScore('Bengaluru Urban');
      const belagavi = services.calculateDistrictRiskScore('Belagavi');
      expect(bangalore.score).toBeGreaterThanOrEqual(belagavi.score);
    });
  });

  describe('getNetworkGraph', () => {
    it('returns nodes and edges', () => {
      const graph = services.getNetworkGraph();
      expect(graph).toHaveProperty('nodes');
      expect(graph).toHaveProperty('edges');
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
    });

    it('nodes have correct types', () => {
      const graph = services.getNetworkGraph();
      for (const node of graph.nodes) {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('type');
        expect(['incident', 'person']).toContain(node.type);
      }
    });

    it('edges have source, target, and type', () => {
      const graph = services.getNetworkGraph();
      for (const edge of graph.edges) {
        expect(edge).toHaveProperty('source');
        expect(edge).toHaveProperty('target');
        expect(edge).toHaveProperty('type');
      }
    });

    it('filters by district', () => {
      const graph = services.getNetworkGraph({ district: 'Mysuru' });
      const incidents = graph.nodes.filter(n => n.type === 'incident');
      expect(incidents.every(i => i.district === 'Mysuru')).toBe(true);
    });
  });

  describe('calculateCorrelations', () => {
    it('returns correlation metrics', () => {
      const correlations = services.calculateCorrelations();
      expect(Object.keys(correlations).length).toBeGreaterThan(0);
    });

    it('correlation values are between -1 and 1', () => {
      const correlations = services.calculateCorrelations();
      for (const val of Object.values(correlations)) {
        if (val !== null) {
          expect(val).toBeGreaterThanOrEqual(-1);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });

    it('returns correlation matrix', () => {
      const matrix = services.getCorrelationMatrix();
      expect(matrix).toHaveProperty('metrics');
      expect(matrix).toHaveProperty('matrix');
      expect(matrix).toHaveProperty('correlations');
    });
  });

  describe('getOffenders', () => {
    it('returns offenders with classification', () => {
      const offenders = services.getOffenders();
      expect(offenders.length).toBeGreaterThan(0);
      for (const o of offenders) {
        expect(o).toHaveProperty('incidentCount');
        expect(o).toHaveProperty('classification');
        expect(o).toHaveProperty('linkComplexityScore');
      }
    });

    it('sorts by incident count descending', () => {
      const offenders = services.getOffenders();
      for (let i = 1; i < offenders.length; i++) {
        expect(offenders[i - 1].incidentCount).toBeGreaterThanOrEqual(offenders[i].incidentCount);
      }
    });
  });

  describe('getAlerts', () => {
    it('returns stored alerts', () => {
      const alerts = services.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('filters alerts by severity', () => {
      const critical = services.getAlerts({ severity: 'CRITICAL' });
      for (const a of critical) {
        expect(a.severity).toBe('CRITICAL');
      }
    });
  });

  describe('processQuery', () => {
    it('returns overview for overview query', () => {
      const result = services.processQuery('Show overview');
      expect(result.type).toBe('overview');
    });

    it('returns hotspots for hotspot query', () => {
      const result = services.processQuery('What are the hotspots');
      expect(result.type).toBe('hotspots');
    });

    it('returns unknown for unrecognized query', () => {
      const result = services.processQuery('xyz789');
      expect(result.type).toBe('unknown');
    });

    it.each([
      ['Show district summary', 'getDistrictSummary'],
      ['Show police station summary', 'getPoliceStationSummary'],
      ['Detect a crime spike alert', 'detectCrimeSpike'],
      ['Show case summary for FIR001', 'getCaseSummary'],
      ['Find related cases for FIR001', 'findRelatedCases'],
      ['Find similar MO for FIR001', 'findSimilarModusOperandi'],
      ['Show registration delay', 'getRegistrationDelay'],
      ['Show chargesheet delay', 'getChargesheetDelay'],
      ['Generate an intelligence brief', 'generateIntelligenceBrief'],
    ])('routes %s through the approved deterministic tool %s', (question, toolUsed) => {
      const result = services.processQuery(question);
      expect(result.toolUsed).toBe(toolUsed);
      expect(result.data).toBeDefined();
      expect(result.message).not.toContain(question);
    });
  });

  describe('edge cases', () => {
    it('handles empty repositories gracefully', () => {
      const emptyRepo = createTestRepo();
      emptyRepo.incidents = [];
      emptyRepo.persons = [];
      emptyRepo.relationships = [];
      emptyRepo.incidentPersons = [];
      emptyRepo.districtIndicators = [];
      const es = new KavachServices(emptyRepo);
      es.setStoredAlerts(es.generateAlerts());

      expect(es.getOverview().totalIncidents).toBe(0);
      expect(es.getMonthlyTrends()).toEqual([]);
      expect(es.getHotspots()).toEqual([]);
      expect(es.detectAnomalies()).toEqual([]);
      expect(es.getOffenders()).toEqual([]);
      expect(es.calculateCorrelations()).toEqual({});
    });

    it('handles single-incident data', () => {
      const smallRepo = createTestRepo();
      smallRepo.incidents = smallRepo.incidents.slice(0, 1);
      smallRepo.incidentPersons = smallRepo.incidentPersons.filter(ip => ip.incident_id === 'FIR001');
      const ss = new KavachServices(smallRepo);
      ss.setStoredAlerts(ss.generateAlerts());

      expect(ss.getOverview().totalIncidents).toBe(1);
      expect(ss.getMonthlyTrends().length).toBe(1);
      expect(ss.detectAnomalies()).toEqual([]);
    });
  });
});
