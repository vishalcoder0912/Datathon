#!/usr/bin/env node
// scripts/seed-kavach.mjs
// Deterministic synthetic Karnataka crime dataset generator for KAVACH AI prototype

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

function formatDate(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// ---- CONSTANTS ----
const DISTRICTS = [
  'Bengaluru Urban', 'Bengaluru Rural', 'Belagavi', 'Ballari', 'Bidar',
  'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada',
  'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri',
  'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya',
  'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru',
  'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgiri',
];

const CRIME_CATEGORIES = [
  'Cybercrime', 'Vehicle Theft', 'Burglary', 'Assault', 'Robbery',
  'Murder', 'Drug Offence', 'Fraud', 'Kidnapping', 'Domestic Violence',
  'Criminal Trespass', 'Chain Snatching', 'Pickpocketing', 'Sexual Offence', 'Arson',
];

const MODUS_OPERANDI = {
  'Cybercrime': ['Phishing link', 'Social engineering', 'Credential theft', 'Fake call centre', 'Malware attack'],
  'Vehicle Theft': ['Lock breaking', 'Key duplication', 'Towing', 'Carjacking', 'Valet theft'],
  'Burglary': ['Forceful entry', 'Lock picking', 'Window break', 'Rooftop entry', 'Disguised entry'],
  'Assault': ['Confrontation', 'Road rage', 'Group assault', 'Weapon attack', 'Strangulation'],
  'Robbery': ['Armed robbery', 'Chain snatching', 'Bank robbery', 'Highway robbery', 'Home invasion'],
  'Murder': ['Sharp weapon', 'Firearm', 'Poisoning', 'Strangulation', 'Blunt force'],
  'Drug Offence': ['Street peddling', 'Smuggling', 'Manufacturing', 'Transportation', 'Online sale'],
  'Fraud': ['Online scam', 'Credit card fraud', 'Insurance fraud', 'Property fraud', 'Identity theft'],
  'Kidnapping': ['For ransom', 'Custodial', 'Human trafficking', 'Honour related', 'Political'],
  'Domestic Violence': ['Physical abuse', 'Verbal abuse', 'Dowry harassment', 'Marital rape', 'Elder abuse'],
  'Criminal Trespass': ['Illegal occupation', 'Boundary violation', 'Encroachment', 'Temple trespass'],
  'Chain Snatching': ['Roadside snatch', 'Pillion snatch', 'Pedestrian snatch', 'Market snatch'],
  'Pickpocketing': ['Crowd pick', 'Distraction theft', 'Cut pocket', 'Bus pick'],
  'Sexual Offence': ['Harassment', 'Assault', 'Stalking', 'Eve teasing', 'Workplace harassment'],
  'Arson': ['Property arson', 'Vehicle arson', 'Forest fire', 'Industrial arson'],
};

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['PENDING', 'UNDER_INVESTIGATION', 'CLOSED', 'COLD'];

const POLICE_STATIONS = {
  'Bengaluru Urban': ['Cubbon Park', 'Yeshwanthpur', 'Koramangala', 'Whitefield', 'Mysore Road', 'Jayanagar', 'Indiranagar', 'Banashankari'],
  'Bengaluru Rural': ['Doddaballapura', 'Devanahalli', 'Hoskote', 'Nelamangala', 'Magadi'],
  'Mysuru': ['Krishnaraja', 'Nazarbad', 'Kuvempunagar', 'Vijayanagar', 'Udayagiri'],
  'Belagavi': ['Maruti', 'Tilakwadi', 'Shahapur', 'Kadapa', 'Camp'],
  'Kalaburagi': ['Afzalpur', 'Chincholi', 'Sedam', 'Gulbarga North', 'Gulbarga South'],
  'Dakshina Kannada': ['Mangaluru North', 'Mangaluru South', 'Bantwal', 'Puttur', 'Sullia'],
  'Udupi': ['Udupi Town', 'Kundapur', 'Karkala', 'Brahmavar'],
  'Shivamogga': ['Shivamogga Town', 'Bhadravati', 'Sagara', 'Tirthahalli'],
  'Ballari': ['Ballari Town', 'Hospet', 'Kampli', 'Sandur'],
  'Dharwad': ['Hubli North', 'Hubli South', 'Dharwad Town', 'Kalghatgi'],
  'Tumakuru': ['Tumakuru Town', 'Tiptur', 'Kunigal', 'Madhugiri'],
  'Hassan': ['Hassan Town', 'Holenarasipura', 'Arsikere', 'Sakleshpur'],
  'Chitradurga': ['Chitradurga Town', 'Hosadurga', 'Hiriyur', 'Molakalmuru'],
  'Raichur': ['Raichur Town', 'Sindhnur', 'Manvi', 'Lingsugur'],
  'Bidar': ['Bidar Town', 'Bhalki', 'Basavakalyan', 'Humnabad'],
  'Kodagu': ['Madikeri', 'Virajpet', 'Somwarpet', 'Ponnampet'],
  'Vijayapura': ['Vijayapura Town', 'Indi', 'Sindagi', 'Muddebihal'],
  'Kolar': ['Kolar Town', 'Bangarpet', 'KGF', 'Malur'],
  'Chikkamagaluru': ['Chikkamagaluru Town', 'Kadur', 'Mudigere', 'Narasimharajapura'],
  'Haveri': ['Haveri Town', 'Ranebennur', 'Byadgi', 'Hangal'],
  'Gadag': ['Gadag Town', 'Naragund', 'Ron', 'Mundargi'],
  'Mandya': ['Mandya Town', 'Maddur', 'Nagamangala', 'Srirangapatna'],
  'Ramanagara': ['Ramanagara Town', 'Channapatna', 'Kanakapura', 'Magadi'],
  'Koppal': ['Koppal Town', 'Gangavati', 'Kushtagi', 'Yelburga'],
  'Vijayanagara': ['Hospet', 'Kampli'],
  'Yadgiri': ['Yadgiri Town', 'Shahapur', 'Shorapur'],
  'Davanagere': ['Davanagere Town', 'Harihara', 'Jagalur', 'Honnali'],
};

// District coordinates (approximate center)
const DISTRICT_COORDS = {
  'Bengaluru Urban': [12.9716, 77.5946],
  'Bengaluru Rural': [13.1, 77.6],
  'Belagavi': [15.8522, 74.5045],
  'Ballari': [15.1394, 76.9214],
  'Bidar': [17.9133, 77.5301],
  'Chamarajanagar': [11.9235, 76.9478],
  'Chikkaballapur': [13.4333, 77.7333],
  'Chikkamagaluru': [13.3161, 75.7720],
  'Chitradurga': [14.2155, 76.4097],
  'Dakshina Kannada': [12.8696, 74.8468],
  'Davanagere': [14.4586, 75.9242],
  'Dharwad': [15.4589, 75.0078],
  'Gadag': [15.4167, 75.6167],
  'Hassan': [13.0037, 76.1021],
  'Haveri': [14.7954, 75.3978],
  'Kalaburagi': [17.3297, 76.8343],
  'Kodagu': [12.4244, 75.7382],
  'Kolar': [13.1371, 78.1290],
  'Koppal': [15.3457, 76.1536],
  'Mandya': [12.5245, 76.8961],
  'Mysuru': [12.2958, 76.6394],
  'Raichur': [16.2102, 77.3431],
  'Ramanagara': [12.7167, 77.2833],
  'Shivamogga': [13.9299, 75.5681],
  'Tumakuru': [13.3409, 77.1010],
  'Udupi': [13.3409, 74.7421],
  'Uttara Kannada': [14.8136, 74.1294],
  'Vijayanagara': [15.2667, 76.6167],
  'Vijayapura': [16.8302, 75.7100],
  'Yadgiri': [16.7667, 77.1333],
};

const DISTRICT_INDICATORS = {
  'Bengaluru Urban': { population: 8425970, literacyRate: 88.5, unemploymentRate: 4.2, policePresence: 8.5, povertyRate: 5.1, urbanizationRate: 98.0 },
  'Bengaluru Rural': { population: 987257, literacyRate: 82.4, unemploymentRate: 5.1, policePresence: 4.2, povertyRate: 8.3, urbanizationRate: 28.0 },
  'Belagavi': { population: 4779661, literacyRate: 73.5, unemploymentRate: 6.8, policePresence: 3.8, povertyRate: 12.5, urbanizationRate: 35.0 },
  'Ballari': { population: 2452595, literacyRate: 67.4, unemploymentRate: 7.5, policePresence: 3.5, povertyRate: 15.2, urbanizationRate: 42.0 },
  'Bidar': { population: 1703390, literacyRate: 71.0, unemploymentRate: 6.2, policePresence: 3.0, povertyRate: 14.8, urbanizationRate: 30.0 },
  'Chamarajanagar': { population: 1020791, literacyRate: 61.4, unemploymentRate: 8.1, policePresence: 2.5, povertyRate: 18.5, urbanizationRate: 18.0 },
  'Chikkaballapur': { population: 1255377, literacyRate: 69.8, unemploymentRate: 5.9, policePresence: 2.8, povertyRate: 13.2, urbanizationRate: 22.0 },
  'Chikkamagaluru': { population: 1137753, literacyRate: 79.2, unemploymentRate: 4.8, policePresence: 3.2, povertyRate: 9.8, urbanizationRate: 25.0 },
  'Chitradurga': { population: 1659456, literacyRate: 73.8, unemploymentRate: 6.5, policePresence: 3.0, povertyRate: 14.1, urbanizationRate: 30.0 },
  'Dakshina Kannada': { population: 2089649, literacyRate: 88.6, unemploymentRate: 4.5, policePresence: 4.5, povertyRate: 6.2, urbanizationRate: 55.0 },
  'Davanagere': { population: 1645259, literacyRate: 75.8, unemploymentRate: 5.8, policePresence: 3.2, povertyRate: 11.5, urbanizationRate: 35.0 },
  'Dharwad': { population: 1846993, literacyRate: 80.0, unemploymentRate: 5.5, policePresence: 3.8, povertyRate: 10.2, urbanizationRate: 45.0 },
  'Gadag': { population: 1064570, literacyRate: 70.5, unemploymentRate: 7.0, policePresence: 2.5, povertyRate: 16.0, urbanizationRate: 25.0 },
  'Hassan': { population: 1776921, literacyRate: 76.5, unemploymentRate: 5.2, policePresence: 3.5, povertyRate: 10.8, urbanizationRate: 28.0 },
  'Haveri': { population: 1597228, literacyRate: 72.8, unemploymentRate: 6.0, policePresence: 2.8, povertyRate: 14.5, urbanizationRate: 22.0 },
  'Kalaburagi': { population: 2564892, literacyRate: 65.6, unemploymentRate: 7.8, policePresence: 3.0, povertyRate: 16.8, urbanizationRate: 32.0 },
  'Kodagu': { population: 554762, literacyRate: 82.5, unemploymentRate: 4.0, policePresence: 4.0, povertyRate: 7.5, urbanizationRate: 20.0 },
  'Kolar': { population: 1536401, literacyRate: 74.3, unemploymentRate: 5.6, policePresence: 3.0, povertyRate: 12.0, urbanizationRate: 28.0 },
  'Koppal': { population: 1389249, literacyRate: 68.1, unemploymentRate: 7.2, policePresence: 2.5, povertyRate: 17.5, urbanizationRate: 20.0 },
  'Mandya': { population: 1805769, literacyRate: 74.8, unemploymentRate: 5.0, policePresence: 3.2, povertyRate: 11.0, urbanizationRate: 25.0 },
  'Mysuru': { population: 3001127, literacyRate: 82.4, unemploymentRate: 4.8, policePresence: 5.0, povertyRate: 8.5, urbanizationRate: 52.0 },
  'Raichur': { population: 1924773, literacyRate: 64.2, unemploymentRate: 8.0, policePresence: 2.8, povertyRate: 19.2, urbanizationRate: 28.0 },
  'Ramanagara': { population: 1082636, literacyRate: 72.5, unemploymentRate: 5.4, policePresence: 2.5, povertyRate: 12.8, urbanizationRate: 20.0 },
  'Shivamogga': { population: 1752753, literacyRate: 80.4, unemploymentRate: 4.6, policePresence: 3.5, povertyRate: 9.5, urbanizationRate: 32.0 },
  'Tumakuru': { population: 2678980, literacyRate: 75.4, unemploymentRate: 5.3, policePresence: 3.2, povertyRate: 11.8, urbanizationRate: 28.0 },
  'Udupi': { population: 1177361, literacyRate: 86.2, unemploymentRate: 3.8, policePresence: 4.2, povertyRate: 6.5, urbanizationRate: 40.0 },
  'Uttara Kannada': { population: 1353644, literacyRate: 84.0, unemploymentRate: 4.2, policePresence: 3.5, povertyRate: 8.0, urbanizationRate: 30.0 },
  'Vijayanagara': { population: 1350000, literacyRate: 69.5, unemploymentRate: 6.8, policePresence: 2.8, povertyRate: 15.0, urbanizationRate: 25.0 },
  'Vijayapura': { population: 2177331, literacyRate: 71.0, unemploymentRate: 6.5, policePresence: 3.0, povertyRate: 15.5, urbanizationRate: 30.0 },
  'Yadgiri': { population: 1174298, literacyRate: 62.4, unemploymentRate: 8.5, policePresence: 2.2, povertyRate: 20.5, urbanizationRate: 18.0 },
};

// ---- GENERATION ----

// Person name parts
const FIRST_NAMES = ['Arun', 'Bhavana', 'Chandan', 'Deepa', 'Eshwar', 'Farida', 'Ganesh', 'Hema', 'Irfan', 'Jyoti', 'Kumar', 'Laxmi', 'Mahesh', 'Neelam', 'Omkar', 'Pooja', 'Ramesh', 'Shweta', 'Tara', 'Uday', 'Varun', 'Yashoda', 'Anil', 'Rekha', 'Suresh', 'Maya', 'Vijay', 'Kavita', 'Sanjay', 'Priya'];
const LAST_NAMES = ['Patel', 'Kumar', 'Reddy', 'Naik', 'Shetty', 'Hegde', 'Rao', 'Gowda', 'Murthy', 'Joshi', 'Deshmukh', 'Kulkarni', 'Kamath', 'Acharya', 'Bhat', 'Pai', 'Nayak', 'Shetty', 'Kini', 'Prabhu', 'Mallya', 'Bangera', 'Adiga', 'Karkada', 'Sharma', 'Verma', 'Gupta', 'Singh', 'Shaikh', 'Ansari'];

const PHONES_POOL = [];
for (let i = 0; i < 80; i++) {
  PHONES_POOL.push(`+91-9${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}${randInt(0,9)}`.slice(0, 15));
}

const VEHICLES_POOL = [];
for (let i = 0; i < 50; i++) {
  const letters = String.fromCharCode(65 + randInt(0, 25)) + String.fromCharCode(65 + randInt(0, 25));
  const num = randInt(1000, 9999);
  const state = 'KA';
  VEHICLES_POOL.push(`${state}${String.fromCharCode(65+randInt(0,25))}${letters}${num}`);
}

const ADDRESSES = [
  '12th Main, Indiranagar', 'MG Road', 'Brigade Road', 'Jayanagar 4th Block', 'Koramangala 1st Cross',
  'Whitefield Main Road', 'Malleshwaram 8th Cross', 'Sadashivanagar', 'Basavanagudi', 'Rajajinagar',
  'BTM Layout Stage 2', 'HSR Layout Sector 3', 'Marathahalli Bridge', 'Electronic City Phase 1',
  'Hebbal Ring Road', 'RT Nagar', 'Yelahanka New Town', 'Peenya Industrial Area', 'Vijayanagar 2nd Stage',
  'Padmanabhanagar', 'JP Nagar 6th Phase', 'Banashankari 2nd Stage', 'Vijayanagar Town', 'Mahalakshmi Layout',
  'Kengeri Satellite Town', 'Dasarahalli', 'Nagarbhavi', 'Kumaraswamy Layout', 'Uttarahalli', 'Subramanyapura',
];

// Generate persons
const persons = [];
const personIds = new Set();

function generatePerson(id) {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const gender = rand() > 0.5 ? 'Male' : 'Female';
  const age = randInt(18, 65);
  const phone = pick(PHONES_POOL);
  const vehicle = rand() > 0.6 ? pick(VEHICLES_POOL) : '';
  const address = pick(ADDRESSES);

  return {
    person_id: id,
    name: `${firstName} ${lastName}`,
    age,
    gender,
    phone,
    address,
    vehicle,
  };
}

for (let i = 1; i <= 80; i++) {
  const pid = `P${String(i).padStart(4, '0')}`;
  persons.push(generatePerson(pid));
  personIds.add(pid);
}

// Designate repeat offenders (first 20 will have higher activity)
const REPEAT_OFFENDERS = persons.slice(0, 20).map(p => p.person_id);
const OTHER_OFFENDERS = persons.slice(20, 50).map(p => p.person_id);
const VICTIMS = persons.slice(50, 80).map(p => p.person_id);

// Generate incidents
const incidents = [];
const incidentPersons = [];

// Multi-offender networks
const NETWORK_A = ['P0001', 'P0002', 'P0003', 'P0004', 'P0005'];
const NETWORK_B = ['P0006', 'P0007', 'P0008', 'P0009', 'P0010'];

// Shared phone/vehicle pairs
const sharedPhonePairs = [['P0001', 'P0003'], ['P0002', 'P0005'], ['P0006', 'P0009'], ['P0007', 'P0010'], ['P0011', 'P0013']];
const sharedVehiclePairs = [['P0001', 'P0004'], ['P0006', 'P0008'], ['P0012', 'P0015'], ['P0016', 'P0018']];

// Assign same phone to shared pairs
for (const [a, b] of sharedPhonePairs) {
  const pa = persons.find(p => p.person_id === a);
  const pb = persons.find(p => p.person_id === b);
  if (pa && pb) pb.phone = pa.phone;
}

for (const [a, b] of sharedVehiclePairs) {
  const pa = persons.find(p => p.person_id === a);
  const pb = persons.find(p => p.person_id === b);
  if (pa && pb) pb.vehicle = pa.vehicle;
}

// Anomaly 1: Cybercrime spike in Bengaluru Urban (Nov-Dec 2025)
// Anomaly 2: Vehicle theft hotspot in Ballari
// Anomaly 3: Night-time burglary cluster in Mysuru
// Anomaly 4: Investigation delay in Kalaburagi

let incidentId = 1;

// Helper to create incident
function createIncident(district, crimeType, dateOffset, options = {}) {
  const stations = POLICE_STATIONS[district] || ['Main Police Station'];
  const coords = DISTRICT_COORDS[district] || [15.0, 76.0];
  const severity = options.severity || pick(SEVERITIES);
  const status = options.status || pick(STATUSES);
  const mo = options.modusOperandi || pick(MODUS_OPERANDI[crimeType] || ['Unknown']);
  const baseDate = new Date(2025, 0, 1);
  baseDate.setDate(baseDate.getDate() + dateOffset);
  const id = `FIR${String(incidentId).padStart(6, '0')}`;
  incidentId++;

  const hour = options.hour !== undefined ? options.hour : randInt(0, 23);
  const lat = coords[0] + (rand() - 0.5) * 0.1;
  const lng = coords[1] + (rand() - 0.5) * 0.1;
  const description = `${crimeType} reported at ${options.location || pick(ADDRESSES)}. ${mo}.`;

  return {
    fir_number: id,
    crime_type: crimeType,
    incident_date: formatDate(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate()),
    incident_time: `${String(hour).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`,
    district,
    police_station: pick(stations),
    severity,
    status,
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lng.toFixed(4)),
    description,
    modus_operandi: mo,
  };
}

function addOffender(incidentFir, personId, role = 'OFFENDER') {
  incidentPersons.push({
    incident_id: incidentFir,
    person_id: personId,
    role,
  });
}

// Generate 1100 incidents
for (let i = 0; i < 1100; i++) {
  const monthOffset = Math.floor(i / 92);
  const dayInMonth = (i % 92) % 30;
  const dateOffset = monthOffset * 30 + dayInMonth;

  let district, crimeType, hour;

  // Pattern 1: Cybercrime spike in Bengaluru Urban (month 10-11 = Nov-Dec)
  if (dateOffset >= 300 && dateOffset <= 365 && rand() < 0.3) {
    district = 'Bengaluru Urban';
    crimeType = 'Cybercrime';
  }
  // Pattern 2: Vehicle theft hotspot in Ballari
  else if (rand() < 0.08 && dateOffset > 180) {
    district = 'Ballari';
    crimeType = 'Vehicle Theft';
  }
  // Pattern 3: Night-time burglary cluster in Mysuru
  else if (rand() < 0.07 && dateOffset > 90 && dateOffset < 270) {
    district = 'Mysuru';
    hour = randInt(22, 4);
    crimeType = 'Burglary';
  }
  else {
    district = pick(DISTRICTS);
    crimeType = pick(CRIME_CATEGORIES);
    hour = randInt(0, 23);
  }

  const incident = createIncident(district, crimeType, dateOffset, { hour });
  incidents.push(incident);

  // Assign offenders
  if (rand() < 0.15) {
    // Multiple offenders from a network
    const network = pick([NETWORK_A, NETWORK_B]);
    const numOffenders = randInt(2, 4);
    for (let j = 0; j < numOffenders; j++) {
      addOffender(incident.fir_number, network[j]);
    }
  } else if (rand() < 0.3) {
    // Repeat offender
    addOffender(incident.fir_number, pick(REPEAT_OFFENDERS));
  } else {
    addOffender(incident.fir_number, pick(OTHER_OFFENDERS));
  }

  // Add victim
  if (rand() > 0.2) {
    addOffender(incident.fir_number, pick(VICTIMS), 'VICTIM');
  }

  // Add witness sometimes
  if (rand() > 0.7) {
    addOffender(incident.fir_number, pick(persons).person_id, 'WITNESS');
  }
}

// Anomaly: Investigation delay in Kalaburagi - mark some as PENDING for >6 months
const kalaburagiPending = incidents.filter(
  i => i.district === 'Kalaburagi' && i.incident_date < '2025-06-01'
);
for (const inc of kalaburagiPending.slice(0, 10)) {
  inc.status = 'PENDING';
  inc.description += ' [DELAYED INVESTIGATION]';
}

// Generate relationships (edges)
const relationships = [];
const relSet = new Set();

function addRel(src, tgt, type, evidence = '') {
  const key = `${src}-${tgt}-${type}`;
  if (relSet.has(key)) return;
  relSet.add(key);
  relationships.push({
    source_id: src,
    target_id: tgt,
    relationship_type: type,
    evidence: evidence || `Linked via ${type}`,
  });
}

// ACCUSED_IN relationships
const offenderIncidents = {};
for (const ip of incidentPersons) {
  if (ip.role === 'OFFENDER') {
    if (!offenderIncidents[ip.person_id]) offenderIncidents[ip.person_id] = [];
    offenderIncidents[ip.person_id].push(ip.incident_id);
  }
}

for (const [pid, incs] of Object.entries(offenderIncidents)) {
  for (const incId of incs.slice(0, 5)) {
    addRel(pid, incId, 'ACCUSED_IN', `Accused in ${incId}`);
  }
}

// VICTIM_IN relationships
for (const ip of incidentPersons) {
  if (ip.role === 'VICTIM') {
    addRel(ip.person_id, ip.incident_id, 'VICTIM_IN', `Victim in ${ip.incident_id}`);
  }
}

// WITNESS_IN
for (const ip of incidentPersons) {
  if (ip.role === 'WITNESS') {
    addRel(ip.person_id, ip.incident_id, 'WITNESS_IN', `Witness in ${ip.incident_id}`);
  }
}

// ASSOCIATED_WITH (network members)
const allNetworks = [NETWORK_A, NETWORK_B];
for (const net of allNetworks) {
  for (let i = 0; i < net.length; i++) {
    for (let j = i + 1; j < net.length; j++) {
      addRel(net[i], net[j], 'ASSOCIATED_WITH', `Known associate - same criminal network`);
    }
  }
}

// USED_PHONE relationships
for (const p of persons) {
  if (p.phone) {
    const othersWithSamePhone = persons.filter(op => op.phone === p.phone && op.person_id !== p.person_id);
    for (const op of othersWithSamePhone) {
      addRel(p.person_id, op.person_id, 'SHARED_PHONE', `Shared phone number ${p.phone}`);
    }
  }
}

// USED_VEHICLE
for (const p of persons) {
  if (p.vehicle) {
    const othersWithSameVeh = persons.filter(op => op.vehicle === p.vehicle && op.person_id !== p.person_id);
    for (const op of othersWithSameVeh) {
      addRel(p.person_id, op.person_id, 'SHARED_VEHICLE', `Shared vehicle ${p.vehicle}`);
    }
  }
}

// SHARED_ADDRESS
const addrGroups = {};
for (const p of persons) {
  if (p.address) {
    if (!addrGroups[p.address]) addrGroups[p.address] = [];
    addrGroups[p.address].push(p.person_id);
  }
}
for (const [addr, pids] of Object.entries(addrGroups)) {
  if (pids.length > 1) {
    for (let i = 0; i < pids.length; i++) {
      for (let j = i + 1; j < pids.length; j++) {
        addRel(pids[i], pids[j], 'SHARED_ADDRESS', `Shared address at ${addr}`);
      }
    }
  }
}

// Generate district indicators
const districtIndicators = DISTRICTS.map(d => {
  const base = DISTRICT_INDICATORS[d] || { population: 1000000, literacyRate: 75, unemploymentRate: 6, policePresence: 3, povertyRate: 12, urbanizationRate: 30 };
  return {
    district: d,
    population: base.population + randInt(-50000, 50000),
    literacyRate: base.literacyRate + (rand() - 0.5) * 3,
    unemploymentRate: base.unemploymentRate + (rand() - 0.5) * 1.5,
    policePresence: base.policePresence + (rand() - 0.5) * 1,
    povertyRate: base.povertyRate + (rand() - 0.5) * 3,
    urbanizationRate: base.urbanizationRate + (rand() - 0.5) * 5,
  };
});

// ---- WRITE FILES ----
const dataDir = resolve(__dirname, '..', 'data', 'demo');
mkdirSync(dataDir, { recursive: true });

// CSV escape
function csv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Write incidents CSV
const incidentHeaders = ['fir_number','crime_type','incident_date','incident_time','district','police_station','severity','status','latitude','longitude','description','modus_operandi'];
let csvContent = incidentHeaders.map(csv).join(',') + '\n';
for (const inc of incidents) {
  csvContent += incidentHeaders.map(h => csv(inc[h])).join(',') + '\n';
}
writeFileSync(resolve(dataDir, 'karnataka-crime-incidents.csv'), csvContent, 'utf-8');
console.log(`Wrote ${incidents.length} incidents`);

// Write persons JSON
writeFileSync(resolve(dataDir, 'karnataka-persons.json'), JSON.stringify(persons, null, 2), 'utf-8');
console.log(`Wrote ${persons.length} persons`);

// Write relationships JSON
writeFileSync(resolve(dataDir, 'karnataka-relationships.json'), JSON.stringify(relationships, null, 2), 'utf-8');
console.log(`Wrote ${relationships.length} relationships`);

// Write district indicators CSV
const indHeaders = ['district','population','literacyRate','unemploymentRate','policePresence','povertyRate','urbanizationRate'];
let indContent = indHeaders.map(csv).join(',') + '\n';
for (const ind of districtIndicators) {
  indContent += indHeaders.map(h => csv(ind[h])).join(',') + '\n';
}
writeFileSync(resolve(dataDir, 'karnataka-district-indicators.csv'), indContent, 'utf-8');

// Write police stations JSON
writeFileSync(resolve(dataDir, 'karnataka-police-stations.json'), JSON.stringify(POLICE_STATIONS, null, 2), 'utf-8');

// Write incident-persons JSON
writeFileSync(resolve(dataDir, 'karnataka-incident-persons.json'), JSON.stringify(incidentPersons, null, 2), 'utf-8');

console.log('\n=== KAVACH AI Seed Data Generation Complete ===');
console.log(`Incidents: ${incidents.length}`);
console.log(`Persons: ${persons.length}`);
console.log(`Relationships: ${relationships.length}`);
console.log(`Districts: ${DISTRICTS.length}`);
console.log(`Incident-Person Links: ${incidentPersons.length}`);

// Summary
const crimeTypeCount = {};
for (const inc of incidents) {
  crimeTypeCount[inc.crime_type] = (crimeTypeCount[inc.crime_type] || 0) + 1;
}
console.log('\nCrime distribution:');
for (const [type, count] of Object.entries(crimeTypeCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

const districtCount = {};
for (const inc of incidents) {
  districtCount[inc.district] = (districtCount[inc.district] || 0) + 1;
}
console.log('\nDistrict distribution:');
for (const [d, count] of Object.entries(districtCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${d}: ${count}`);
}
