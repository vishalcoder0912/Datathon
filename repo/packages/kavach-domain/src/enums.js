export const CrimeSeverity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const InvestigationStatus = Object.freeze({
  PENDING: 'PENDING',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  CLOSED: 'CLOSED',
  COLD: 'COLD',
});

export const PersonRole = Object.freeze({
  OFFENDER: 'OFFENDER',
  VICTIM: 'VICTIM',
  WITNESS: 'WITNESS',
});

export const RelationshipType = Object.freeze({
  ACCUSED_IN: 'ACCUSED_IN',
  VICTIM_IN: 'VICTIM_IN',
  WITNESS_IN: 'WITNESS_IN',
  ASSOCIATED_WITH: 'ASSOCIATED_WITH',
  USED_PHONE: 'USED_PHONE',
  USED_VEHICLE: 'USED_VEHICLE',
  SHARED_ADDRESS: 'SHARED_ADDRESS',
  SHARED_ACCOUNT: 'SHARED_ACCOUNT',
  OCCURRED_AT: 'OCCURRED_AT',
  SIMILAR_MODUS_OPERANDI: 'SIMILAR_MODUS_OPERANDI',
});

export const AlertType = Object.freeze({
  DISTRICT_INCIDENT_SPIKE: 'DISTRICT_INCIDENT_SPIKE',
  POLICE_STATION_SPIKE: 'POLICE_STATION_SPIKE',
  CRIME_CATEGORY_SPIKE: 'CRIME_CATEGORY_SPIKE',
  TIME_OF_DAY_ANOMALY: 'TIME_OF_DAY_ANOMALY',
  MODUS_OPERANDI_ANOMALY: 'MODUS_OPERANDI_ANOMALY',
  REPEAT_OFFENDER_ACTIVITY: 'REPEAT_OFFENDER_ACTIVITY',
  NEW_CRIMINAL_ASSOCIATION: 'NEW_CRIMINAL_ASSOCIATION',
  INVESTIGATION_DELAY: 'INVESTIGATION_DELAY',
  HOTSPOT_EMERGENCE: 'HOTSPOT_EMERGENCE',
});

export const RiskBand = Object.freeze({
  VERY_LOW: 'VERY_LOW',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH',
  CRITICAL: 'CRITICAL',
});

export const EntityType = Object.freeze({
  INCIDENT: 'INCIDENT',
  DISTRICT: 'DISTRICT',
  POLICE_STATION: 'POLICE_STATION',
  OFFENDER: 'OFFENDER',
  VICTIM: 'VICTIM',
  PERSON: 'PERSON',
  LOCATION: 'LOCATION',
  PHONE: 'PHONE',
  VEHICLE: 'VEHICLE',
  ACCOUNT: 'ACCOUNT',
});

export const Daypart = Object.freeze({
  DAWN: 'DAWN',
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  EVENING: 'EVENING',
  NIGHT: 'NIGHT',
  LATE_NIGHT: 'LATE_NIGHT',
});

export const AlertSeverity = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
});

export const KARNATAKA_DISTRICTS = Object.freeze([
  'Bengaluru Urban', 'Bengaluru Rural', 'Belagavi', 'Ballari', 'Bidar',
  'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada',
  'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri',
  'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya',
  'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru',
  'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgiri',
]);

export const CRIME_CATEGORIES = Object.freeze([
  'Cybercrime', 'Vehicle Theft', 'Burglary', 'Assault', 'Robbery',
  'Murder', 'Drug Offence', 'Fraud', 'Kidnapping', 'Domestic Violence',
  'Criminal Trespass', 'Chain Snatching', 'Pickpocketing', 'Sexual Offence', 'Arson',
]);

export const MODUS_OPERANDI_TYPES = Object.freeze([
  'Forceful entry', 'Phishing link', 'Social engineering', 'Lock picking',
  'Confrontation', 'Snatching', 'Deception', 'Distraction theft',
  'Break-in', 'Cyber intrusion', 'Strangulation', 'Sharp weapon',
  'Firearm', 'Poisoning', 'Bomb threat',
]);

export const POLICE_STATIONS = Object.freeze({
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
});

export const CRIME_TYPES = CRIME_CATEGORIES;
