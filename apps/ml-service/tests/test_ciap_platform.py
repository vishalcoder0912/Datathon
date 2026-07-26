from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

from app.ingestion import redact_secrets
from app.main import app

client = TestClient(app)
REFERENCE = datetime(2026, 7, 19, tzinfo=UTC)


def incident(index: int, *, latitude: float = 12.9716, longitude: float = 77.5946) -> dict:
    return {
        "caseId": f"CASE-{index:03d}",
        "incidentAt": (REFERENCE - timedelta(days=index)).isoformat(),
        "latitude": latitude,
        "longitude": longitude,
        "district": "Bengaluru",
        "station": "Central PS",
        "crimeCategory": "BURGLARY",
        "modusOperandi": "forced entry",
        "accusedIds": ["masked-person-1"] if index < 2 else [f"masked-person-{index}"],
    }


def test_api_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_local_csv_and_json_ingestion(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("CIAP_IMPORT_ROOT", str(tmp_path))
    fixtures = Path(__file__).parent / "fixtures"
    csv_path = tmp_path / "crime.csv"
    json_path = tmp_path / "crime.json"
    csv_path.write_bytes((fixtures / "crime_events.csv").read_bytes())
    json_path.write_bytes((fixtures / "crime_events.json").read_bytes())
    csv_response = client.post("/api/ingestion/preview", json={"uri": "crime.csv"})
    json_response = client.post("/api/ingestion/preview", json={"uri": "crime.json"})
    assert csv_response.status_code == 200
    assert csv_response.json()["row_count"] == 5
    assert json_response.status_code == 200
    assert json_response.json()["row_count"] == 2


def test_local_parquet_ingestion(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("CIAP_IMPORT_ROOT", str(tmp_path))
    parquet_path = tmp_path / "crime.parquet"
    pd.DataFrame([incident(1), incident(2)]).to_parquet(parquet_path)
    response = client.post("/api/ingestion/load", json={"uri": "crime.parquet"})
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["row_count"] == 2


def test_unsupported_uri_and_local_escape_are_rejected(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("CIAP_IMPORT_ROOT", str(tmp_path))
    unsupported = client.post("/api/ingestion/preview", json={"uri": "ftp://example.test/crime.csv"})
    escaped = client.post("/api/ingestion/preview", json={"uri": "../outside.csv"})
    assert unsupported.status_code == 400
    assert escaped.status_code == 400


def test_secret_redaction() -> None:
    redacted = redact_secrets({"access_key": "visible-secret", "nested": {"password": "hidden"}})
    assert "visible-secret" not in str(redacted)
    assert "hidden" not in str(redacted)
    assert str(redacted).count("***REDACTED***") == 2


def test_haversine_dbscan_cluster() -> None:
    records = [incident(index, latitude=12.9716 + index * 0.0001, longitude=77.5946 + index * 0.0001) for index in range(5)]
    response = client.post("/api/analytics/clusters", json={"incidents": records, "epsilon_km": 0.5, "min_samples": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["algorithm"] == "DBSCAN_haversine"
    assert body["clusters"][0]["point_count"] == 5
    assert body["clusters"][0]["cluster_id"] == 0


def test_invalid_coordinates() -> None:
    response = client.post("/api/analytics/clusters", json={"incidents": [incident(1, latitude=95.0)], "min_samples": 2})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_COORDINATES"


def test_zscore_and_isolation_forest_anomalies() -> None:
    records = [
        {"region": "D1", "timestamp": f"2026-06-{index + 1:02d}", "crime_count": 10 + (index % 2), "crime_category": "THEFT"}
        for index in range(20)
    ]
    records.append({"region": "D1", "timestamp": "2026-07-01", "crime_count": 100, "crime_category": "THEFT"})
    response = client.post("/api/analytics/anomalies", json={"records": records, "methods": ["zscore", "isolation_forest"]})
    assert response.status_code == 200
    methods = {alert["method"] for alert in response.json()["alerts"]}
    assert "zscore" in methods
    assert "isolation_forest" in methods


def test_forecast_with_sufficient_data() -> None:
    records = [{"occurred_at": (REFERENCE - timedelta(days=index)).isoformat(), "district": "D1", "incident_count": 5 + index % 7} for index in range(35)]
    response = client.post("/api/analytics/forecast", json={"records": records, "group_by": "district", "periods": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert len(body["forecast"]) == 5
    assert body["forecast"][0]["model_name"] in {"SARIMAX", "rolling_mean_baseline"}


def test_forecast_fallback_with_insufficient_history() -> None:
    records = [{"occurred_at": (REFERENCE - timedelta(days=index)).isoformat(), "district": "D1", "incident_count": 3} for index in range(3)]
    response = client.post("/api/analytics/forecast", json={"records": records, "periods": 2})
    assert response.status_code == 200
    assert response.json()["forecast"][0]["model_name"] == "rolling_mean_baseline"


def test_repeat_offender_force_graph_and_explanations() -> None:
    response = client.post("/api/network/build", json={"incidents": [incident(0), incident(1)]})
    assert response.status_code == 200
    body = response.json()
    person = next(node for node in body["nodes"] if node["id"] == "person:masked-person-1")
    assert person["repeatOffender"] is True
    assert body["links"]
    assert all(link["explanation"] for link in body["links"])


def test_empty_graph_and_demo_graph() -> None:
    empty = client.post("/api/network/build", json={})
    demo = client.get("/api/network/demo")
    assert empty.status_code == 200
    assert empty.json()["nodes"] == []
    assert demo.status_code == 200
    assert demo.json()["nodes"] and demo.json()["links"]


def test_openapi_contract_contains_required_routes() -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert {"/api/health", "/api/analytics/clusters", "/api/analytics/anomalies", "/api/analytics/forecast", "/api/network/build", "/api/network/demo"} <= set(paths)
