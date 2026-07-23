"""Safe, explainable anomaly detection for aggregate incident characteristics."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

import numpy as np

try:
    from sklearn.ensemble import IsolationForest
except Exception:  # pragma: no cover - deterministic IQR/Z-score modes remain available
    IsolationForest = None

from .common import (
    PROTOTYPE_DISCLAIMER,
    as_datetime,
    as_float,
    case_identifier,
    coordinates,
    crime_category,
    extract_person_roles,
    incident_datetime,
    iso_datetime,
    period_for,
    severity_weight,
    value_for,
)

MODEL_VERSION = "incident-anomaly-ensemble-1.0.0"


def _duration_hours(record: dict[str, Any]) -> float | None:
    start = incident_datetime(record)
    end = as_datetime(value_for(record, "incident_to_at", "incidentToAt", "incident_end_at", "incidentEndAt"))
    if start is None or end is None or end < start:
        return None
    return (end - start).total_seconds() / 3600.0


def _delay_hours(record: dict[str, Any], end_aliases: tuple[str, ...], start_aliases: tuple[str, ...]) -> float | None:
    end = as_datetime(value_for(record, *end_aliases))
    start = as_datetime(value_for(record, *start_aliases))
    if start is None or end is None or end < start:
        return None
    return (end - start).total_seconds() / 3600.0


def _feature_rows(records: list[dict[str, Any]]) -> tuple[list[dict[str, float]], list[str]]:
    category_counts = Counter(crime_category(record) for record in records)
    coordinate_counts = Counter(
        (round(point[0], 3), round(point[1], 3)) for record in records if (point := coordinates(record)) is not None
    )
    person_case_counts: Counter[str] = Counter()
    for record in records:
        for person_id, role in extract_person_roles(record):
            if role == "ACCUSED":
                person_case_counts[person_id] += 1

    rows: list[dict[str, float]] = []
    for record in records:
        timestamp = incident_datetime(record)
        values: dict[str, float] = {"severity_weight": severity_weight(record)}
        if timestamp is not None:
            values["incident_hour"] = float(timestamp.hour)
            values["day_of_week"] = float(timestamp.weekday())
        duration = _duration_hours(record)
        if duration is not None:
            values["incident_duration_hours"] = duration
        information_delay = _delay_hours(
            record,
            ("info_received_ps_at", "infoReceivedPsAt", "information_received_at"),
            ("incident_from_at", "incidentAt", "incident_date", "incidentDate"),
        )
        if information_delay is not None:
            values["information_reporting_delay_hours"] = information_delay
        registration_delay = _delay_hours(
            record,
            ("crime_registered_at", "crimeRegisteredAt", "registered_date", "registeredAt"),
            ("info_received_ps_at", "infoReceivedPsAt", "information_received_at"),
        )
        if registration_delay is not None:
            values["registration_delay_hours"] = registration_delay
        point = coordinates(record)
        if point is not None:
            values["location_density"] = float(coordinate_counts[(round(point[0], 3), round(point[1], 3))])
        accused_counts = [person_case_counts[person_id] for person_id, role in extract_person_roles(record) if role == "ACCUSED"]
        if accused_counts:
            values["repeat_offender_case_links"] = float(max(accused_counts))
        category_total = category_counts[crime_category(record)]
        values["mo_rarity"] = 1.0 / max(category_total, 1)
        rows.append(values)
    feature_names = sorted({feature for row in rows for feature in row})
    return rows, feature_names


def _matrix(rows: list[dict[str, float]], features: list[str]) -> tuple[np.ndarray, list[str]]:
    raw = np.asarray([[row.get(feature, np.nan) for feature in features] for row in rows], dtype=float)
    usable: list[int] = []
    for index in range(raw.shape[1]):
        present = raw[:, index][np.isfinite(raw[:, index])]
        if len(present) >= 2 and not np.allclose(present, present[0]):
            usable.append(index)
    if not usable:
        return np.empty((len(rows), 0)), []
    selected = raw[:, usable]
    medians = np.nanmedian(selected, axis=0)
    selected = np.where(np.isfinite(selected), selected, medians)
    return selected, [features[index] for index in usable]


def _feature_detail(name: str, value: float, baseline: float, score: float, method: str) -> dict[str, Any]:
    metric_name = "zScore" if method == "zscore" else "deviation"
    return {
        "name": name,
        "value": round(float(value), 4),
        "baseline": round(float(baseline), 4),
        metric_name: round(float(score), 4),
        "method": method,
    }


def detect_anomalies(
    records: list[dict[str, Any]],
    *,
    methods: list[str],
    z_score_threshold: float,
    iqr_multiplier: float,
    contamination: float,
    maximum_anomalies: int,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Run IQR, Z-score and optional Isolation Forest without protected features."""

    if len(records) < 3:
        return {
            "status": "insufficient_data",
            "minimumRequired": 3,
            "available": len(records),
            "recordCount": len(records),
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    row_features, all_features = _feature_rows(records)
    matrix, features = _matrix(row_features, all_features)
    if not features:
        return {
            "status": "insufficient_data",
            "minimumRequired": 3,
            "available": len(records),
            "recordCount": len(records),
            "reason": "The supplied records do not contain enough variable, non-protected analytical features.",
            "excludedFeatures": ["caste", "religion", "gender", "age", "date_of_birth"],
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    selected_methods = list(dict.fromkeys(methods))
    flags: dict[int, list[dict[str, Any]]] = defaultdict(list)
    model_results: list[dict[str, Any]] = []

    if "iqr" in selected_methods:
        q1 = np.percentile(matrix, 25, axis=0)
        q3 = np.percentile(matrix, 75, axis=0)
        iqr = q3 - q1
        lower = q1 - iqr_multiplier * iqr
        upper = q3 + iqr_multiplier * iqr
        count = 0
        for row_index in range(matrix.shape[0]):
            for column_index, feature in enumerate(features):
                if iqr[column_index] <= 0:
                    continue
                value = matrix[row_index, column_index]
                if value < lower[column_index] or value > upper[column_index]:
                    deviation = max((lower[column_index] - value) / iqr[column_index], (value - upper[column_index]) / iqr[column_index])
                    flags[row_index].append(_feature_detail(feature, value, np.median(matrix[:, column_index]), deviation, "iqr"))
                    count += 1
        model_results.append({"name": "IQR", "version": "iqr-1.0.0", "status": "completed", "flaggedFeatureValues": count})

    if "zscore" in selected_methods:
        means = np.mean(matrix, axis=0)
        standard_deviations = np.std(matrix, axis=0)
        count = 0
        for row_index in range(matrix.shape[0]):
            for column_index, feature in enumerate(features):
                if standard_deviations[column_index] <= 0:
                    continue
                score = (matrix[row_index, column_index] - means[column_index]) / standard_deviations[column_index]
                if abs(score) >= z_score_threshold:
                    flags[row_index].append(_feature_detail(feature, matrix[row_index, column_index], means[column_index], score, "zscore"))
                    count += 1
        model_results.append({"name": "Z_SCORE", "version": "zscore-1.0.0", "status": "completed", "flaggedFeatureValues": count})

    if "isolation_forest" in selected_methods:
        if IsolationForest is None:
            model_results.append({"name": "ISOLATION_FOREST", "version": "isolation-forest-1.0.0", "status": "unavailable"})
        elif len(records) < 20:
            model_results.append(
                {
                    "name": "ISOLATION_FOREST",
                    "version": "isolation-forest-1.0.0",
                    "status": "insufficient_data",
                    "minimumRequired": 20,
                    "available": len(records),
                }
            )
        else:
            forest = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
            labels = forest.fit_predict(matrix)
            decision_scores = forest.decision_function(matrix)
            center = np.median(matrix, axis=0)
            spread = np.std(matrix, axis=0)
            count = 0
            for row_index, label in enumerate(labels):
                if label != -1:
                    continue
                column_index = int(np.argmax(np.abs((matrix[row_index] - center) / np.where(spread > 0, spread, 1))))
                feature = features[column_index]
                score = -float(decision_scores[row_index])
                flags[row_index].append(_feature_detail(feature, matrix[row_index, column_index], center[column_index], score, "isolation_forest"))
                count += 1
            model_results.append({"name": "ISOLATION_FOREST", "version": "isolation-forest-1.0.0", "status": "completed", "flaggedRecords": count})

    anomalies: list[dict[str, Any]] = []
    for row_index, details in flags.items():
        unique_methods = sorted({detail["method"] for detail in details})
        sorted_details = sorted(details, key=lambda detail: abs(float(detail.get("zScore", detail.get("deviation", 0.0)))), reverse=True)
        anomaly_score = min(1.0, 0.25 * len(unique_methods) + 0.15 * min(len(sorted_details), 3))
        record = records[row_index]
        anomalies.append(
            {
                "caseId": case_identifier(record, row_index),
                "anomalyScore": round(anomaly_score, 3),
                "modelName": "ENSEMBLE" if len(unique_methods) > 1 else unique_methods[0].upper(),
                "modelVersion": model_version or MODEL_VERSION,
                "methods": unique_methods,
                "topContributingFeatures": sorted_details[:5],
                "recordCount": len(records),
                "trainingPeriod": period_for(records),
                "dataFreshness": period_for(records).get("end"),
                "humanReviewStatus": "PENDING_REVIEW",
                "explanation": "The record differs from its peer distribution on the listed operational features. This is a review signal, not evidence of criminal activity.",
            }
        )
    anomalies.sort(key=lambda item: (-item["anomalyScore"], item["caseId"]))
    return {
        "status": "ok",
        "anomalies": anomalies[:maximum_anomalies],
        "recordCount": len(records),
        "featureCount": len(features),
        "features": features,
        "models": model_results,
        "trainingPeriod": period_for(records),
        "dataFreshness": period_for(records).get("end"),
        "modelVersion": model_version or MODEL_VERSION,
        "excludedFeatures": ["caste", "religion", "gender", "age", "date_of_birth"],
        "limitations": [
            "An anomaly is a statistical deviation in the supplied data, not proof of criminal activity.",
            "Isolation Forest is skipped until at least 20 records are available; IQR and Z-score remain deterministic fallbacks.",
        ],
        "humanReviewRequired": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }
