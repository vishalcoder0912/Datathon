"""Transparent district/station aggregate risk decision support.

This module intentionally has no person-level risk score and never reads
protected demographic attributes. It produces a documented baseline while the
prototype lacks enough longitudinal data for validated forecasting ML.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from .common import (
    PROTOTYPE_DISCLAIMER,
    apply_filters,
    case_identifier,
    clamp,
    coordinates,
    crime_category,
    district_identifier,
    extract_person_roles,
    incident_datetime,
    period_for,
    rolling_windows,
    select_reference_time,
    severity_weight,
    station_identifier,
)

MODEL_VERSION = "district-risk-composite-1.0.0"

WEIGHTS = {
    "recent_trend_increase": 0.25,
    "historical_frequency": 0.20,
    "serious_offence_concentration": 0.15,
    "night_time_concentration": 0.10,
    "hotspot_persistence": 0.10,
    "cross_district_network_activity": 0.10,
    "repeat_offender_case_links": 0.05,
    "data_quality_penalty": 0.05,
}
POSITIVE_WEIGHT_TOTAL = sum(weight for name, weight in WEIGHTS.items() if name != "data_quality_penalty")


def _is_night(record: dict[str, Any]) -> bool:
    timestamp = incident_datetime(record)
    return timestamp is not None and (timestamp.hour >= 22 or timestamp.hour < 5)


def _quality_penalty(records: list[dict[str, Any]]) -> float:
    if not records:
        return 1.0
    checks = 0
    available = 0
    for record in records:
        for is_available in (incident_datetime(record) is not None, coordinates(record) is not None, crime_category(record) != "UNSPECIFIED"):
            checks += 1
            available += int(is_available)
    return 1.0 - (available / max(checks, 1))


def _risk_band(score: float) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _factor(name: str, weight: float, value: float, direction: str, explanation: str) -> dict[str, Any]:
    raw = weight * value
    if direction == "NEGATIVE":
        raw *= -1
    return {
        "name": name,
        "weight": weight,
        "factorValue": round(value, 4),
        "contribution": round(raw / POSITIVE_WEIGHT_TOTAL, 6),
        "direction": direction,
        "explanation": explanation,
    }


def calculate_risk(
    records: list[dict[str, Any]],
    *,
    filters: Any,
    aggregation_level: str,
    current_window_days: int,
    baseline_window_days: int,
    minimum_records: int,
    reference_time=None,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Score only aggregate places and time windows using fixed disclosed weights."""

    scoped_records = apply_filters(records, filters)
    if len(scoped_records) < minimum_records:
        return {
            "status": "insufficient_data",
            "minimumRequired": minimum_records,
            "available": len(scoped_records),
            "aggregationLevel": aggregation_level,
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    group_value = station_identifier if aggregation_level == "station" else district_identifier
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in scoped_records:
        grouped[group_value(record) or "UNASSIGNED"].append(record)

    reference = select_reference_time(scoped_records, reference_time)
    baseline_start, current_start, forecast_start = rolling_windows(reference, current_window_days, baseline_window_days)
    historical_max = max(len(group_records) for group_records in grouped.values())

    person_groups: dict[str, set[str]] = defaultdict(set)
    person_case_counts: Counter[str] = Counter()
    record_accused: dict[int, list[str]] = {}
    for index, record in enumerate(scoped_records):
        group = group_value(record) or "UNASSIGNED"
        accused_people = [person_id for person_id, role in extract_person_roles(record) if role == "ACCUSED"]
        record_accused[index] = accused_people
        for person_id in accused_people:
            person_groups[person_id].add(group)
            person_case_counts[person_id] += 1

    results: list[dict[str, Any]] = []
    for group, group_records in sorted(grouped.items()):
        if len(group_records) < minimum_records:
            continue
        current_records = [record for record in group_records if (timestamp := incident_datetime(record)) is not None and timestamp >= current_start]
        baseline_records = [
            record
            for record in group_records
            if (timestamp := incident_datetime(record)) is not None and baseline_start <= timestamp < current_start
        ]
        expected_current = len(baseline_records) * (current_window_days / baseline_window_days)
        if expected_current <= 0:
            trend_value = 1.0 if len(current_records) >= minimum_records else 0.0
            trend_percentage = 100.0 if len(current_records) else 0.0
        else:
            trend_percentage = ((len(current_records) - expected_current) / expected_current) * 100.0
            trend_value = clamp(max(trend_percentage, 0.0) / 100.0)

        historical_value = len(group_records) / max(historical_max, 1)
        serious_value = sum(1 for record in group_records if severity_weight(record) >= 3.0) / len(group_records)
        night_value = sum(1 for record in group_records if _is_night(record)) / len(group_records)
        coordinate_counts = Counter(
            (round(point[0], 3), round(point[1], 3)) for record in group_records if (point := coordinates(record)) is not None
        )
        hotspot_value = max(coordinate_counts.values(), default=0) / len(group_records)
        accused_people = [person_id for record in group_records for person_id, role in extract_person_roles(record) if role == "ACCUSED"]
        cross_district_value = (
            sum(1 for person_id in accused_people if len(person_groups[person_id]) > 1) / len(accused_people) if accused_people else 0.0
        )
        repeat_value = (
            sum(1 for person_id in accused_people if person_case_counts[person_id] >= 2) / len(accused_people) if accused_people else 0.0
        )
        quality_value = _quality_penalty(group_records)

        factors = [
            _factor(
                "Recent crime trend increase",
                WEIGHTS["recent_trend_increase"],
                trend_value,
                "POSITIVE",
                f"The current {current_window_days}-day count is {len(current_records)} versus an expected {round(expected_current, 2)} from the prior {baseline_window_days} days ({round(trend_percentage, 1)}% change).",
            ),
            _factor(
                "Historical frequency",
                WEIGHTS["historical_frequency"],
                historical_value,
                "POSITIVE",
                f"This area has {len(group_records)} scoped records, normalized against the most active selected area.",
            ),
            _factor(
                "Serious-offence concentration",
                WEIGHTS["serious_offence_concentration"],
                serious_value,
                "POSITIVE",
                f"{round(serious_value * 100, 1)}% of scoped records have high or critical severity weights.",
            ),
            _factor(
                "Night-time concentration",
                WEIGHTS["night_time_concentration"],
                night_value,
                "POSITIVE",
                f"{round(night_value * 100, 1)}% of timestamped incidents occurred between 22:00 and 05:00.",
            ),
            _factor(
                "Hotspot persistence",
                WEIGHTS["hotspot_persistence"],
                hotspot_value,
                "POSITIVE",
                "This uses repeated approximate coordinates as a transparent persistence proxy; a PostGIS/DBSCAN hotspot result should be reviewed alongside it.",
            ),
            _factor(
                "Cross-district network activity",
                WEIGHTS["cross_district_network_activity"],
                cross_district_value,
                "POSITIVE",
                "This measures only supplied accused-to-case links spanning selected aggregate areas; it is not an assessment of individual culpability.",
            ),
            _factor(
                "Repeat case links",
                WEIGHTS["repeat_offender_case_links"],
                repeat_value,
                "POSITIVE",
                "This measures canonical accused identities linked to two or more supplied cases, not predicted reoffending.",
            ),
            _factor(
                "Data-quality penalty",
                WEIGHTS["data_quality_penalty"],
                quality_value,
                "NEGATIVE",
                f"{round(quality_value * 100, 1)}% of expected timestamp, category, and coordinate fields are missing or invalid.",
            ),
        ]
        score = round(max(0.0, min(100.0, sum(factor["contribution"] for factor in factors) * 100)), 2)
        confidence = round(clamp(0.35 + min(len(group_records), 100) / 200 + (1 - quality_value) * 0.25, 0.0, 0.9), 3)
        result = {
            "riskScore": score,
            "riskBand": _risk_band(score),
            "confidence": confidence,
            "forecastHorizon": f"{current_window_days} days",
            "forecastStart": forecast_start.isoformat(),
            "forecastEnd": (forecast_start + timedelta(days=current_window_days)).isoformat(),
            "districtId": group if aggregation_level == "district" else next((district_identifier(record) for record in group_records if district_identifier(record)), None),
            "policeStationId": group if aggregation_level == "station" else None,
            "aggregationLevel": aggregation_level,
            "factors": sorted(factors, key=lambda factor: abs(factor["contribution"]), reverse=True),
            "dataFreshness": period_for(group_records).get("end"),
            "dataPeriod": period_for(group_records),
            "recordCount": len(group_records),
            "modelVersion": model_version or MODEL_VERSION,
            "algorithm": "transparent_composite_baseline",
            "humanReviewRequired": True,
            "humanReviewStatus": "PENDING_REVIEW",
        }
        results.append(result)

    if not results:
        return {
            "status": "insufficient_data",
            "minimumRequired": minimum_records,
            "available": len(scoped_records),
            "reason": "No district or station group met the configured record threshold.",
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }
    results.sort(key=lambda item: (-item["riskScore"], str(item.get("districtId") or item.get("policeStationId"))))
    return {
        "status": "ok",
        "predictions": results,
        "recordCount": len(scoped_records),
        "aggregationLevel": aggregation_level,
        "weights": WEIGHTS,
        "modelVersion": model_version or MODEL_VERSION,
        "algorithm": "transparent_composite_baseline",
        "modelMetrics": {"status": "not_applicable", "reason": "A transparent baseline is used until sufficient time-split validation data is available."},
        "excludedFeatures": ["caste", "religion", "gender", "age", "date_of_birth", "socioeconomic_indicators"],
        "limitations": [
            "Scores are aggregate decision support for a place and time window, not individual criminality or enforcement recommendations.",
            "Socioeconomic indicators are intentionally not risk-model features; they may be studied only as non-causal aggregate correlations elsewhere.",
        ],
        "humanReviewRequired": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }
