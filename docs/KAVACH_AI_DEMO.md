# KAVACH AI — Demo Guide

**Version:** 1.0.0  
**Last Updated:** July 2026

---

## 1. What the Prototype Demonstrates

KAVACH AI demonstrates a fully functional crime intelligence command centre for Karnataka police. The prototype showcases:

- **12 interactive pages** covering all aspects of crime intelligence
- **40+ API endpoints** for data retrieval and analysis
- **1100 synthetic crime incidents** across 30 Karnataka districts
- **80 persons** with 20 repeat offenders and 2 criminal networks
- **4 embedded anomalies** for detection demonstration
- **Multi-factor hotspot scoring** with transparent factor breakdown
- **Risk scoring** with band classification and formula versioning
- **Network analysis** with connected components and cross-district detection
- **Socioeconomic correlation** using Pearson's r
- **AI Copilot** with natural language query processing

## 2. How to Load Demo Data

```bash
# From the repo root:
npm run seed:kavach

# This generates:
# - data/demo/karnataka-crime-incidents.csv (1100 incidents)
# - data/demo/karnataka-persons.json (80 persons)
# - data/demo/karnataka-relationships.json (450+ relationships)
# - data/demo/karnataka-district-indicators.csv (30 districts)
# - data/demo/karnataka-police-stations.json (30 districts)
# - data/demo/karnataka-incident-persons.json (incident-person links)
```

Data is automatically loaded when the backend starts. To reload without restarting, call `GET /api/kavach/data/load`.

## 3. End-to-End Walkthrough

### Step 1: Start the Application
```bash
npm install
npm run seed:kavach
npm run dev
```
Open http://localhost:5173 in a browser. The KAVACH AI dashboard loads automatically.

### Step 2: Command Dashboard
Navigate to `/dashboard`. Observe KPI cards showing total incidents (1100), active investigations, hotspots, repeat offenders, and data quality score. The period-over-period change indicator shows crime trend direction.

### Step 3: Geo-Intelligence
Navigate to `/geo-intelligence`. The Karnataka map displays district-level crime density. Hotspots are highlighted with color-coded severity. Hover over districts for tooltip data.

### Step 4: Trend Intelligence
Navigate to `/trend-intelligence`. Explore monthly trends, day-of-week patterns, hour-of-day distribution, and category growth. The Cybercrime spike in Nov-Dec 2025 should be visible in monthly trends.

### Step 5: Hotspot Detection
Navigate to `/geo-intelligence` or check the hotspots list. Bengaluru Urban should rank highest due to volume. Ballari should appear elevated due to the vehicle theft hotspot. Mysuru should show for the burglary cluster.

### Step 6: Anomaly Detection
Navigate to the anomalies section. Expected anomalies:
- **DISTRICT_ANOMALY**: Bengaluru Urban (high volume), Ballari (vehicle theft spike)
- **CATEGORY_ANOMALY**: Cybercrime (Nov-Dec spike)
- **STATION_ANOMALY**: Stations with unusually high counts
- **Time-of-day anomalies**: Night-time burglary in Mysuru

### Step 7: Network Intelligence
Navigate to `/network-intelligence`. The bipartite graph shows persons connected to incidents. Two criminal networks (Network A: P0001-P0005, Network B: P0006-P0010) are embedded. Cross-district networks are detected when persons operate across multiple districts.

### Step 8: Offender Intelligence
Navigate to `/offenders`. The first 20 persons (P0001-P0020) are designated repeat offenders with higher incident counts. Click on an offender to see their full profile, timeline, and risk score.

### Step 9: Risk Intelligence
Navigate to `/risk-intelligence`. District risk scores are calculated using volume, severity, open cases, and anomaly factors. Bengaluru Urban should rank highest. Risk bands (VERY_LOW to CRITICAL) are displayed with distribution.

### Step 10: Social Correlations
Navigate to `/social-intelligence`. Pearson correlations between crime rates and socioeconomic indicators are displayed. Unemployment and poverty should show positive correlation with crime; literacy and police presence should show negative correlation.

### Step 11: AI Copilot
Navigate to `/ai-copilot`. Try these queries:
- "Show me total incidents"
- "What are the hotspots?"
- "Show me active investigations"
- "List repeat offenders"
- "What are the risk scores?"
- "Show me alerts"
- "Generate a report"

### Step 12: Reports
Navigate to `/reports`. Click "Generate Report" to download an HTML crime intelligence report containing overview, district analysis, trends, hotspots, anomalies, and risk assessment.

## 4. Expected Behaviors

| Action | Expected Result |
|---|---|
| Load dashboard | 12 KPI cards with real data |
| Filter by district | All views update to show only that district |
| Click hotspot | Detailed factor breakdown displayed |
| View network graph | Bipartite graph with person and incident nodes |
| Search offender | Profile with timeline, risk score, and associates |
| Generate report | HTML file downloads with complete intelligence summary |
| Reload data | All data refreshes from CSV/JSON files |
| Query AI Copilot | Pattern-matched response based on keywords |

## 5. Embedded Anomalies and Patterns

The synthetic dataset contains these deliberately embedded patterns:

| Anomaly | Description | Detection Method |
|---|---|---|
| **Cybercrime Spike** | 30% probability of Cybercrime in Bengaluru Urban during Nov-Dec 2025 (days 300-365) | IQR category anomaly, district spike detection |
| **Vehicle Theft Hotspot** | 8% probability of Vehicle Theft in Ballari after day 180 | IQR district anomaly, hotspot scoring |
| **Night-time Burglary Cluster** | 7% probability of Burglary in Mysuru between 22:00-04:00 (days 90-270) | Time-of-day Z-score anomaly |
| **Investigation Delays** | 10 Kalaburagi incidents marked PENDING with `[DELAYED INVESTIGATION]` for incidents before June 2025 | Investigation delay detection (>30 days) |
| **Criminal Networks** | Network A (P0001-P0005) and Network B (P0006-P0010) with shared phones, vehicles, and co-offending | Connected components, cross-district detection |
| **Shared Resources** | Shared phone pairs and vehicle pairs across offenders | Relationship detection (SHARED_PHONE, SHARED_VEHICLE) |

## 6. Screenshots Guide (Text Description)

| Page | Key Elements to Capture |
|---|---|
| **Dashboard** | 12 KPI cards in a grid: total incidents (1100), active investigations, closed, pending, cold, high-risk districts, active hotspots, repeat offenders, current alerts, period change %, most common category, data quality score |
| **Geo-Intelligence** | Karnataka map with 30 districts color-coded by crime density, hotspot markers, tooltip on hover |
| **Trend Intelligence** | Monthly trend line chart showing Cybercrime spike in Nov-Dec 2025, day-of-week bar chart, hour-of-day heatmap |
| **Hotspot Details** | Ranked list with score bars, factor breakdown (volume, growth, severity, repeat offenders, anomaly) |
| **Anomaly Detection** | Table of detected anomalies with type, value, threshold, Z-score, severity |
| **Network Intelligence** | Force-directed graph with person (blue) and incident (red) nodes, edges showing relationships |
| **Offender Profile** | Person details, incident timeline, risk score gauge, category breakdown pie chart |
| **Risk Intelligence** | District risk scores with band colors, factor contribution bars, distribution chart |
| **Social Correlations** | Correlation bar chart, scatter plots for each socioeconomic indicator |
| **AI Copilot** | Chat interface with query input, response display, suggestion chips |
| **Alerts** | Alert cards with type icons, severity colors, review button |
| **Reports** | Generate button, preview of report sections |

## 6. Decision-Support Disclaimer

> **IMPORTANT:** KAVACH AI is a prototype developed for Datathon 2026. It is intended for demonstration and evaluation purposes only. The analytics, risk scores, hotspot detection, and offender classifications are based on synthetic data and simplified statistical models. They should NOT be used as the sole basis for real-world law enforcement decisions, resource allocation, or investigative actions. All outputs require human review and validation before operational use.
