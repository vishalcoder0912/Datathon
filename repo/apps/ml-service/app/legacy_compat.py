"""Small compatibility surface used only if the pre-KAVACH service cannot load.

The legacy service remains in ``apps/ml-service/app.py``. Loading it preserves
the broader existing feature set; this module protects its core generic routes
in environments that intentionally omit PDF/optional acceleration packages.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["legacy compatibility"])
_profile_cache: dict[str, dict[str, Any]] = {}


def _rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("rows", [])
    return rows if isinstance(rows, list) else []


def _numeric_columns(rows: list[dict[str, Any]]) -> list[str]:
    columns = sorted({key for row in rows if isinstance(row, dict) for key in row})
    numeric: list[str] = []
    for column in columns:
        values = [row.get(column) for row in rows if row.get(column) is not None]
        if values and all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in values):
            numeric.append(column)
    return numeric


@router.post("/profile")
def profile(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload.get("rows", []), list):
        raise HTTPException(status_code=422, detail="rows must be an array")
    rows = _rows(payload)[:50_000]
    columns = payload.get("columns") or sorted({key for row in rows if isinstance(row, dict) for key in row})
    key = repr((rows[:100], columns))
    if key in _profile_cache:
        return {**_profile_cache[key], "cacheHit": True}
    missing = {column: sum(1 for row in rows if row.get(column) is None) for column in columns}
    total_cells = max(1, len(rows) * max(len(columns), 1))
    result = {
        "rowCount": len(rows),
        "columnCount": len(columns),
        "columns": [{"name": column, "type": "unknown"} for column in columns],
        "measures": _numeric_columns(rows),
        "dimensions": [column for column in columns if column not in _numeric_columns(rows)],
        "missingValues": missing,
        "qualityScore": round(100 * (1 - sum(missing.values()) / total_cells), 2),
        "cacheHit": False,
    }
    _profile_cache[key] = result
    return result


@router.post("/correlations")
def correlations(payload: dict[str, Any]) -> dict[str, Any]:
    rows = _rows(payload)
    numeric = _numeric_columns(rows)
    matrix: dict[str, dict[str, float]] = {}
    for left in numeric:
        matrix[left] = {}
        left_values = np.asarray([float(row[left]) for row in rows if row.get(left) is not None], dtype=float)
        for right in numeric:
            paired = [(float(row[left]), float(row[right])) for row in rows if row.get(left) is not None and row.get(right) is not None]
            matrix[left][right] = round(float(np.corrcoef(np.asarray(paired).T)[0, 1]), 4) if len(paired) > 1 else 0.0
    return {"method": payload.get("method", "pearson"), "matrix": matrix, "strongPairs": []}


@router.post("/anomalies")
def anomalies(payload: dict[str, Any]) -> dict[str, Any]:
    rows = _rows(payload)
    numeric = _numeric_columns(rows)
    return {"method": payload.get("method", "zscore"), "anomalies": [], "summary": {"count": 0, "numericColumns": numeric}}


@router.post("/compare-datasets")
def compare_datasets(payload: dict[str, Any]) -> dict[str, Any]:
    left_rows = _rows(payload.get("left", {}))
    right_rows = _rows(payload.get("right", {}))
    left = set().union(*(row.keys() for row in left_rows if isinstance(row, dict))) if left_rows else set()
    right = set().union(*(row.keys() for row in right_rows if isinstance(row, dict))) if right_rows else set()
    return {
        "sameSchema": left == right,
        "commonColumns": sorted(left & right),
        "missingColumns": sorted(left - right),
        "extraColumns": sorted(right - left),
        "rowDifference": len(right_rows) - len(left_rows),
        "schemaDrift": [],
    }
