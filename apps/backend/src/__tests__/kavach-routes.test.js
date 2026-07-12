import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRepo = vi.hoisted(() => {
  const incidents = [
    { fir_number: 'FIR001', crime_type: 'Theft', incident_date: '2024-01-15', incident_time: '14:30', district: 'Bengaluru Urban', police_station: 'Cubbon Park', severity: 'MEDIUM', status: 'CLOSED', latitude: 12.97, longitude: 77.59, modus_operandi: 'Pickpocketing' },
    { fir_number: 'FIR002', crime_type: 'Assault', incident_date: '2024-02-20', incident_time: '22:15', district: 'Mysuru', police_station: 'Krishnaraja', severity: 'HIGH', status: 'UNDER_INVESTIGATION', latitude: 12.30, longitude: 76.65, modus_operandi: 'Confrontation' },
    { fir_number: 'FIR003', crime_type: 'Burglary', incident_date: '2024-03-10', incident_time: '03:00', district: 'Bengaluru Urban', police_station: 'Koramangala', severity: 'HIGH', status: 'PENDING', latitude: 12.93, longitude: 77.62, modus_operandi: 'Forceful entry' },
    { fir_number: 'FIR004', crime_type: 'Theft', incident_date: '2024-04-05', incident_time: '11:00', district: 'Mysuru', police_station: 'Nazarbad', severity: 'LOW', status: 'CLOSED', latitude: 12.31, longitude: 76.64, modus_operandi: 'Pickpocketing' },
    { fir_number: 'FIR005', crime_type: 'Cybercrime', incident_date: '2024-05-18', incident_time: '09:00', district: 'Bengaluru Urban', police_station: 'Whitefield', severity: 'CRITICAL', status: 'UNDER_INVESTIGATION', latitude: 12.97, longitude: 77.75, modus_operandi: 'Phishing link' },
    { fir_number: 'FIR006', crime_type: 'Robbery', incident_date: '2024-06-22', district: 'Belagavi', police_station: 'Maruti', severity: 'HIGH', status: 'COLD', latitude: 15.85, longitude: 74.50, modus_operandi: 'Confrontation' },
  ];
  const persons = [
    { person_id: 'P001', name: 'Rajesh Kumar', age: 28, gender: 'Male', phone: '9876543210', vehicle: 'KA01AB1234', address: '123 Main St' },
    { person_id: 'P002', name: 'Suresh Patel', age: 35, gender: 'Male', phone: '9876543211', vehicle: 'KA02CD5678', address: '456 Oak Ave' },
    { person_id: 'P003', name: 'Anita Sharma', age: 42, gender: 'Female', phone: '9876543212', vehicle: null },
    { person_id: 'P004', name: 'Vijay Singh', age: 22, gender: 'Male', phone: null, vehicle: 'KA03EF9012' },
  ];
  const relationships = [
    { source_id: 'P001', target_id: 'FIR001', relationship_type: 'ACCUSED_IN', evidence: ['Witness'] },
    { source_id: 'P001', target_id: 'FIR003', relationship_type: 'ACCUSED_IN', evidence: ['CCTV'] },
    { source_id: 'P002', target_id: 'FIR002', relationship_type: 'ACCUSED_IN', evidence: ['Fingerprint'] },
    { source_id: 'P002', target_id: 'FIR005', relationship_type: 'ACCUSED_IN', evidence: ['IP'] },
    { source_id: 'P002', target_id: 'FIR006', relationship_type: 'ACCUSED_IN', evidence: ['Witness'] },
    { source_id: 'P003', target_id: 'FIR004', relationship_type: 'VICTIM_IN', evidence: null },
    { source_id: 'P004', target_id: 'FIR005', relationship_type: 'ACCUSED_IN', evidence: ['Transaction'] },
  ];
  const incidentPersons = [
    { incident_id: 'FIR001', person_id: 'P001', role: 'OFFENDER' },
    { incident_id: 'FIR003', person_id: 'P001', role: 'OFFENDER' },
    { incident_id: 'FIR002', person_id: 'P002', role: 'OFFENDER' },
    { incident_id: 'FIR005', person_id: 'P002', role: 'OFFENDER' },
    { incident_id: 'FIR006', person_id: 'P002', role: 'OFFENDER' },
    { incident_id: 'FIR004', person_id: 'P003', role: 'VICTIM' },
    { incident_id: 'FIR005', person_id: 'P004', role: 'OFFENDER' },
  ];
  const indicators = [
    { district: 'Bengaluru Urban', population: 8500000, literacyRate: 89.6, unemploymentRate: 4.2, policePresence: 120, povertyRate: 8.5, urbanizationRate: 98 },
    { district: 'Mysuru', population: 3200000, literacyRate: 82.4, unemploymentRate: 6.1, policePresence: 65, povertyRate: 12.3, urbanizationRate: 45 },
    { district: 'Belagavi', population: 2800000, literacyRate: 75.8, unemploymentRate: 7.5, policePresence: 50, povertyRate: 15.2, urbanizationRate: 38 },
  ];

  return {
    incidents,
    persons,
    relationships,
    incidentPersons,
    indicators,
  };
});

vi.mock('../kavach/kavach-repository.js', () => {
  return {
    KavachRepository: vi.fn(() => ({
      incidents: mockRepo.incidents,
      persons: mockRepo.persons,
      relationships: mockRepo.relationships,
      incidentPersons: mockRepo.incidentPersons,
      districtIndicators: mockRepo.indicators,
      policeStations: {
        'Bengaluru Urban': ['Cubbon Park', 'Koramangala', 'Whitefield'],
        'Mysuru': ['Krishnaraja', 'Nazarbad'],
        'Belagavi': ['Maruti'],
      },
      loaded: true,
      loadError: null,
      getIncidents(f) { return this._applyIncidentFilters(this.incidents, f || {}); },
      getPersons() { return this.persons; },
      getPersonById(id) { return this.persons.find(p => p.person_id === id) || null; },
      getRelationships() { return this.relationships; },
      getIncidentPersons() { return this.incidentPersons; },
      getDistrictIndicators() { return this.districtIndicators; },
      getPoliceStations() { return this.policeStations; },
      getIncidentById(f) { return this.incidents.find(i => i.fir_number === f) || null; },
      getDistinctDistricts() { return [...new Set(this.incidents.map(i => i.district).filter(Boolean))]; },
      getIncidentsByDistrict() {
        const map = {};
        for (const inc of this.incidents) {
          const d = inc.district || 'Unknown';
          if (!map[d]) map[d] = [];
          map[d].push(inc);
        }
        return map;
      },
      getIncidentsForPerson(personId) {
        const links = this.incidentPersons.filter(ip => ip.person_id === personId);
        const firs = links.map(l => l.incident_id);
        return this.incidents.filter(i => firs.includes(i.fir_number));
      },
      getAssociates(personId) {
        const pis = this.incidentPersons.filter(ip => ip.person_id === personId);
        const iids = new Set(pis.map(ip => ip.incident_id));
        const linked = this.incidentPersons.filter(ip => iids.has(ip.incident_id) && ip.person_id !== personId);
        const linkedIds = [...new Set(linked.map(l => l.person_id))];
        return linkedIds.map(id => this.persons.find(p => p.person_id === id)).filter(Boolean);
      },
      _applyIncidentFilters(incidents, filters) {
        let r = [...incidents];
        if (filters.district) r = r.filter(i => i.district === filters.district);
        if (filters.policeStation) r = r.filter(i => (i.police_station || '').toLowerCase() === filters.policeStation.toLowerCase());
        if (filters.crimeType) r = r.filter(i => (i.crime_type || '').toLowerCase() === filters.crimeType.toLowerCase());
        if (filters.severity) r = r.filter(i => i.severity === filters.severity.toUpperCase());
        if (filters.status) r = r.filter(i => i.status === filters.status.toUpperCase());
        if (filters.dateFrom) r = r.filter(i => i.incident_date && i.incident_date >= filters.dateFrom);
        if (filters.dateTo) r = r.filter(i => i.incident_date && i.incident_date <= filters.dateTo);
        if (filters.timeOfDay) r = r.filter(i => {
          if (!i.incident_time) return false;
          const h = parseInt(i.incident_time.split(':')[0], 10);
          const p = filters.timeOfDay.toLowerCase();
          if (p === 'dawn') return h >= 5 && h < 7;
          if (p === 'morning') return h >= 7 && h < 12;
          if (p === 'afternoon') return h >= 12 && h < 17;
          if (p === 'evening') return h >= 17 && h < 21;
          if (p === 'night') return h >= 21 || h < 0;
          if (p === 'late_night') return h >= 0 && h < 5;
          return true;
        });
        return r;
      },
      _normalizeIncidents() {},
      _normalizeIndicators() {},
      loadAll() { this.loaded = true; },
    })),
  };
});

import { handleKavachRoutes } from '../routes/kavach.js';

function makeResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          this.headers[k.toLowerCase()] = v;
        }
      }
    },
    end(chunk = '') {
      this.body += chunk;
      this.ended = true;
    },
    json() {
      return JSON.parse(this.body || '{}');
    },
  };
  return res;
}

function makeGetRequest(pathname, params = {}) {
  const sp = new URLSearchParams(params);
  return {
    method: 'GET',
    pathname,
    searchParams: sp,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('');
    },
  };
}

function makePostRequest(pathname, body = {}) {
  const jsonString = JSON.stringify(body);
  return {
    method: 'POST',
    pathname,
    searchParams: new URLSearchParams(),
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(jsonString);
    },
  };
}

describe('Kavach Routes', () => {
  it('GET /api/kavach/overview returns 200 with data', async () => {
    const req = makeGetRequest('/api/kavach/overview');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('totalIncidents');
    expect(json.data.totalIncidents).toBe(6);
    expect(json.message).toBe('Overview retrieved');
  });

  it('GET /api/kavach/districts returns district list', async () => {
    const req = makeGetRequest('/api/kavach/districts');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty('district');
  });

  it('GET /api/kavach/hotspots returns hotspot list', async () => {
    const req = makeGetRequest('/api/kavach/hotspots');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty('score');
  });

  it('GET /api/kavach/offenders returns offenders', async () => {
    const req = makeGetRequest('/api/kavach/offenders');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty('classification');
  });

  it('GET /api/kavach/alerts returns alerts', async () => {
    const req = makeGetRequest('/api/kavach/alerts');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/kavach/copilot/suggestions returns suggestions', async () => {
    const req = makeGetRequest('/api/kavach/copilot/suggestions');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(9);
  });

  it('POST /api/kavach/copilot/query returns deterministic response', async () => {
    const req = makePostRequest('/api/kavach/copilot/query', { query: 'Show me the overview' });
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.type).toBe('overview');
    expect(json.data.message).toContain('Total incidents');
  });

  it('GET /api/kavach/data/load returns load status', async () => {
    const req = makeGetRequest('/api/kavach/data/load');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('loaded');
  });

  it('GET /api/kavach/districts/:district returns district analysis', async () => {
    const req = makeGetRequest('/api/kavach/districts/Bengaluru%20Urban');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, '/api/kavach/districts/Bengaluru Urban');
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.district).toBe('Bengaluru Urban');
  });

  it('GET /api/kavach/districts/:district returns 404 for unknown district', async () => {
    const req = makeGetRequest('/api/kavach/districts/UnknownDistrict');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, '/api/kavach/districts/UnknownDistrict');
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/kavach/trends/monthly returns sorted monthly trends', async () => {
    const req = makeGetRequest('/api/kavach/trends/monthly');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('GET /api/kavach/anomalies returns anomalies', async () => {
    const req = makeGetRequest('/api/kavach/anomalies');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/kavach/network returns network graph', async () => {
    const req = makeGetRequest('/api/kavach/network');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('nodes');
    expect(json.data).toHaveProperty('edges');
  });

  it('GET /api/kavach/risk/districts returns district risk scores', async () => {
    const req = makeGetRequest('/api/kavach/risk/districts');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('GET /api/kavach/correlations returns correlations', async () => {
    const req = makeGetRequest('/api/kavach/correlations');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(typeof json.data).toBe('object');
  });

  it('returns 404 for unknown routes', async () => {
    const req = makeGetRequest('/api/kavach/nonexistent');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(false);
  });

  it('GET /api/kavach/alerts with filter returns filtered results', async () => {
    const req = makeGetRequest('/api/kavach/alerts', { severity: 'WARNING' });
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    for (const alert of json.data) {
      expect(alert.severity).toBe('WARNING');
    }
  });

  it('GET /api/kavach/hotspots with district filter', async () => {
    const req = makeGetRequest('/api/kavach/hotspots', { district: 'Bengaluru Urban' });
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    for (const h of json.data) {
      expect(h.district).toBe('Bengaluru Urban');
    }
  });

  it('GET /api/kavach/hotspots/:id returns specific hotspot', async () => {
    const req = makeGetRequest('/api/kavach/hotspots/bengaluru-urban');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, '/api/kavach/hotspots/bengaluru-urban');
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('bengaluru-urban');
  });

  it('GET /api/kavach/risk/distribution returns risk distribution', async () => {
    const req = makeGetRequest('/api/kavach/risk/distribution');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('distribution');
    expect(json.data).toHaveProperty('total');
    expect(json.data.total).toBeGreaterThan(0);
  });

  it('GET /api/kavach/network/components returns components', async () => {
    const req = makeGetRequest('/api/kavach/network/components');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/kavach/trends/weekly returns weekly trends', async () => {
    const req = makeGetRequest('/api/kavach/trends/weekly');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /api/kavach/schema/map returns schema mapping', async () => {
    const req = makeGetRequest('/api/kavach/schema/map');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, req.pathname);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('columns');
    expect(json.data).toHaveProperty('mappings');
  });

  it('GET /api/kavach/offenders/:id returns offender detail', async () => {
    const req = makeGetRequest('/api/kavach/offenders/P001');
    const res = makeResponse();
    const handled = await handleKavachRoutes(req, res, '/api/kavach/offenders/P001');
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.person.person_id).toBe('P001');
  });
});
