"""Socioeconomic correlations logic with explicit caveats and causation warnings."""

from __future__ import annotations

from typing import Any, Dict, List
import numpy as np
from scipy.stats import pearsonr, spearmanr
from .common import district_identifier, PROTOTYPE_DISCLAIMER

CAUSATION_WARNING = "Correlation does not prove that the socioeconomic indicator caused the crime pattern."

def calculate_correlations(
    crime_records: List[Dict[str, Any]],
    indicator_records: List[Dict[str, Any]],
    filters: Dict[str, Any] = None
) -> Dict[str, Any]:
    # Group crime records by district
    crime_counts = {}
    for r in crime_records:
        dist = district_identifier(r)
        if dist:
            crime_counts[dist] = crime_counts.get(dist, 0) + 1

    # Group indicator records by district and indicator type
    indicator_values = {} # {indicator_code: {district: value}}
    indicator_names = {}
    indicator_units = {}
    
    for r in indicator_records:
        dist = district_identifier(r)
        code = r.get("indicator_code") or r.get("code")
        val = r.get("value")
        if dist and code and val is not None:
            if code not in indicator_values:
                indicator_values[code] = {}
            indicator_values[code][dist] = float(val)
            indicator_names[code] = r.get("indicator_name") or r.get("name") or code
            indicator_units[code] = r.get("unit") or ""

    results = []
    
    # For each indicator type, calculate Pearson and Spearman correlations
    for code, dist_vals in indicator_values.items():
        # Align districts
        districts = list(set(crime_counts.keys()).intersection(dist_vals.keys()))
        if len(districts) < 3:
            continue
            
        x = [dist_vals[d] for d in districts]
        y = [crime_counts[d] for d in districts]
        
        try:
            pearson_coef, pearson_p = pearsonr(x, y)
            if np.isnan(pearson_coef):
                pearson_coef, pearson_p = 0.0, 1.0
        except Exception:
            pearson_coef, pearson_p = 0.0, 1.0
            
        try:
            spearman_coef, spearman_p = spearmanr(x, y)
            if np.isnan(spearman_coef):
                spearman_coef, spearman_p = 0.0, 1.0
        except Exception:
            spearman_coef, spearman_p = 0.0, 1.0
            
        results.append({
            "indicatorCode": code,
            "indicatorName": indicator_names[code],
            "unit": indicator_units[code],
            "pearsonCorrelation": round(float(pearson_coef), 4),
            "pearsonPValue": round(float(pearson_p), 4),
            "spearmanCorrelation": round(float(spearman_coef), 4),
            "spearmanPValue": round(float(spearman_p), 4),
            "sampleSize": len(districts),
            "strength": "strong" if abs(spearman_coef) >= 0.7 else "moderate" if abs(spearman_coef) >= 0.4 else "weak",
            "direction": "positive" if spearman_coef > 0 else "negative" if spearman_coef < 0 else "none",
            "confidence": round(1.0 - min(spearman_p, 1.0), 3),
            "warning": CAUSATION_WARNING,
        })
        
    return {
        "status": "ok",
        "correlations": results,
        "warning": CAUSATION_WARNING,
        "disclaimer": PROTOTYPE_DISCLAIMER,
        "limitations": [
            "Association does not establish causation.",
            "Synthetic and proxy indicators are used for research demonstration only."
        ]
    }
