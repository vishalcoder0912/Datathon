"""Deterministic regional crime-count spike detection."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from typing import Any

import numpy as np

try:
    from sklearn.ensemble import IsolationForest
except Exception:  # pragma: no cover - z-score remains available in slim installs
    IsolationForest = None


def detect_regional_anomalies(
    records: list[dict[str, Any]],
    methods: Sequence[str],
    z_threshold: float = 2.0,
    contamination: float = 0.1,
) -> list[dict[str, Any]]:
    """Return advisory alerts for aggregate counts, never person-level predictions."""

    grouped: dict[tuple[str, str], list[tuple[int, dict[str, Any]]]] = defaultdict(list)
    for index, record in enumerate(records):
        region = str(record.get("region") or record.get("district") or "UNKNOWN")
        category = str(record.get("crime_category") or record.get("crimeCategory") or "ALL")
        grouped[(region, category)].append((index, record))

    alerts: list[dict[str, Any]] = []
    for (region, category), entries in sorted(grouped.items()):
        counts = np.asarray([float(item.get("crime_count", item.get("crimeCount", 0))) for _, item in entries], dtype=float)
        expected = float(np.mean(counts)) if len(counts) else 0.0
        deviation = float(np.std(counts)) if len(counts) else 0.0
        method_scores: dict[int, list[tuple[str, float, str]]] = defaultdict(list)

        if "zscore" in methods and deviation > 0:
            for position, score in enumerate((counts - expected) / deviation):
                if score >= z_threshold:
                    method_scores[position].append(("zscore", float(score), f"Count exceeds the regional mean by {score:.2f} standard deviations."))

        if "isolation_forest" in methods and IsolationForest is not None and len(counts) >= 8:
            model = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
            labels = model.fit_predict(counts.reshape(-1, 1))
            scores = -model.decision_function(counts.reshape(-1, 1))
            for position, label in enumerate(labels):
                if label == -1 and counts[position] > expected:
                    method_scores[position].append(("isolation_forest", float(scores[position]), "Isolation Forest marked this aggregate count as an unusual high value."))

        for position, signals in method_scores.items():
            _, record = entries[position]
            observed = float(counts[position])
            for method, score, reason in signals:
                alerts.append(
                    {
                        "region": region,
                        "timestamp": str(record.get("timestamp") or record.get("occurred_at") or ""),
                        "crime_category": category,
                        "observed_count": observed,
                        "expected_count": round(expected, 3),
                        "anomaly_score": round(score, 4),
                        "method": method,
                        "reason": reason,
                        "alert_level": "critical" if observed >= max(expected * 2, expected + 10) else "high",
                        "human_review_required": True,
                    }
                )
    alerts.sort(key=lambda item: (-float(item["anomaly_score"]), str(item["region"]), str(item["timestamp"])))
    return alerts
