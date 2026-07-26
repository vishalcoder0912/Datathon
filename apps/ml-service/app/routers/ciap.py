"""Stable CIAP API contract layered over the existing KAVACH analytics engine."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..ingestion import IngestionError, fetch_cloud_data, provider_for, redact_secrets
from ..services.aggregate_anomalies import detect_regional_anomalies
from ..services.common import PROTOTYPE_DISCLAIMER
from ..services.forecasting import forecast_crime_counts
from ..services.hotspots import detect_hotspots
from ..services.networks import build_network
from ..state import record_audit

router = APIRouter(prefix="/api", tags=["CIAP public contract"])
EMPTY_FILTERS = SimpleNamespace(date_from=None, date_to=None, district_id=None, station_id=None, crime_head_id=None, crime_sub_head_id=None, status=None, severity=None, daypart=None)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IngestionRequest(StrictModel):
    uri: str = Field(min_length=1, max_length=2_048)
    credentials: dict[str, Any] | None = Field(default=None, repr=False)
    limit: int = Field(default=20, ge=1, le=100)


class ClusterRequest(StrictModel):
    incidents: list[dict[str, Any]] = Field(min_length=1, max_length=50_000)
    epsilon_km: float = Field(default=0.5, gt=0, le=100)
    min_samples: int = Field(default=5, ge=2, le=500)


def _default_anomaly_methods() -> list[Literal["zscore", "isolation_forest"]]:
    return ["zscore", "isolation_forest"]


class RegionalAnomalyRequest(StrictModel):
    records: list[dict[str, Any]] = Field(min_length=3, max_length=50_000)
    methods: list[Literal["zscore", "isolation_forest"]] = Field(default_factory=_default_anomaly_methods)
    z_threshold: float = Field(default=2.0, ge=1.0, le=8.0)
    contamination: float = Field(default=0.1, ge=0.01, le=0.45)


class ForecastRequest(StrictModel):
    records: list[dict[str, Any]] = Field(min_length=1, max_length=100_000)
    group_by: Literal["district", "police_station", "crime_category"] = "district"
    periods: int = Field(default=7, ge=1, le=90)


class NetworkBuildRequest(StrictModel):
    incidents: list[dict[str, Any]] = Field(default_factory=list, max_length=50_000)
    relationships: list[dict[str, Any]] = Field(default_factory=list, max_length=50_000)


def _safe_ingestion_error(error: Exception) -> HTTPException:
    return HTTPException(status_code=400, detail={"code": "INGESTION_ERROR", "message": str(redact_secrets(error))})


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "healthy", "service": "ciap-analytics", "capabilities": ["ingestion", "clusters", "anomalies", "forecast", "network"], "human_review_required": True}


@router.post("/ingestion/test")
def test_connection(payload: IngestionRequest) -> dict[str, Any]:
    try:
        result = provider_for(payload.uri, payload.credentials).test_connection()
        record_audit("connector_tested", {"provider": result.provider, "ok": result.ok})
        return {"provider": result.provider, "ok": result.ok, "message": result.message}
    except IngestionError as error:
        raise _safe_ingestion_error(error) from error


@router.post("/ingestion/preview")
def preview(payload: IngestionRequest) -> dict[str, Any]:
    try:
        return fetch_cloud_data(payload.uri, payload.credentials, payload.limit).model_dump()
    except (IngestionError, OSError, ValueError) as error:
        raise _safe_ingestion_error(error) from error


@router.post("/ingestion/load")
def load(payload: IngestionRequest) -> dict[str, Any]:
    try:
        result = fetch_cloud_data(payload.uri, payload.credentials, payload.limit)
        return {"status": "completed", **result.model_dump()}
    except (IngestionError, OSError, ValueError) as error:
        raise _safe_ingestion_error(error) from error


@router.post("/analytics/clusters")
def clusters(payload: ClusterRequest) -> dict[str, Any]:
    for record in payload.incidents:
        latitude = record.get("latitude")
        longitude = record.get("longitude")
        if latitude is None or longitude is None or not (-90 <= float(latitude) <= 90) or not (-180 <= float(longitude) <= 180):
            raise HTTPException(status_code=422, detail={"code": "INVALID_COORDINATES", "message": "Latitude must be -90..90 and longitude -180..180"})
    result = detect_hotspots(payload.incidents, filters=EMPTY_FILTERS, radius_meters=payload.epsilon_km * 1_000, minimum_incidents=payload.min_samples, maximum_hotspots=500, crime_category_value=None)
    adapted = []
    for index, hotspot in enumerate(result.get("hotspots", [])):
        boundary = hotspot.get("boundary", {}).get("coordinates", [[]])[0]
        longitudes = [point[0] for point in boundary] if boundary else []
        latitudes = [point[1] for point in boundary] if boundary else []
        score = float(hotspot.get("riskScore", 0))
        adapted.append({
            "cluster_id": index,
            "point_count": hotspot.get("incidentCount", 0),
            "centroid": hotspot.get("centroid"),
            "bounds": {"min_latitude": min(latitudes) if latitudes else None, "max_latitude": max(latitudes) if latitudes else None, "min_longitude": min(longitudes) if longitudes else None, "max_longitude": max(longitudes) if longitudes else None},
            "dominant_crime_category": hotspot.get("dominantCategory"),
            "time_range": hotspot.get("dataPeriod"),
            "risk_level": "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 30 else "low",
            "risk_score": score,
            "explanation": (hotspot.get("evidence") or ["Density-connected spatial cluster."])[0],
        })
    return {"status": result.get("status"), "algorithm": result.get("algorithm", "DBSCAN_haversine"), "clusters": adapted, "noise_cluster_id": -1, "human_review_required": True, "disclaimer": PROTOTYPE_DISCLAIMER}


@router.post("/analytics/anomalies")
def anomalies(payload: RegionalAnomalyRequest) -> dict[str, Any]:
    return {"status": "ok", "alerts": detect_regional_anomalies(payload.records, payload.methods, payload.z_threshold, payload.contamination), "human_review_required": True, "disclaimer": PROTOTYPE_DISCLAIMER}


@router.post("/analytics/forecast")
def forecast(payload: ForecastRequest) -> dict[str, Any]:
    return forecast_crime_counts(payload.records, payload.group_by, payload.periods)


def _force_graph(result: dict[str, Any]) -> dict[str, Any]:
    case_links: dict[str, set[str]] = {}
    for edge in result.get("edges", []):
        person = edge["source"] if str(edge["source"]).startswith("person:") else edge["target"] if str(edge["target"]).startswith("person:") else None
        case = edge["source"] if str(edge["source"]).startswith("case:") else edge["target"] if str(edge["target"]).startswith("case:") else None
        if person and case:
            case_links.setdefault(person, set()).add(case)
    type_map = {"PERSON": "suspect", "CASE": "incident", "LOCATION": "location"}
    nodes = [{"id": node["id"], "type": type_map.get(node["type"], "location"), "label": node["label"], "repeatOffender": len(case_links.get(node["id"], set())) > 1, "modusOperandi": [], "metadata": {"community": node.get("community"), "metrics": node.get("metrics", {})}} for node in result.get("nodes", [])]
    links = [{"source": edge["source"], "target": edge["target"], "type": str(edge.get("relationship", "ASSOCIATED_WITH")).casefold(), "weight": edge.get("weight", 1), "explanation": ((edge.get("evidence") or [{}])[0].get("reason") or "Relationship derived from supplied normalized records.")} for edge in result.get("edges", [])]
    return {"nodes": nodes, "links": links, "human_review_required": True, "disclaimer": PROTOTYPE_DISCLAIMER}


@router.post("/network/build")
def network(payload: NetworkBuildRequest) -> dict[str, Any]:
    result = build_network(payload.incidents, relationships=payload.relationships, maximum_nodes=500, minimum_edge_weight=1)
    return _force_graph(result)


@router.get("/network/demo")
def network_demo() -> dict[str, Any]:
    incidents = [
        {"caseId": "DEMO-001", "incidentAt": "2026-07-01T10:00:00Z", "latitude": 12.9716, "longitude": 77.5946, "district": "Bengaluru", "crimeCategory": "BURGLARY", "modusOperandi": "forced entry", "accusedIds": ["masked-person-1"]},
        {"caseId": "DEMO-002", "incidentAt": "2026-07-03T22:00:00Z", "latitude": 12.9720, "longitude": 77.5950, "district": "Bengaluru", "crimeCategory": "BURGLARY", "modusOperandi": "forced entry", "accusedIds": ["masked-person-1"]},
    ]
    return _force_graph(build_network(incidents, relationships=[], maximum_nodes=100, minimum_edge_weight=1))
