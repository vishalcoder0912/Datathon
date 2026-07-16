# KAVACH AI — API Documentation

**Base URL:** `/api/kavach`  
**Protocol:** HTTP  
**Content-Type:** `application/json`  
**Version:** 1.0.0

---

## Response Envelope

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Overview retrieved",
  "timestamp": "2026-07-12T10:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "District 'Unknown' not found",
    "code": "DISTRICT_NOT_FOUND",
    "timestamp": "2026-07-12T10:00:00.000Z"
  }
}
```

## Common Query Parameters

All GET endpoints accept optional filter parameters:

| Param | Type | Description |
|---|---|---|
| `dateFrom` | string (ISO date) | Start date filter |
| `dateTo` | string (ISO date) | End date filter |
| `district` | string | District name |
| `policeStation` | string | Police station name |
| `crimeType` | string | Crime category |
| `severity` | string | LOW / MEDIUM / HIGH / CRITICAL |
| `status` | string | PENDING / UNDER_INVESTIGATION / CLOSED / COLD |
| `timeOfDay` | string | DAWN / MORNING / AFTERNOON / EVENING / NIGHT / LATE_NIGHT |

---

## Endpoints

### Overview

#### GET /api/kavach/overview

Returns command dashboard KPIs.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalIncidents": 1100,
    "activeInvestigations": 320,
    "closedInvestigations": 450,
    "pending": 180,
    "cold": 150,
    "highRiskDistricts": 8,
    "activeHotspots": 9,
    "repeatOffenders": 15,
    "currentAlerts": 55,
    "periodChange": 12.5,
    "mostCommonCategory": "Cybercrime",
    "avgInvestigationDuration": 45.2,
    "dataQualityScore": 85.0,
    "dataPeriod": { "start": "2025-01-01", "end": "2025-12-31" },
    "recordCount": 1100
  },
  "message": "Overview retrieved",
  "timestamp": "2026-07-12T10:00:00.000Z"
}
```

## Endpoints

### Overview

#### GET /api/kavach/overview

Returns command dashboard KPIs.

**Query Params:** All common filters  
**Response:** `{ totalIncidents, activeInvestigations, closedInvestigations, pending, cold, highRiskDistricts, activeHotspots, repeatOffenders, currentAlerts, periodChange, mostCommonCategory, avgInvestigationDuration, dataQualityScore, dataPeriod, recordCount }`

---

### Districts

#### GET /api/kavach/districts

Returns summary for all districts.

**Response:** Array of `{ district, totalIncidents, topCategory, avgSeverity, activeCases, closedCases, indicators }`

#### GET /api/kavach/districts/:district

Returns detailed analysis for a specific district.

**Response:** `{ district, totalIncidents, categoryCounts, statusCounts, severityCounts, stationCounts, topCategory, avgSeverity, activeCases, closedCases, indicators, dataPeriod, recordCount }`

**Error Codes:** `DISTRICT_NOT_FOUND` (404)

---

### Trends

#### GET /api/kavach/trends/monthly

Returns monthly incident counts broken down by crime category.

**Response:** `[{ month: "2025-01", total: 85, categories: { Cybercrime: 12, ... } }]`

#### GET /api/kavach/trends/weekly

Returns weekly incident counts.

**Response:** `[{ week: "2025-W01", total: 20, categories: {...} }]`

#### GET /api/kavach/trends/day-of-week

Returns incident distribution by day of week.

**Response:** `[{ day: "Monday", total: 150, categories: {...} }]`

#### GET /api/kavach/trends/hour-of-day

Returns incident distribution by hour (0-23).

**Response:** `[{ hour: 0, total: 30, categories: {...} }]`

#### GET /api/kavach/trends/daypart

Returns incident distribution by daypart (DAWN, MORNING, AFTERNOON, EVENING, NIGHT, LATE_NIGHT).

**Response:** `[{ daypart: "DAWN", total: 45, categories: {...} }]`

#### GET /api/kavach/trends/category-growth

Returns crime category growth rates between first and second half of the data period.

**Response:** `[{ category: "Cybercrime", firstPeriod: 50, secondPeriod: 120, change: 140, direction: "increase" }]`

#### GET /api/kavach/trends/district-comparison

Returns district comparison with percentage share.

**Response:** `[{ district: "Bengaluru Urban", totalIncidents: 200, percentage: 18.18, ... }]`

#### GET /api/kavach/trends/modus-operandi

Returns modus operandi distribution and monthly trends.

**Response:** `{ totalMOs: 25, moDistribution: [...], monthlyTrend: [...] }`

#### GET /api/kavach/trends/period-comparison

Returns current vs previous period comparison.

**Response:** `{ current: { total, byCategory, byDistrict }, previous: { ... }, change: 12.5, direction: "increase" }`

---

### Hotspots

#### GET /api/kavach/hotspots

Returns ranked hotspot list with multi-factor scores.

**Response:** Array of `{ id, district, score, incidentCount, growthRate, avgSeverity, repeatOffenderCount, anomalyScore, factors, confidence, dataPeriod, recordCount, calculatedAt }`

#### GET /api/kavach/hotspots/:id

Returns a single hotspot by ID (district slug).

**Error Codes:** `HOTSPOT_NOT_FOUND` (404)

#### GET /api/kavach/hotspots/district/:district

Returns hotspots filtered by district.

---

### Anomalies

#### GET /api/kavach/anomalies

Returns detected anomalies using IQR and Z-score methods.

**Response:** Array of `{ type, district/policeStation/category, value, threshold, zScore, severity }`

---

### Network

#### GET /api/kavach/network

Returns full bipartite graph (nodes + edges).

**Response:** `{ nodes: [...], edges: [...] }`

#### GET /api/kavach/network/person/:personId

Returns ego network for a person.

**Error Codes:** `PERSON_NOT_FOUND` (404)

#### GET /api/kavach/network/incident/:firNumber

Returns ego network for an incident.

**Error Codes:** `INCIDENT_NOT_FOUND` (404)

#### GET /api/kavach/network/components

Returns connected components (BFS-based).

**Response:** `[{ size, personCount, incidentCount, personIds, incidentIds }]`

#### GET /api/kavach/network/cross-district

Returns networks spanning multiple districts.

**Response:** `[{ size, personCount, incidentCount, districts, districtCount }]`

---

### Offenders

#### GET /api/kavach/offenders

Returns all offenders with classification and risk scores.

**Response:** Array of `{ personId, name, age, gender, incidentCount, incidents, firstSeen, lastSeen, classification, riskScore }`

#### GET /api/kavach/offenders/:offenderId

Returns detailed offender profile with timeline, associates, and risk assessment.

**Error Codes:** `OFFENDER_NOT_FOUND` (404)

---

### Risk

#### GET /api/kavach/risk/districts

Returns risk scores for all districts.

**Response:** Array of `{ district, score, band, confidence, formulaVersion, dataPeriod, factors, limitations, recordCount, calculatedAt }`

#### GET /api/kavach/risk/districts/:district

Returns risk score for a specific district.

**Error Codes:** `DISTRICT_NOT_FOUND` (404)

#### GET /api/kavach/risk/distribution

Returns risk band distribution across all districts.

**Response:** `{ distribution: { VERY_LOW: 2, LOW: 5, ... }, total: 30 }`

---

### Correlations

#### GET /api/kavach/correlations

Returns Pearson correlation between crime rate and socioeconomic indicators.

**Response:** `{ literacyRate: -0.45, unemploymentRate: 0.62, policePresence: -0.38, povertyRate: 0.55, urbanizationRate: 0.28 }`

#### GET /api/kavach/correlations/matrix

Returns full correlation matrix.

**Response:** `{ metrics: [...], matrix: { literacyRate: { unemploymentRate: 0.3, ... } }, correlations: {...} }`

#### GET /api/kavach/correlations/ranked

Returns correlations sorted by absolute strength.

**Response:** `[{ metric: "unemploymentRate", value: 0.62, strength: "moderate", direction: "positive" }]`

---

### Alerts

#### GET /api/kavach/alerts

Returns generated alerts with optional filters.

**Query Params:** `type`, `severity`, `district`, `reviewed`, `fromDate`, `toDate`

**Response:** Array of `{ id, type, title, message, severity, district, policeStation, metrics, evidence, detectedAt, reviewed }`

#### GET /api/kavach/alerts/:id

Returns a single alert.

**Error Codes:** `ALERT_NOT_FOUND` (404)

#### PATCH /api/kavach/alerts/:id/review

Marks an alert as reviewed.

**Error Codes:** `ALERT_NOT_FOUND` (404)

---

### Copilot

#### POST /api/kavach/copilot/query

Processes a natural language query.

**Request Body:** `{ query: "Show me total incidents" }`

**Response:** `{ type: "overview" | "simple" | "hotspots" | "trends" | "offenders" | "risk" | "alerts" | "unknown", data: {...}, message: "..." }`

#### GET /api/kavach/copilot/suggestions

Returns predefined suggestion queries.

**Response:** `[{ query: "Show me total incidents", label: "Total Incidents" }]`

---

### Reports

#### POST /api/kavach/reports

Generates an HTML crime intelligence report.

**Response:** HTML document (Content-Type: text/html)

---

### Data Management

#### GET /api/kavach/data/load

Reloads all demo data from CSV/JSON files.

**Response:** `{ loaded: true, incidents: 1100, persons: 80, relationships: 450, error: null }`

#### GET /api/kavach/schema/map

Returns detected column mappings from the loaded data.

**Response:** `{ columns: ["fir_number", "crime_type", ...], mappings: { fir_number: { column: "fir_number", confidence: 0.95 } } }`

#### POST /api/kavach/schema/map

Updates schema column mappings.

**Request Body:** `{ fir_number: "FIR_No", crime_type: "Crime_Category", ... }`

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `DISTRICT_NOT_FOUND` | 404 | Requested district does not exist in data |
| `HOTSPOT_NOT_FOUND` | 404 | Hotspot ID not found |
| `PERSON_NOT_FOUND` | 404 | Person ID not found |
| `INCIDENT_NOT_FOUND` | 404 | FIR number not found |
| `OFFENDER_NOT_FOUND` | 404 | Offender ID not found |
| `ALERT_NOT_FOUND` | 404 | Alert ID not found |
| `KAVACH_ERROR` | 500 | Internal server error |
