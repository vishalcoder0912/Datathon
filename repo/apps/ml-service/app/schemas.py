"""Validated request models for KAVACH's internal analytics API.

The Node service remains the public API boundary. These models intentionally
accept a flexible incident-row shape because the Node repository can supply a
PostgreSQL view or an in-memory synthetic payload during degraded operation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    """Base model with strict top-level request validation."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class AnalyticsFilters(ApiModel):
    date_from: datetime | None = Field(default=None, alias="dateFrom")
    date_to: datetime | None = Field(default=None, alias="dateTo")
    district_id: str | int | None = Field(default=None, alias="districtId")
    station_id: str | int | None = Field(default=None, alias="stationId")
    crime_head_id: str | int | None = Field(default=None, alias="crimeHeadId")
    crime_sub_head_id: str | int | None = Field(default=None, alias="crimeSubHeadId")
    status: str | None = None
    severity: str | None = None
    daypart: str | None = None


class AnalyticsRequest(ApiModel):
    """Base payload accepted by all analytical endpoints.

    ``rows`` is retained as a compatibility alias for callers that already use
    generic tabular analytics payloads. When both are supplied, ``incidents``
    takes precedence to avoid accidental double counting.
    """

    incidents: list[dict[str, Any]] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    filters: AnalyticsFilters = Field(default_factory=AnalyticsFilters)
    reference_time: datetime | None = Field(default=None, alias="referenceTime")
    model_version: str | None = Field(default=None, alias="modelVersion")

    def records(self) -> list[dict[str, Any]]:
        return self.incidents if self.incidents else self.rows


class HotspotRequest(AnalyticsRequest):
    radius_meters: float = Field(default=500.0, ge=25.0, le=10_000.0, alias="radiusMeters")
    minimum_incidents: int = Field(default=5, ge=2, le=500, alias="minimumIncidents")
    maximum_hotspots: int = Field(default=100, ge=1, le=500, alias="maximumHotspots")
    crime_category: str | None = Field(default=None, alias="crimeCategory")


class AnomalyRequest(AnalyticsRequest):
    methods: list[Literal["iqr", "zscore", "isolation_forest"]] = Field(
        default_factory=lambda: ["iqr", "zscore", "isolation_forest"]
    )
    z_score_threshold: float = Field(default=3.0, ge=1.0, le=8.0, alias="zScoreThreshold")
    iqr_multiplier: float = Field(default=1.5, ge=0.5, le=5.0, alias="iqrMultiplier")
    contamination: float = Field(default=0.1, ge=0.01, le=0.45)
    maximum_anomalies: int = Field(default=100, ge=1, le=500, alias="maximumAnomalies")


class RiskRequest(AnalyticsRequest):
    aggregation_level: Literal["district", "station"] = Field(default="district", alias="aggregationLevel")
    current_window_days: int = Field(default=7, ge=1, le=90, alias="currentWindowDays")
    baseline_window_days: int = Field(default=28, ge=7, le=365, alias="baselineWindowDays")
    minimum_records: int = Field(default=3, ge=1, le=10_000, alias="minimumRecords")
    socioeconomic_indicators: list[dict[str, Any]] = Field(default_factory=list, alias="socioeconomicIndicators")


class NetworkRequest(AnalyticsRequest):
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    focus_node_id: str | None = Field(default=None, alias="focusNodeId")
    shortest_path_from: str | None = Field(default=None, alias="shortestPathFrom")
    shortest_path_to: str | None = Field(default=None, alias="shortestPathTo")
    maximum_nodes: int = Field(default=500, ge=10, le=2_000, alias="maximumNodes")
    minimum_edge_weight: int = Field(default=1, ge=1, le=100, alias="minimumEdgeWeight")


class MoSimilarityRequest(ApiModel):
    cases: list[dict[str, Any]] = Field(default_factory=list)
    incidents: list[dict[str, Any]] = Field(default_factory=list)
    target_case_id: str | int | None = Field(default=None, alias="targetCaseId")
    target_case: dict[str, Any] | None = Field(default=None, alias="targetCase")
    minimum_similarity: float = Field(default=0.2, ge=0.0, le=1.0, alias="minimumSimilarity")
    maximum_results: int = Field(default=25, ge=1, le=100, alias="maximumResults")
    use_embeddings: bool = Field(default=False, alias="useEmbeddings")
    model_version: str | None = Field(default=None, alias="modelVersion")

    def source_cases(self) -> list[dict[str, Any]]:
        return self.cases if self.cases else self.incidents


class ExplainRequest(ApiModel):
    analysis_type: Literal["hotspot", "anomaly", "risk", "network", "mo_similarity"] = Field(alias="analysisType")
    result: dict[str, Any]
    record_count: int | None = Field(default=None, ge=0, alias="recordCount")
    data_period: dict[str, Any] | None = Field(default=None, alias="dataPeriod")
    model_version: str | None = Field(default=None, alias="modelVersion")


class SocioeconomicRequest(AnalyticsRequest):
    indicators: list[dict[str, Any]] = Field(default_factory=list)


class AlertsRequest(AnalyticsRequest):
    growth_threshold: float = Field(default=30.0, alias="growthThreshold")
    z_threshold: float = Field(default=1.5, alias="zThreshold")

