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
REFERENCE = datetime(2026, 5, 10, 12, tzinfo=timezone.utc)


def incident(case_id: str, *, latitude: float = 12.9716, longitude: float = 77.5946, days_ago: int = 0, district: str = "D1", station: str = "S1", severity: str = "MEDIUM") -> dict:
    return {
        "caseId": case_id,
        "incidentAt": (REFERENCE - timedelta(days=days_ago)).isoformat(),
        "latitude": latitude,
        "longitude": longitude,
        "districtId": district,
        "stationId": station,
        "crimeCategory": "BURGLARY",
        "severity": severity,
    }


def test_health_is_available_without_postgres() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["service"] == "kavach-analytics"


def test_hotspots_return_explainable_dbscan_cluster() -> None:
    incidents = [incident(f"C{index}", latitude=12.9716 + index * 0.0001, longitude=77.5946 + index * 0.0001, days_ago=index) for index in range(5)]
    response = client.post(
        "/analytics/hotspots",
        json={"incidents": incidents, "referenceTime": REFERENCE.isoformat(), "radiusMeters": 500, "minimumIncidents": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["hotspots"][0]["boundary"]["type"] == "Polygon"
    assert body["hotspots"][0]["evidence"]
    assert body["explainability"]["humanReviewRequired"] is True


def test_hotspots_report_insufficient_coordinate_data() -> None:
    response = client.post("/analytics/hotspots", json={"incidents": [incident("C1"), incident("C2")], "minimumIncidents": 5})
    assert response.status_code == 200
    assert response.json()["status"] == "insufficient_data"


def test_anomalies_exclude_protected_attributes_and_return_model_metadata() -> None:
    rows = []
    for index in range(24):
        record = incident(f"A{index}", days_ago=index % 8)
        record.update({"incidentToAt": (REFERENCE - timedelta(days=index % 8) + timedelta(hours=1)).isoformat(), "gender": "F", "religion": "Synthetic"})
        rows.append(record)
    outlier = incident("A-outlier", days_ago=1, severity="CRITICAL")
    outlier["incidentToAt"] = (REFERENCE - timedelta(days=1) + timedelta(hours=80)).isoformat()
    rows.append(outlier)
    response = client.post("/analytics/anomalies", json={"incidents": rows, "referenceTime": REFERENCE.isoformat()})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "gender" not in body["features"]
    assert any(model["name"] == "ISOLATION_FOREST" for model in body["models"])
    assert body["anomalies"]


def test_risk_factor_contributions_sum_to_score() -> None:
    records = [incident(f"R-current-{index}", days_ago=index % 7, severity="HIGH") for index in range(8)]
    records += [incident(f"R-baseline-{index}", days_ago=10 + index, severity="LOW") for index in range(8)]
    response = client.post(
        "/analytics/risk",
        json={"incidents": records, "referenceTime": REFERENCE.isoformat(), "aggregationLevel": "district"},
    )
    assert response.status_code == 200
    prediction = response.json()["predictions"][0]
    contribution_sum = sum(factor["contribution"] for factor in prediction["factors"])
    assert abs(contribution_sum - prediction["riskScore"] / 100) < 0.002
    assert prediction["humanReviewRequired"] is True


def test_network_returns_evidence_and_masks_people() -> None:
    first = incident("N1", district="D1")
    first["accusedIds"] = ["person-101", "person-202"]
    second = incident("N2", district="D2")
    second["accusedIds"] = ["person-101", "person-202"]
    response = client.post("/analytics/network", json={"incidents": [first, second]})
    assert response.status_code == 200
    body = response.json()
    edge = next(item for item in body["edges"] if item["relationship"] == "CO_ACCUSED_WITH")
    assert edge["evidence"]
    assert any(node["type"] == "PERSON" and "Person •" in node["label"] for node in body["nodes"])
    assert body["crossDistrictBridges"]


def test_mo_similarity_returns_matched_features_and_evidence() -> None:
    cases = [
        {"caseId": "MO1", "entryMethod": "forced rear entry", "targetType": "jewellery shop", "timePattern": "late night", "briefFacts": "forced rear entry at a jewellery shop"},
        {"caseId": "MO2", "entryMethod": "forced rear entry", "targetType": "jewellery shop", "timePattern": "late night", "briefFacts": "rear entry burglary of jewellery shop"},
    ]
    response = client.post("/analytics/mo-similarity", json={"cases": cases, "targetCaseId": "MO1"})
    assert response.status_code == 200
    similar = response.json()["similarCases"][0]
    assert "entry_method" in similar["matchedFeatures"]
    assert similar["evidence"]


def test_explain_endpoint_returns_human_review_safeguard() -> None:
    response = client.post(
        "/analytics/explain",
        json={"analysisType": "risk", "result": {"status": "ok", "recordCount": 5, "predictions": []}},
    )
    assert response.status_code == 200
    assert response.json()["explainability"]["humanReviewRequired"] is True
