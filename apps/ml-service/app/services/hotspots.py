"""Explainable spatial hotspot discovery with a deterministic DBSCAN fallback."""

from __future__ import annotations

import math
from collections import Counter
from types import SimpleNamespace
from typing import Any

import numpy as np

try:  # scikit-learn is preferred, but an offline deterministic fallback exists.
    from sklearn.cluster import DBSCAN
except Exception:  # pragma: no cover - exercised only in intentionally slim installs
    DBSCAN = None

from .common import (
    EARTH_RADIUS_METERS,
    PROTOTYPE_DISCLAIMER,
    apply_filters,
    case_identifier,
    clamp,
    coordinates,
    crime_category,
    daypart_for,
    haversine_meters,
    incident_datetime,
    iso_datetime,
    period_for,
    rolling_windows,
    safe_counter,
    select_reference_time,
    severity_label,
    severity_weight,
    stable_identifier,
)

MODEL_VERSION = "hotspot-dbscan-1.0.0"


def _filters_without_dates(filters: Any) -> SimpleNamespace:
    return SimpleNamespace(
        date_from=None,
        date_to=None,
        district_id=getattr(filters, "district_id", None),
        station_id=getattr(filters, "station_id", None),
        crime_head_id=getattr(filters, "crime_head_id", None),
        crime_sub_head_id=getattr(filters, "crime_sub_head_id", None),
        status=getattr(filters, "status", None),
        severity=getattr(filters, "severity", None),
        daypart=getattr(filters, "daypart", None),
    )


def _fallback_labels(points: list[tuple[float, float]], radius_meters: float, minimum_incidents: int) -> list[int]:
    """Density-connected components used only when sklearn is unavailable."""

    neighbors: list[list[int]] = [[] for _ in points]
    for index, point in enumerate(points):
        for candidate_index in range(index, len(points)):
            if haversine_meters(point, points[candidate_index]) <= radius_meters:
                neighbors[index].append(candidate_index)
                if candidate_index != index:
                    neighbors[candidate_index].append(index)
    labels = [-1] * len(points)
    cluster = 0
    for index, adjacent in enumerate(neighbors):
        if labels[index] != -1 or len(adjacent) < minimum_incidents:
            continue
        labels[index] = cluster
        stack = list(adjacent)
        while stack:
            node = stack.pop()
            if labels[node] == -1:
                labels[node] = cluster
                if len(neighbors[node]) >= minimum_incidents:
                    stack.extend(neighbors[node])
        cluster += 1
    return labels


def _labels(points: list[tuple[float, float]], radius_meters: float, minimum_incidents: int) -> tuple[list[int], str]:
    if DBSCAN is None:
        return _fallback_labels(points, radius_meters, minimum_incidents), "density_connected_components_fallback"
    radians = np.radians(np.asarray(points, dtype=float))
    classifier = DBSCAN(
        eps=radius_meters / EARTH_RADIUS_METERS,
        min_samples=minimum_incidents,
        metric="haversine",
        algorithm="ball_tree",
    )
    return classifier.fit_predict(radians).tolist(), "DBSCAN_haversine"


def _circle_boundary(latitude: float, longitude: float, radius_meters: float) -> dict[str, Any]:
    """A compact GeoJSON ring that remains useful without Shapely/PostGIS."""

    angular_lat = radius_meters / 111_320.0
    longitude_divisor = max(111_320.0 * math.cos(math.radians(latitude)), 1.0)
    angular_lon = radius_meters / longitude_divisor
    ring: list[list[float]] = []
    for step in range(13):
        theta = 2 * math.pi * step / 12
        ring.append([round(longitude + angular_lon * math.cos(theta), 7), round(latitude + angular_lat * math.sin(theta), 7)])
    return {"type": "Polygon", "coordinates": [ring]}


def _cluster_trend(
    centroid: tuple[float, float],
    candidates: list[dict[str, Any]],
    radius_meters: float,
    reference_time,
) -> tuple[int, float, float]:
    baseline_start, current_start, _ = rolling_windows(reference_time, current_days=7, baseline_days=28)
    current_count = 0
    baseline_count = 0
    for record in candidates:
        point = coordinates(record)
        timestamp = incident_datetime(record)
        if point is None or timestamp is None or haversine_meters(centroid, point) > radius_meters:
            continue
        if timestamp >= current_start:
            current_count += 1
        elif baseline_start <= timestamp < current_start:
            baseline_count += 1
    baseline_average = baseline_count / 4.0
    if baseline_average == 0:
        trend_percentage = 100.0 if current_count else 0.0
    else:
        trend_percentage = ((current_count - baseline_average) / baseline_average) * 100.0
    return current_count, baseline_average, trend_percentage


def detect_hotspots(
    records: list[dict[str, Any]],
    *,
    filters: Any,
    radius_meters: float,
    minimum_incidents: int,
    maximum_hotspots: int,
    crime_category_value: str | None,
    reference_time=None,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Return cluster-level evidence without exposing raw person information."""

    selected = apply_filters(records, filters, crime_category_value)
    spatial_records = [(record, coordinates(record)) for record in selected]
    spatial_records = [(record, point) for record, point in spatial_records if point is not None]
    source_record_count = len(selected)
    if len(spatial_records) < minimum_incidents:
        return {
            "status": "insufficient_data",
            "minimumRequired": minimum_incidents,
            "available": len(spatial_records),
            "recordCount": source_record_count,
            "reason": "At least the requested number of incidents with valid latitude and longitude is required.",
            "algorithm": "DBSCAN_haversine",
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    points = [point for _, point in spatial_records]
    labels, algorithm = _labels(points, radius_meters, minimum_incidents)
    clusters: dict[int, list[tuple[dict[str, Any], tuple[float, float]]]] = {}
    for index, label in enumerate(labels):
        if label >= 0:
            clusters.setdefault(int(label), []).append(spatial_records[index])

    if not clusters:
        return {
            "status": "no_hotspots",
            "recordCount": source_record_count,
            "minimumRequired": minimum_incidents,
            "radiusMeters": radius_meters,
            "algorithm": algorithm,
            "modelVersion": model_version or MODEL_VERSION,
            "limitations": ["No density-connected cluster met the configured threshold."],
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    baseline_candidates = apply_filters(records, _filters_without_dates(filters), crime_category_value)
    reference = select_reference_time(records, reference_time)
    output: list[dict[str, Any]] = []
    maximum_cluster_size = max(len(cluster) for cluster in clusters.values())
    for label, members in clusters.items():
        latitudes = [point[0] for _, point in members]
        longitudes = [point[1] for _, point in members]
        centroid = (sum(latitudes) / len(latitudes), sum(longitudes) / len(longitudes))
        categories = safe_counter(crime_category(record) for record, _ in members)
        dominant_category = max(categories, key=categories.get) if categories else "UNSPECIFIED"
        severity_distribution = safe_counter(severity_label(record) for record, _ in members)
        daypart_distribution = safe_counter(daypart_for(record) for record, _ in members)
        current_count, baseline_average, trend_percentage = _cluster_trend(
            centroid, baseline_candidates, radius_meters, reference
        )
        serious_ratio = sum(1 for record, _ in members if severity_weight(record) >= 3.0) / len(members)
        density_component = len(members) / maximum_cluster_size
        trend_component = clamp(max(trend_percentage, 0.0) / 100.0)
        risk_score = round(100 * (0.5 * density_component + 0.3 * serious_ratio + 0.2 * trend_component), 2)
        confidence = round(clamp(0.35 + 0.12 * math.sqrt(len(members)) + 0.15 * serious_ratio, 0.0, 0.95), 3)
        evidence = [
            f"{len(members)} incidents form a density-connected cluster within {round(radius_meters)} metres.",
            f"{dominant_category} is the dominant category ({categories.get(dominant_category, 0)} incidents).",
            f"The recent seven-day count is {current_count}; the four-week baseline average is {round(baseline_average, 2)}.",
        ]
        output.append(
            {
                "hotspotId": stable_identifier("hotspot", label, round(centroid[0], 5), round(centroid[1], 5), dominant_category),
                "centroid": {"latitude": round(centroid[0], 6), "longitude": round(centroid[1], 6)},
                "boundary": _circle_boundary(centroid[0], centroid[1], radius_meters),
                "incidentCount": len(members),
                "crimeCategories": categories,
                "dominantCategory": dominant_category,
                "severityDistribution": severity_distribution,
                "daypartDistribution": daypart_distribution,
                "trendPercentage": round(trend_percentage, 2),
                "baselineCount": round(baseline_average, 2),
                "riskScore": risk_score,
                "confidence": confidence,
                "dataPeriod": period_for(record for record, _ in members),
                "evidence": evidence,
                "sourceCaseIds": [case_identifier(record, index) for index, (record, _) in enumerate(members)],
                "algorithm": algorithm,
                "modelVersion": model_version or MODEL_VERSION,
                "humanReviewStatus": "PENDING_REVIEW",
            }
        )
    output.sort(key=lambda item: (-item["riskScore"], -item["incidentCount"], item["hotspotId"]))
    output = output[:maximum_hotspots]
    return {
        "status": "ok",
        "hotspots": output,
        "recordCount": source_record_count,
        "spatialRecordCount": len(spatial_records),
        "radiusMeters": radius_meters,
        "minimumIncidents": minimum_incidents,
        "dataPeriod": period_for(selected),
        "algorithm": algorithm,
        "modelVersion": model_version or MODEL_VERSION,
        "limitations": [
            "A hotspot indicates spatial concentration in the supplied records, not proof of causation or individual wrongdoing.",
            "Results are sensitive to coordinate quality, the selected period, radius, and minimum-incidents threshold.",
        ],
        "humanReviewRequired": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }
