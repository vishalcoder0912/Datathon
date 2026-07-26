"""Emerging trend alerts logic using rolling averages baseline and z-score thresholds."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
import math
from typing import Any, Dict, List
from .common import incident_datetime, district_identifier, crime_category, PROTOTYPE_DISCLAIMER

def calculate_trend_alerts(
    records: List[Dict[str, Any]],
    filters: Dict[str, Any] = None,
    current_window_days: int = 30,
    baseline_window_days: int = 90,
    min_count: int = 5,
    growth_threshold: float = 30.0,
    z_threshold: float = 1.5
) -> Dict[str, Any]:
    valid_records = []
    for r in records:
        dt = incident_datetime(r)
        if dt:
            valid_records.append((dt, r))
            
    if not valid_records:
        return {"status": "insufficient_data", "alerts": []}
        
    reference = max(dt for dt, _ in valid_records)
    current_start = reference - timedelta(days=current_window_days)
    baseline_start = current_start - timedelta(days=baseline_window_days)
    
    # Aggregate crimes in current and baseline periods by (district, category)
    current_groups = {} # {(dist, cat): count}
    baseline_groups = {}
    historical_by_group = {} # {(dist, cat, year, week): count}
    
    for dt, r in valid_records:
        dist = district_identifier(r) or "UNASSIGNED"
        cat = crime_category(r) or "UNSPECIFIED"
        group_key = (dist, cat)
        
        if dt >= current_start:
            current_groups[group_key] = current_groups.get(group_key, 0) + 1
        elif dt >= baseline_start:
            baseline_groups[group_key] = baseline_groups.get(group_key, 0) + 1
            # Only include baseline weeks in historical group stats
            week_key = (dist, cat, dt.year, dt.isocalendar()[1])
            historical_by_group[week_key] = historical_by_group.get(week_key, 0) + 1

    # Format alerts
    alerts = []
    for group_key, current_count in current_groups.items():
        if current_count < min_count:
            continue
            
        dist, cat = group_key
        baseline_count = baseline_groups.get(group_key, 0)
        
        # Calculate expected count normalized to current window size
        expected = baseline_count * (current_window_days / baseline_window_days)
        if expected == 0:
            pct_increase = 100.0 if current_count > 0 else 0.0
        else:
            pct_increase = ((current_count - expected) / expected) * 100.0
            
        # Retrieve weekly history for z-score
        weekly_counts = [count for (g_dist, g_cat, _, _), count in historical_by_group.items() if g_dist == dist and g_cat == cat]
        
        # Padding historical weeks with zeros to represent inactive weeks in baseline
        total_weeks = math.ceil(baseline_window_days / 7.0)
        padding_needed = max(0, total_weeks - len(weekly_counts))
        weekly_counts.extend([0] * padding_needed)
        
        mean = sum(weekly_counts) / len(weekly_counts) if weekly_counts else 0.0
        variance = sum((x - mean) ** 2 for x in weekly_counts) / len(weekly_counts) if weekly_counts else 0.0
        std = math.sqrt(variance)
        if std == 0.0:
            std = 1.0 # fallback avoiding division by zero
            
        weekly_rate = current_count / (current_window_days / 7.0)
        z_score = (weekly_rate - mean) / std
        
        if pct_increase >= growth_threshold and z_score >= z_threshold:
            severity = "CRITICAL" if z_score >= 3.0 else "HIGH" if z_score >= 2.0 else "MEDIUM" if z_score >= 1.0 else "LOW"
            alerts.append({
                "id": f"alert-{dist}-{cat}".lower().replace(" ", "-"),
                "title": f"Emerging {cat.replace('_', ' ').title()} Spike",
                "description": f"Significant increase in {cat.replace('_', ' ')} detected in district {dist}. Crime count rose to {current_count} (expected: {expected:.1f}) with a z-score of {z_score:.2f}.",
                "district": dist,
                "crimeCategory": cat,
                "currentCount": current_count,
                "expectedCount": round(expected, 2),
                "growthRate": round(pct_increase, 2),
                "zScore": round(z_score, 2),
                "severity": severity,
                "reviewStatus": "OPEN",
                "alertType": "CRIME_SPIKE",
                "dataPeriod": f"{current_start.strftime('%Y-%m-%d')} to {reference.strftime('%Y-%m-%d')}"
            })
            
    return {
        "status": "ok",
        "alerts": sorted(alerts, key=lambda a: a["zScore"], reverse=True),
        "disclaimer": PROTOTYPE_DISCLAIMER
    }
