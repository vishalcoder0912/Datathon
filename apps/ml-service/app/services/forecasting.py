"""Crime-count forecasting with deterministic baseline fallbacks."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    from statsmodels.tsa.statespace.sarimax import SARIMAX
except Exception:  # pragma: no cover - baseline remains available in slim installs
    ExponentialSmoothing = None
    SARIMAX = None


MODEL_VERSION = "ciap-forecast-1.0.0"
GROUP_FIELDS = {
    "district": ("district",),
    "police_station": ("police_station", "policeStation", "station"),
    "crime_category": ("crime_category", "crimeCategory", "category"),
}


def _value(record: dict[str, Any], aliases: tuple[str, ...], default: Any = None) -> Any:
    for alias in aliases:
        value = record.get(alias)
        if value not in (None, ""):
            return value
    return default


def _series(records: list[dict[str, Any]], group_by: str) -> dict[str, pd.Series]:
    if group_by not in GROUP_FIELDS:
        raise ValueError("group_by must be district, police_station or crime_category")
    rows: list[dict[str, Any]] = []
    for record in records:
        timestamp = _value(record, ("timestamp", "occurred_at", "occurredAt", "incidentAt"))
        parsed = pd.to_datetime(timestamp, utc=True, errors="coerce")
        if pd.isna(parsed):
            continue
        rows.append(
            {
                "date": parsed.floor("D").tz_localize(None),
                "group": str(_value(record, GROUP_FIELDS[group_by], "UNKNOWN")),
                "count": float(_value(record, ("incident_count", "incidentCount", "crime_count", "crimeCount"), 1)),
            }
        )
    if not rows:
        return {}
    frame = pd.DataFrame(rows)
    output: dict[str, pd.Series] = {}
    for group, values in frame.groupby("group"):
        daily = values.groupby("date")["count"].sum().sort_index()
        output[str(group)] = daily.asfreq("D", fill_value=0.0)
    return output


def _predict(series: pd.Series, periods: int) -> tuple[np.ndarray, str, float]:
    values = series.to_numpy(dtype=float)
    if len(values) < 7 or ExponentialSmoothing is None:
        prediction = np.repeat(float(np.mean(values[-7:])) if len(values) else 0.0, periods)
        return prediction, "rolling_mean_baseline", float(np.std(values)) if len(values) > 1 else 0.0
    try:
        if len(values) >= 28 and SARIMAX is not None:
            model = SARIMAX(values, order=(1, 0, 1), seasonal_order=(1, 0, 0, 7), trend="c", enforce_stationarity=False, enforce_invertibility=False)
            fitted = model.fit(disp=False, maxiter=100)
            prediction = np.asarray(fitted.forecast(periods), dtype=float)
            residuals = np.asarray(fitted.resid, dtype=float)
            return prediction, "SARIMAX", float(np.std(residuals))
        model = ExponentialSmoothing(values, trend="add", seasonal=None, initialization_method="estimated")
        fitted = model.fit(optimized=True)
        prediction = np.asarray(fitted.forecast(periods), dtype=float)
        residuals = np.asarray(values - fitted.fittedvalues, dtype=float)
        return prediction, "ExponentialSmoothing", float(np.std(residuals))
    except Exception:
        prediction = np.repeat(float(np.mean(values[-7:])), periods)
        return prediction, "rolling_mean_baseline", float(np.std(values[-7:]))


def forecast_crime_counts(records: list[dict[str, Any]], group_by: str, periods: int = 7) -> dict[str, Any]:
    forecasts: list[dict[str, Any]] = []
    observed: list[dict[str, Any]] = []
    models: set[str] = set()
    for group, series in _series(records, group_by).items():
        prediction, model_name, residual_std = _predict(series, periods)
        models.add(model_name)
        observed.extend({"group": group, "date": index.date().isoformat(), "count": float(value)} for index, value in series.items())
        for offset, value in enumerate(prediction, start=1):
            forecast_date = (series.index.max() + timedelta(days=offset)).date().isoformat()
            center = max(0.0, float(value))
            margin = 1.96 * max(residual_std, 0.0)
            forecasts.append(
                {
                    "group": group,
                    "forecast_date": forecast_date,
                    "predicted_count": round(center, 3),
                    "lower_bound": round(max(0.0, center - margin), 3),
                    "upper_bound": round(center + margin, 3),
                    "model_name": model_name,
                    "model_version": MODEL_VERSION,
                    "training_window": {"start": series.index.min().date().isoformat(), "end": series.index.max().date().isoformat(), "observations": len(series)},
                }
            )
    return {
        "status": "ok" if forecasts else "insufficient_data",
        "group_by": group_by,
        "observed": observed,
        "forecast": forecasts,
        "models": sorted(models),
        "human_review_required": True,
        "limitation": "Forecasts estimate aggregate counts and must not be used to predict individual guilt or recommend enforcement action.",
    }
