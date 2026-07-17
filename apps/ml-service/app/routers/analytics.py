"""KAVACH-only analytics endpoints consumed by the Node backend."""

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import AnomalyRequest, ExplainRequest, HotspotRequest, MoSimilarityRequest, NetworkRequest, RiskRequest
from ..services.anomalies import detect_anomalies
from ..services.common import apply_filters
from ..services.explanations import build_explanation
from ..services.hotspots import detect_hotspots
from ..services.mo_similarity import find_similar_modus_operandi
from ..services.networks import build_network
from ..services.risk import calculate_risk

router = APIRouter(prefix="/analytics", tags=["KAVACH analytics"])


def _with_explanation(analysis_type: str, result: dict) -> dict:
    result["explainability"] = build_explanation(
        analysis_type,
        result,
        record_count=result.get("recordCount"),
        data_period=result.get("dataPeriod"),
        model_version=result.get("modelVersion"),
    )
    return result


@router.post("/hotspots")
def hotspots(payload: HotspotRequest) -> dict:
    result = detect_hotspots(
        payload.records(),
        filters=payload.filters,
        radius_meters=payload.radius_meters,
        minimum_incidents=payload.minimum_incidents,
        maximum_hotspots=payload.maximum_hotspots,
        crime_category_value=payload.crime_category,
        reference_time=payload.reference_time,
        model_version=payload.model_version,
    )
    return _with_explanation("hotspot", result)


@router.post("/anomalies")
def anomalies(payload: AnomalyRequest) -> dict:
    scoped_records = apply_filters(payload.records(), payload.filters)
    result = detect_anomalies(
        scoped_records,
        methods=payload.methods,
        z_score_threshold=payload.z_score_threshold,
        iqr_multiplier=payload.iqr_multiplier,
        contamination=payload.contamination,
        maximum_anomalies=payload.maximum_anomalies,
        model_version=payload.model_version,
    )
    return _with_explanation("anomaly", result)


@router.post("/risk")
def risk(payload: RiskRequest) -> dict:
    result = calculate_risk(
        payload.records(),
        filters=payload.filters,
        aggregation_level=payload.aggregation_level,
        current_window_days=payload.current_window_days,
        baseline_window_days=payload.baseline_window_days,
        minimum_records=payload.minimum_records,
        reference_time=payload.reference_time,
        model_version=payload.model_version,
    )
    return _with_explanation("risk", result)


@router.post("/network")
def network(payload: NetworkRequest) -> dict:
    scoped_records = apply_filters(payload.records(), payload.filters)
    result = build_network(
        scoped_records,
        relationships=payload.relationships,
        maximum_nodes=payload.maximum_nodes,
        minimum_edge_weight=payload.minimum_edge_weight,
        focus_node_id=payload.focus_node_id,
        shortest_path_from=payload.shortest_path_from,
        shortest_path_to=payload.shortest_path_to,
        model_version=payload.model_version,
    )
    return _with_explanation("network", result)


@router.post("/mo-similarity")
def mo_similarity(payload: MoSimilarityRequest) -> dict:
    result = find_similar_modus_operandi(
        payload.source_cases(),
        target_case_id=payload.target_case_id,
        target_case=payload.target_case,
        minimum_similarity=payload.minimum_similarity,
        maximum_results=payload.maximum_results,
        use_embeddings=payload.use_embeddings,
        model_version=payload.model_version,
    )
    return _with_explanation("mo_similarity", result)


@router.post("/explain")
def explain(payload: ExplainRequest) -> dict:
    return {
        "status": "ok",
        "analysisType": payload.analysis_type,
        "explainability": build_explanation(
            payload.analysis_type,
            payload.result,
            record_count=payload.record_count,
            data_period=payload.data_period,
            model_version=payload.model_version,
        ),
    }
