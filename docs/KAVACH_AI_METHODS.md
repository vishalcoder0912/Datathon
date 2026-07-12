# KAVACH AI — Methods & Formulas

**Version:** kavach-risk-v1  
**Last Updated:** July 2026

---

## 1. Hotspot Scoring Formula

Each district is scored on a 0-100 scale using five weighted factors:

```
hotspotScore = (normIncidentCount × 0.35)
             + ((normGrowth + 1) / 2 × 0.20)
             + (normSeverity × 0.20)
             + (min(1, normRepeat) × 0.15)
             + (anomalyScore × 0.10)
```

### Factor Definitions

| Factor | Weight | Calculation |
|---|---|---|
| **incidentVolume** | 0.35 | `count / maxCountAcrossAllDistricts` — normalized incident count |
| **recentGrowth** | 0.20 | `(growthRate + 1) / 2` where `growthRate = (recent - earlier) / earlier` — normalized to [0,1] |
| **severityLevel** | 0.20 | `avgSeverity / 4` where severity is mapped: LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4 |
| **repeatOffenderActivity** | 0.15 | `min(1, repeatOffenderCount / incidentCount)` — proportion of incidents involving repeat offenders |
| **anomalyScore** | 0.10 | `min(1, (actualPerDay - expectedPerDay) / expectedPerDay)` — deviation from expected incident rate |

**Final Score:** `clamp(sum of weighted factors, 0, 100)`

---

## 2. Risk Scoring Formula

### District Risk Score

```
districtRiskScore = (normVolume × 0.35)
                  + (severityScore × 0.25)
                  + (openScore × 0.20)
                  + (anomalyScore × 0.20)
```

| Factor | Weight | Calculation |
|---|---|---|
| **incidentVolume** | 0.35 | `districtIncidents / maxDistrictIncidents` — normalized volume |
| **severityLevel** | 0.25 | `(avgSeverity / 4) × 100` — where LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4 |
| **openCases** | 0.20 | `(activeCases / totalIncidents) × 100` — proportion of open investigations |
| **anomalyScore** | 0.20 | `(actualPerDay - expectedPerDay) / expectedPerDay × 100` — deviation from expected rate |

**Final Score:** `clamp(normVolume × 35 + severityScore × 25 + openScore × 20 + anomalyScore × 20, 0, 100)`

### Risk Bands

| Band | Score Range |
|---|---|
| CRITICAL | 90-100 |
| VERY_HIGH | 75-89 |
| HIGH | 55-74 |
| MODERATE | 35-54 |
| LOW | 15-34 |
| VERY_LOW | 0-14 |

### Offender Risk Score

```
offenderRiskScore = clamp(
    min(incidentCount × 15, 60)     // Base: up to 60 points
  + recencyScore                     // Up to 20 points (based on months since last seen)
  + ageScore                         // Up to 10 points (age < 30: 10, age < 45: 5)
)
```

Where:
- `recencyScore = min(max(0, 30 - monthsSinceLastSeen), 20)`
- `ageScore = age < 30 ? 10 : age < 45 ? 5 : 0`

### Repeat Offender Classification

```
totalScore = recidivismScore + violentScore + versatilityScore
```

| Factor | Score 1 | Score 2 | Score 3 |
|---|---|---|---|
| **recidivismScore** | 1 offence | 2 offences | 3+ offences |
| **violentScore** | 0 violent | 1 violent | 2+ violent |
| **versatilityScore** | 1 category | 2 categories | 3+ categories |

| Total Score | Classification |
|---|---|
| >= 8 | HIGH_RISK_REPEAT |
| 6-7 | MODERATE_RISK_REPEAT |
| 4-5 | LOW_RISK_REPEAT |
| < 4 | FIRST_TIME |

---

## 4. Anomaly Detection Methods

### IQR Method (District, Station, Category Anomalies)

```
Q1 = value at 25th percentile
Q3 = value at 75th percentile
IQR = Q3 - Q1
upperThreshold = Q3 + 1.5 × IQR
anomaly = count > upperThreshold
```

Used for detecting districts, police stations, and crime categories with unusually high incident counts.

### Z-Score Method (Time-of-Day, Modus Operandi Anomalies)

```
z = (value - mean) / standardDeviation
anomaly = |z| > 1.5
severity = |z| > 2.5 ? "HIGH" : "MEDIUM"
```

Used for detecting unusual hours or modus operandi patterns.

### Spike Detection (District/Station/Category)

```
z = (recentValue - historicalMean) / historicalStd
isSpike = z > 2
```

Compares the most recent 3 periods against historical data using Z-score.

---

## 5. Socioeconomic Correlation (Pearson)

```
r = (n × sum(xy) - sum(x) × sum(y))
    / sqrt((n × sum(x²) - sum(x)²) × (n × sum(y²) - sum(y)²))
```

Where:
- `x` = socioeconomic indicator (literacy rate, unemployment rate, etc.)
- `y` = crime rate per 100,000 population
- `n` = number of districts

**Strength Classification:**
- `|r| > 0.7`: strong
- `|r| > 0.4`: moderate
- `|r| <= 0.4`: weak

---

## 6. Trend Calculation Methods

### Period-over-Period Change

```
change = ((secondHalf - firstHalf) / firstHalf) × 100
```

Data is split at the median date. First half vs second half comparison.

### Category Growth

```
growth = ((secondPeriod - firstPeriod) / firstPeriod) × 100
```

Each category's count in the first half of the data period is compared to the second half.

### Confidence Calculation

```
hotspotConfidence = min(1, incidentCount / 50)
districtRiskConfidence = min(1, totalIncidents / 100)
```

Confidence increases with data volume, capped at 1.0.

---

## 7. Data Quality Scoring

```
dataQualityScore = (incidentsWithLocation / totalIncidents) × 100
```

Measures the percentage of incidents that have valid latitude/longitude coordinates.

---

## 8. Version

**Formula Version:** `kavach-risk-v1`

All risk scores and hotspot calculations carry a `formulaVersion` field for traceability. The current version is `1.0.0` and is included in every risk score response.
