"""Uniform explanation payloads for KAVACH analytical results."""

from __future__ import annotations

from typing import Any

from .common import PROTOTYPE_DISCLAIMER


def _representative_result(analysis_type: str, result: dict[str, Any]) -> dict[str, Any]:
    collection_key = {
        "hotspot": "hotspots",
        "anomaly": "anomalies",
        "risk": "predictions",
        "network": "edges",
        "mo_similarity": "similarCases",
        "socioeconomic": "correlations",
        "trend_alert": "alerts",
    }.get(analysis_type)
    values = result.get(collection_key, []) if collection_key else []
    return values[0] if isinstance(values, list) and values and isinstance(values[0], dict) else result


def build_explanation(
    analysis_type: str,
    result: dict[str, Any],
    *,
    record_count: int | None = None,
    data_period: dict[str, Any] | None = None,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Create UI-ready, measurable explanation fields from structured output."""

    representative = _representative_result(analysis_type, result)
    evidence = representative.get("evidence", result.get("evidence", []))
    if not isinstance(evidence, list):
        evidence = [str(evidence)]
    if analysis_type == "hotspot":
        detected = "A geographic concentration of incident records was detected." if result.get("status") == "ok" else "No reportable geographic concentration was detected."
    elif analysis_type == "anomaly":
        detected = "A record differs statistically from comparable supplied operational records." if result.get("anomalies") else "No statistical anomaly met the selected thresholds."
    elif analysis_type == "risk":
        detected = "An aggregate geographic and time-window risk baseline was calculated." if result.get("predictions") else "No aggregate risk score could be calculated from the supplied records."
    elif analysis_type == "network":
        detected = "A case-link network was generated from explicit record relationships." if result.get("edges") else "No relationship edges were available in the supplied records."
    elif analysis_type == "socioeconomic":
        detected = "Socioeconomic indicator correlations with crime density were computed."
    elif analysis_type == "trend_alert":
        detected = "Emerging crime trend alerts were calculated based on historical rolling baselines."
    else:
        detected = "Cases were compared for modus-operandi pattern similarity." if result.get("similarCases") else "No candidate case met the requested modus-operandi similarity threshold."

    factors = representative.get("factors") or representative.get("topContributingFeatures") or []
    factor_summaries = []
    for factor in factors[:5] if isinstance(factors, list) else []:
        if isinstance(factor, dict):
            factor_summaries.append(
                {
                    "name": factor.get("name"),
                    "contribution": factor.get("contribution", factor.get("zScore", factor.get("deviation"))),
                    "explanation": factor.get("explanation"),
                }
            )
    return {
        "whatWasDetected": detected,
        "whyItWasDetected": evidence or ["The result was generated from the disclosed algorithm and selected filters."],
        "dataUsed": {
            "recordCount": record_count if record_count is not None else result.get("recordCount", representative.get("recordCount", 0)),
            "dataPeriod": data_period or result.get("dataPeriod") or representative.get("dataPeriod"),
            "protectedAttributesExcluded": ["caste", "religion", "gender", "age", "date_of_birth"],
        },
        "algorithm": representative.get("algorithm", result.get("algorithm", "deterministic_analytics")),
        "modelVersion": model_version or representative.get("modelVersion") or result.get("modelVersion"),
        "confidence": representative.get("confidence"),
        "factors": factor_summaries,
        "limitations": result.get("limitations", ["The output requires human review before any operational use."]),
        "humanReviewStatus": representative.get("humanReviewStatus", "PENDING_REVIEW"),
        "humanReviewRequired": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }
