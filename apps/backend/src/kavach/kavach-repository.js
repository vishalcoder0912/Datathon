import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { PIIMask, normalizeDistrictName } from '@kavach/domain';

const DATA_DIR = path.resolve('data', 'demo');

export class KavachRepository {
  constructor() {
    this.incidents = [];
    this.persons = [];
    this.relationships = [];
    this.incidentPersons = [];
    this.districtIndicators = [];
    this.policeStations = {};
    this.loaded = false;
    this.loadError = null;
  }

  loadAll() {
    try {
      this.incidents = this._loadCSV('karnataka-crime-incidents.csv');
      this._normalizeIncidents();
      this.persons = this._loadJSON('karnataka-persons.json');
      this.relationships = this._loadJSON('karnataka-relationships.json');
      this.incidentPersons = this._loadJSON('karnataka-incident-persons.json');
      this.districtIndicators = this._loadCSV('karnataka-district-indicators.csv');
      this._normalizeIndicators();
      this.policeStations = this._loadJSON('karnataka-police-stations.json');
      this.loaded = true;
      console.log(`[KavachRepo] Loaded ${this.incidents.length} incidents, ${this.persons.length} persons, ${this.relationships.length} relationships, ${this.incidentPersons.length} incident-persons, ${this.districtIndicators.length} indicators`);
    } catch (err) {
      this.loadError = err.message;
      console.error('[KavachRepo] Load error:', err.message);
    }
  }

  _loadCSV(filename) {
    const filePath = path.join(DATA_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: true });
    return parsed.data;
  }

  _loadJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  _normalizeIncidents() {
    for (const inc of this.incidents) {
      inc.incident_date = inc.incident_date || null;
      inc.incident_time = inc.incident_time || null;
      inc.latitude = inc.latitude != null ? Number(inc.latitude) : null;
      inc.longitude = inc.longitude != null ? Number(inc.longitude) : null;
      inc.severity = (inc.severity || '').toUpperCase();
      inc.status = (inc.status || '').toUpperCase();
    }
  }

  _normalizeIndicators() {
    for (const ind of this.districtIndicators) {
      ind.population = ind.population != null ? Number(ind.population) : null;
      ind.literacyRate = ind.literacyRate != null ? Number(ind.literacyRate) : null;
      ind.unemploymentRate = ind.unemploymentRate != null ? Number(ind.unemploymentRate) : null;
      ind.policePresence = ind.policePresence != null ? Number(ind.policePresence) : null;
      ind.povertyRate = ind.povertyRate != null ? Number(ind.povertyRate) : null;
      ind.urbanizationRate = ind.urbanizationRate != null ? Number(ind.urbanizationRate) : null;
    }
  }

  _applyIncidentFilters(incidents, filters = {}) {
    let result = [...incidents];
    const {
      district, policeStation, crimeType, severity, status,
      timeOfDay, dateFrom, dateTo, date
    } = filters;

    if (date) {
      result = result.filter(i => i.incident_date === date);
    }
    if (dateFrom) {
      result = result.filter(i => i.incident_date && i.incident_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(i => i.incident_date && i.incident_date <= dateTo);
    }
    if (district) {
      const normalized = normalizeDistrictName(district) || district;
      result = result.filter(i => {
        const d = normalizeDistrictName(i.district) || i.district;
        return d === normalized;
      });
    }
    if (policeStation) {
      const ps = policeStation.toLowerCase();
      result = result.filter(i => (i.police_station || '').toLowerCase() === ps);
    }
    if (crimeType) {
      const ct = crimeType.toLowerCase();
      result = result.filter(i => (i.crime_type || '').toLowerCase() === ct);
    }
    if (severity) {
      const s = severity.toUpperCase();
      result = result.filter(i => i.severity === s);
    }
    if (status) {
      const st = status.toUpperCase();
      result = result.filter(i => i.status === st);
    }
    if (timeOfDay) {
      result = result.filter(i => this._matchTimeOfDay(i.incident_time, timeOfDay));
    }

    return result;
  }

  _matchTimeOfDay(timeStr, targetPeriod) {
    if (!timeStr) return false;
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return false;
    const period = targetPeriod.toLowerCase();
    if (period === 'dawn') return hour >= 5 && hour < 7;
    if (period === 'morning') return hour >= 7 && hour < 12;
    if (period === 'afternoon') return hour >= 12 && hour < 17;
    if (period === 'evening') return hour >= 17 && hour < 21;
    if (period === 'night') return hour >= 21 || hour < 0;
    if (period === 'late_night') return hour >= 0 && hour < 5;
    return true;
  }

  getIncidents(filters = {}) {
    return this._applyIncidentFilters(this.incidents, filters);
  }

  getPersons() {
    return this._maskPersons(this.persons);
  }

  getPersonById(personId) {
    const person = this.persons.find(p => p.person_id === personId);
    if (!person) return null;
    return this._maskPerson(person);
  }

  _maskPerson(person) {
    return {
      ...person,
      name: PIIMask(person.name, 'name'),
      phone: person.phone ? PIIMask(person.phone, 'phone') : null,
      vehicle: person.vehicle ? PIIMask(person.vehicle, 'vehicle') : null,
      address: person.address ? PIIMask(person.address, 'name') : null,
    };
  }

  _maskPersons(persons) {
    return persons.map(p => this._maskPerson(p));
  }

  getRelationships() {
    return this.relationships;
  }

  getIncidentPersons() {
    return this.incidentPersons;
  }

  getDistrictIndicators() {
    return this.districtIndicators;
  }

  getPoliceStations() {
    return this.policeStations;
  }

  getIncidentById(firNumber) {
    return this.incidents.find(i => i.fir_number === firNumber) || null;
  }

  getIncidentsForPerson(personId) {
    const links = this.incidentPersons.filter(ip => ip.person_id === personId);
    const firNumbers = links.map(l => l.incident_id);
    return this.incidents.filter(i => firNumbers.includes(i.fir_number));
  }

  getAssociates(personId) {
    const personIncidents = this.incidentPersons.filter(ip => ip.person_id === personId);
    const incidentIds = new Set(personIncidents.map(ip => ip.incident_id));
    const linked = this.incidentPersons.filter(ip =>
      incidentIds.has(ip.incident_id) && ip.person_id !== personId
    );
    const linkedPersonIds = [...new Set(linked.map(l => l.person_id))];
    return linkedPersonIds
      .map(id => this.persons.find(p => p.person_id === id))
      .filter(Boolean)
      .map(p => this._maskPerson(p));
  }

  getDistinctDistricts() {
    return [...new Set(this.incidents.map(i => i.district).filter(Boolean))];
  }

  getIncidentsByDistrict() {
    const map = {};
    for (const inc of this.incidents) {
      const d = inc.district || 'Unknown';
      if (!map[d]) map[d] = [];
      map[d].push(inc);
    }
    return map;
  }
}
