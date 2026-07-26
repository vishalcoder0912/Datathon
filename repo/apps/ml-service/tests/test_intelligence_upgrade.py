from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app

client = TestClient(app)
REFERENCE = datetime(2026, 6, 20, 12, tzinfo=timezone.utc)

def incident(case_id: str, days_ago: int, district: str = "D1", crime_category: str = "THEFT") -> dict:
    return {
        "caseId": case_id,
        "incidentAt": (REFERENCE - timedelta(days=days_ago)).isoformat(),
        "districtId": district,
        "district": district,
        "crimeCategory": crime_category,
        "severity": "MEDIUM",
    }

def test_socioeconomic_correlations() -> None:
    # Generate mock incidents across 4 districts
    incidents = []
    # D1: 1 incident, D2: 2 incidents, D3: 3 incidents, D4: 4 incidents
    for d_idx in range(1, 5):
        dist_name = f"District_{d_idx}"
        for c_idx in range(d_idx):
            incidents.append(incident(f"C-{dist_name}-{c_idx}", days_ago=1, district=dist_name))
            
    # Mock socioeconomic indicators corresponding to the crime rate (positive correlation)
    indicators = [
        {"district": "District_1", "code": "povertyRate", "value": 10.0, "unit": "%"},
        {"district": "District_2", "code": "povertyRate", "value": 20.0, "unit": "%"},
        {"district": "District_3", "code": "povertyRate", "value": 30.0, "unit": "%"},
        {"district": "District_4", "code": "povertyRate", "value": 40.0, "unit": "%"},
    ]
    
    response = client.post(
        "/analytics/socioeconomic",
        json={"incidents": incidents, "indicators": indicators}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "Correlation does not prove" in body["warning"]
    
    correlations = body["correlations"]
    assert len(correlations) > 0
    poverty_corr = next(c for c in correlations if c["indicatorCode"] == "povertyRate")
    # Positive correlation since higher poverty matches higher crime counts
    assert poverty_corr["pearsonCorrelation"] > 0.9
    assert poverty_corr["spearmanCorrelation"] > 0.9
    assert poverty_corr["strength"] == "strong"

def test_trend_alerts_detection() -> None:
    # Set up 90 days baseline of 1 incident per week, and a spike of 15 incidents in the last 30 days
    incidents = []
    # Baseline (days 30 to 120 ago)
    for day in range(30, 120, 7):
        incidents.append(incident(f"Base-{day}", days_ago=day, district="D1", crime_category="CYBERCRIME"))
    # Spike (last 30 days)
    for day in range(1, 10):
        incidents.append(incident(f"Spike-{day}", days_ago=day, district="D1", crime_category="CYBERCRIME"))
        
    response = client.post(
        "/analytics/alerts",
        json={"incidents": incidents, "growthThreshold": 30.0, "zThreshold": 1.0}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    alerts = body["alerts"]
    assert len(alerts) > 0
    cyber_alert = next(a for a in alerts if a["crimeCategory"] == "CYBERCRIME")
    assert cyber_alert["alertType"] == "CRIME_SPIKE"
    assert cyber_alert["severity"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    assert cyber_alert["currentCount"] >= 9

def test_network_modularity_and_centrality() -> None:
    # Accused 1, 2, 3 accused together in incident 1
    # Accused 3, 4 accused in incident 2
    first = incident("N1", days_ago=1, district="D1")
    first["accusedIds"] = ["person-1", "person-2", "person-3"]
    second = incident("N2", days_ago=2, district="D1")
    second["accusedIds"] = ["person-3", "person-4"]
    
    response = client.post("/analytics/network", json={"incidents": [first, second]})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    
    # Check Louvain communities and centralities are present on person nodes
    nodes = body["nodes"]
    assert len(nodes) > 0
    person_nodes = [n for n in nodes if n["type"] == "PERSON"]
    assert len(person_nodes) > 0
    for node in person_nodes:
        assert "community" in node
        assert "weightedDegree" in node["metrics"]
        assert "eigenvectorCentrality" in node["metrics"]
