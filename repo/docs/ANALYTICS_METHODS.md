# Analytics Methods and Limits

All outputs are decision support over aggregated synthetic data. They never predict individual guilt, recommend arrest, or use caste, religion, gender, or other protected traits as predictive features.

## Methods

- **Hotspots:** PostGIS DBSCAN where available, or haversine DBSCAN in FastAPI. A hotspot requires the configured minimum incident count and returns centroid, categories, period, baseline, confidence, and evidence.
- **Emerging alerts:** current 7-day window compared with a rolling 28-day baseline, minimum volume, percentage increase, robust z-score, grouping by district/station/category/daypart, and a deduplication key.
- **Anomalies:** IQR and z-score baselines, with Isolation Forest as an optional multivariate detector. Responses include model/version, top factors, data freshness, and review state.
- **Risk:** transparent aggregate geographic composite for district/station forecasting. Weights, model version, factors, confidence, and limitations are persisted. The score is never a personal risk or guilt score.
- **Networks:** normalized case links plus NetworkX degree, betweenness, PageRank, components, communities, common neighbours, and cross-district bridges. Every edge carries case evidence.
- **MO similarity:** structured exact matches, weighted Jaccard, trigram text similarity, and optional local embeddings. Responses list matched features and evidence.
- **Socioeconomic research:** aggregate correlations are labelled non-causal and never feed predictive models.

## Explainability standard

Every hotspot, anomaly, risk, association, and MO response identifies what was detected, why, source data and period, record count, algorithm/model version, confidence, limitations, and human-review status.
