# KAVACH AI — Product Requirements Document

**Product Name:** KAVACH AI (Karnataka AI Visualization & Analytics for Crime Hotspots)  
**Platform Title:** Karnataka Crime Intelligence Command Centre  
**Target:** Datathon 2026, Challenge 02: AI-Driven Crime Analytics & Visualization Platform  
**Version:** 1.0.0  
**Status:** Prototype

---

## 1. Problem Statement

Law enforcement agencies in Karnataka face challenges in identifying crime patterns, hotspots, and repeat offenders across 30 districts. Data is siloed across police stations, investigation delays go unnoticed, and cross-district criminal networks are difficult to detect manually. There is no unified platform that provides real-time crime intelligence, predictive risk scoring, and automated anomaly detection.

KAVACH AI addresses this by transforming the existing InsightFlow analytics platform into a dedicated Karnataka Crime Intelligence Command Centre with AI-driven analytics, geo-intelligence, network analysis, and automated alerting.

## 2. Target Users

| User Role | Primary Needs |
|---|---|
| **Law Enforcement Analysts** | Crime pattern identification, trend analysis, report generation |
| **Investigators** | Offender profiling, network analysis, case linking |
| **Command Centre Operators** | Real-time alerts, hotspot monitoring, risk dashboards |
| **Senior Police Leadership** | District comparisons, resource allocation insights, executive reports |

## 3. Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Command Dashboard** | KPI cards (total incidents, active cases, hotspots, repeat offenders), data quality score, period-over-period change |
| 2 | **Geo-Intelligence** | Karnataka map with district-level crime density, hotspot overlays, police station markers |
| 3 | **Trend Intelligence** | Monthly/weekly trends, day-of-week/hour-of-day analysis, daypart distribution, category growth, district comparison, modus operandi trends, period-over-period comparison |
| 4 | **Hotspot Detection** | Multi-factor hotspot scoring (volume, growth, severity, repeat offenders, anomalies), ranked by score |
| 5 | **Anomaly Detection** | IQR-based district/station/category anomalies, Z-score time-of-day and MO anomalies, investigation delay detection |
| 6 | **Network Intelligence** | Bipartite graph (persons + incidents), connected components, cross-district networks, ego networks for persons/incidents |
| 7 | **Offender Intelligence** | Offender listing with classification (repeat/frequent/first-time), risk scoring, detailed profiles with timeline |
| 8 | **Risk Intelligence** | District risk scoring with weighted factors, risk band distribution, formula versioning |
| 9 | **Social Correlations** | Pearson correlation between crime rates and socioeconomic indicators (literacy, unemployment, poverty, urbanization, police presence) |
| 10 | **AI Copilot** | Natural language query processing, contextual suggestions, report generation |
| 11 | **Reports** | HTML report generation with full crime intelligence summary |
| 12 | **Alerts** | Automated alert generation for spikes, delays, anomalies with review workflow |

## 4. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Response Time | API responses < 500ms for standard queries |
| Data Freshness | In-memory data loaded at startup; reload via API |
| Concurrency | Single-process Node.js, handles concurrent requests via async I/O |
| Browser Support | Modern Chrome, Firefox, Edge |
| Accessibility | WCAG 2.1 AA (basic compliance) |
| Security | PII masking on person names, phones, vehicles, addresses |
| Maintainability | Monorepo with shared domain package (@kavach/domain) |

## 5. Success Criteria

| Criterion | Target |
|---|---|
| All API endpoints respond correctly | 40+ endpoints operational |
| Demo data seeds successfully | 1100 incidents, 80 persons, 30 districts |
| Hotspot scoring produces ranked results | Scores 0-100 with factor breakdown |
| Anomaly detection identifies embedded patterns | Cybercrime spike, Ballari vehicle theft, Mysuru burglary cluster, Kalaburagi delays |
| Risk scoring produces bands | VERY_LOW through CRITICAL |
| Network graph renders | Bipartite graph with nodes and edges |
| AI Copilot responds to natural language queries | Pattern-matched responses for 10+ query types |
| Reports generate HTML output | Downloadable report with full intelligence summary |

## 6. Known Limitations (Prototype)

- **In-memory data only**: No persistent database; data reloads on server restart
- **No authentication**: All endpoints are unauthenticated
- **No authorization**: All users have full access
- **Pattern-matched AI Copilot**: Not a real LLM; uses keyword pattern matching
- **Static demo data**: 1100 synthetic incidents; not connected to live feeds
- **Single-process Node.js**: No clustering or load balancing
- **No WebSocket**: Real-time updates not supported
- **No export to PDF**: Reports are HTML-only
- **PII masking is basic**: Character-masking, not cryptographic
- **No audit logging**: User actions are not tracked
- **No rate limiting**: API is unprotected against abuse
- **No HTTPS**: Development-only HTTP

## 7. Success Criteria

| Criterion | Target |
|---|---|
| All API endpoints respond correctly | 40+ endpoints operational |
| Demo data seeds successfully | 1100 incidents, 80 persons, 30 districts |
| Hotspot scoring produces ranked results | Scores 0-100 with factor breakdown |
| Anomaly detection identifies embedded patterns | Cybercrime spike, Ballari vehicle theft, Mysuru burglary cluster, Kalaburagi delays |
| Risk scoring produces bands | VERY_LOW through CRITICAL |
| Network graph renders | Bipartite graph with nodes and edges |
| AI Copilot responds to natural language queries | Pattern-matched responses for 10+ query types |
| Reports generate HTML output | Downloadable report with full intelligence summary |

## 8. Known Limitations (Prototype)

- **In-memory data only**: No persistent database; data reloads on server restart
- **No authentication**: All endpoints are unauthenticated
- **No authorization**: All users have full access
- **Pattern-matched AI Copilot**: Not a real LLM; uses keyword pattern matching
- **Static demo data**: 1100 synthetic incidents; not connected to live feeds
- **Single-process Node.js**: No clustering or load balancing
- **No WebSocket**: Real-time updates not supported
- **No export to PDF**: Reports are HTML-only
- **PII masking is basic**: Character-masking, not cryptographic
- **No audit logging**: User actions are not tracked
- **No rate limiting**: API is unprotected against abuse
- **No HTTPS**: Development-only HTTP
