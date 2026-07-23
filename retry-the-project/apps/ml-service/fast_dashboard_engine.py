from __future__ import annotations

import hashlib
import json
import math
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import duckdb
import polars as pl

CACHE: Dict[str, Dict[str, Any]] = {}

METRIC_PRIORITY = [
    "revenue",
    "profit",
    "sales",
    "salary_usd",
    "orders",
    "customers",
    "patients",
    "risk_score",
    "amount",
    "price",
    "cost",
    "total",
    "count",
]

DIMENSION_PRIORITY = [
    "country",
    "state",
    "city",
    "region",
    "market",
    "category",
    "department",
    "product",
    "segment",
    "status",
]

ID_LIKE_PATTERNS = ("id", "uuid", "email", "phone")


def stable_hash(payload: Any) -> str:
    text = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def safe_identifier(name: str) -> str:
    clean = str(name or "").replace('"', '""')
    if not clean:
        raise ValueError("Column name cannot be empty")
    return f'"{clean}"'


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if hasattr(value, "item"):
        return _json_safe(value.item())
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _table_expr(file_path: str) -> str:
    escaped = str(file_path).replace("'", "''")
    suffix = Path(file_path).suffix.lower()
    if suffix == ".parquet":
        return f"read_parquet('{escaped}')"
    if suffix in {".csv", ".tsv", ".txt"}:
        return f"read_csv_auto('{escaped}', header=true, sample_size=50000)"
    raise ValueError("Unsupported file type for fast dashboard. Use Parquet or CSV.")


def prepare_dataset_file(file_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    start = time.perf_counter()
    path = Path(file_path).expanduser().resolve()
    if not path.exists() or not path.is_file():
        raise ValueError("Dataset file does not exist.")

    suffix = path.suffix.lower()
    if suffix == ".parquet":
        columns = infer_columns_from_parquet(str(path))
        return {
            "optimizedFilePath": str(path),
            "optimizedFormat": "parquet",
            "alreadyOptimized": True,
            "columns": columns,
            "durationMs": int((time.perf_counter() - start) * 1000),
        }

    if suffix not in {".csv", ".tsv", ".txt"}:
        raise ValueError("Only CSV/TSV/TXT and Parquet files can be prepared.")

    target = Path(output_path).expanduser().resolve() if output_path else path.with_suffix(".parquet")
    target.parent.mkdir(parents=True, exist_ok=True)

    df = pl.read_csv(path, infer_schema_length=50000)
    df.write_parquet(target)
    columns = infer_columns_from_parquet(str(target))

    return {
        "optimizedFilePath": str(target),
        "optimizedFormat": "parquet",
        "alreadyOptimized": False,
        "rowCount": df.height,
        "columns": columns,
        "durationMs": int((time.perf_counter() - start) * 1000),
    }


def _duckdb_type_groups(file_path: str) -> Dict[str, Any]:
    con = duckdb.connect(database=":memory:")
    try:
        table_expr = _table_expr(file_path)
        rows = con.execute(f"DESCRIBE SELECT * FROM {table_expr}").fetchall()
    finally:
        con.close()

    all_columns: List[Dict[str, Any]] = []
    numeric: List[str] = []
    categorical: List[str] = []
    dates: List[str] = []

    for row in rows:
        name = str(row[0])
        dtype = str(row[1]).upper()
        column = {"name": name, "type": dtype}
        all_columns.append(column)

        if any(token in dtype for token in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL", "HUGEINT")):
            numeric.append(name)
        elif any(token in dtype for token in ("DATE", "TIME", "TIMESTAMP")):
            dates.append(name)
        else:
            categorical.append(name)

    return {
        "all": all_columns,
        "numeric": numeric,
        "categorical": categorical,
        "dates": dates,
    }


def infer_columns_from_parquet(file_path: str) -> Dict[str, Any]:
    suffix = Path(file_path).suffix.lower()
    if suffix == ".parquet":
        try:
            schema = pl.scan_parquet(file_path).collect_schema()
            all_columns = [{"name": name, "type": str(dtype)} for name, dtype in schema.items()]
            numeric = []
            categorical = []
            dates = []
            for name, dtype in schema.items():
                if dtype.is_numeric():
                    numeric.append(name)
                elif dtype in (pl.Date, pl.Datetime, pl.Time):
                    dates.append(name)
                else:
                    categorical.append(name)
            return {"all": all_columns, "numeric": numeric, "categorical": categorical, "dates": dates}
        except Exception:
            return _duckdb_type_groups(file_path)

    return _duckdb_type_groups(file_path)


def _name_score(name: str, priority: List[str]) -> int:
    lower = name.lower()
    for index, key in enumerate(priority):
        if lower == key:
            return 1000 - index
    for index, key in enumerate(priority):
        if key in lower:
            return 500 - index
    return 0


def select_main_metric(columns: Dict[str, Any], metric_priority: Optional[List[str]] = None) -> Optional[str]:
    numeric = list(columns.get("numeric") or [])
    if not numeric:
        return None

    priority = metric_priority or METRIC_PRIORITY
    ranked = sorted(numeric, key=lambda name: (_name_score(name, priority), -numeric.index(name)), reverse=True)
    return ranked[0] if ranked else numeric[0]


def _is_id_like(name: str) -> bool:
    lower = name.lower()
    if lower in {"id", "name"}:
        return True
    return any(lower == pattern or lower.endswith(f"_{pattern}") or pattern in lower for pattern in ID_LIKE_PATTERNS)


def select_main_dimension(columns: Dict[str, Any]) -> Optional[str]:
    categorical = [name for name in list(columns.get("categorical") or []) if not _is_id_like(name)]
    if not categorical:
        return None

    ranked = sorted(categorical, key=lambda name: (_name_score(name, DIMENSION_PRIORITY), -categorical.index(name)), reverse=True)
    return ranked[0] if ranked else categorical[0]


def _scalar(con: duckdb.DuckDBPyConnection, sql: str) -> Any:
    return con.execute(sql).fetchone()[0]


def _records(con: duckdb.DuckDBPyConnection, sql: str) -> List[Dict[str, Any]]:
    names = [description[0] for description in con.execute(sql).description]
    rows = con.fetchall()
    return [dict(zip(names, row)) for row in rows]


def run_fast_dashboard(file_path: str, metric_priority: Optional[List[str]] = None, group_limit: int = 10) -> Dict[str, Any]:
    start = time.perf_counter()
    path = Path(file_path).expanduser().resolve()
    warnings: List[str] = []

    if not path.exists() or not path.is_file():
        raise ValueError("Fast dashboard file does not exist.")

    limit = max(1, min(int(group_limit or 10), 50))
    stat = path.stat()
    cache_key = stable_hash({
        "path": str(path),
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "metric_priority": metric_priority or METRIC_PRIORITY,
        "group_limit": limit,
    })

    if cache_key in CACHE:
        cached = dict(CACHE[cache_key])
        cached["cacheHit"] = True
        cached["durationMs"] = int((time.perf_counter() - start) * 1000)
        return cached

    columns = infer_columns_from_parquet(str(path))
    selected_metric = select_main_metric(columns, metric_priority)
    selected_dimension = select_main_dimension(columns)
    date_column = (columns.get("dates") or [None])[0]
    table_expr = _table_expr(str(path))

    con = duckdb.connect(database=":memory:")
    try:
        con.execute(f"SET threads TO {max(1, min(os.cpu_count() or 1, 8))}")
        row_count = int(_scalar(con, f"SELECT COUNT(*) FROM {table_expr}"))

        kpis: Dict[str, Any] = {
            "rowCount": row_count,
            "numericColumnCount": len(columns.get("numeric") or []),
            "categoricalColumnCount": len(columns.get("categorical") or []),
            "mainMetric": selected_metric,
        }

        charts: List[Dict[str, Any]] = []

        if selected_metric:
            metric_sql = safe_identifier(selected_metric)
            total, average, minimum, maximum = con.execute(
                f"""
                SELECT
                  SUM(TRY_CAST({metric_sql} AS DOUBLE)) AS total,
                  AVG(TRY_CAST({metric_sql} AS DOUBLE)) AS average,
                  MIN(TRY_CAST({metric_sql} AS DOUBLE)) AS minimum,
                  MAX(TRY_CAST({metric_sql} AS DOUBLE)) AS maximum
                FROM {table_expr}
                """
            ).fetchone()
            kpis.update({
                "mainMetricTotal": total,
                "mainMetricAverage": average,
                "mainMetricMin": minimum,
                "mainMetricMax": maximum,
            })

            if selected_dimension:
                dimension_sql = safe_identifier(selected_dimension)
                data = _records(
                    con,
                    f"""
                    SELECT
                      CAST({dimension_sql} AS VARCHAR) AS label,
                      SUM(TRY_CAST({metric_sql} AS DOUBLE)) AS value,
                      COUNT(*) AS count
                    FROM {table_expr}
                    WHERE {dimension_sql} IS NOT NULL
                    GROUP BY 1
                    ORDER BY value DESC NULLS LAST
                    LIMIT {limit}
                    """,
                )
                charts.append({
                    "title": f"Top {selected_dimension} by {selected_metric}",
                    "type": "bar",
                    "xKey": "label",
                    "yKey": "value",
                    "sourceMetric": selected_metric,
                    "sourceDimension": selected_dimension,
                    "data": data,
                })

            if date_column:
                date_sql = safe_identifier(date_column)
                data = _records(
                    con,
                    f"""
                    SELECT
                      CAST(date_trunc('month', TRY_CAST({date_sql} AS TIMESTAMP)) AS VARCHAR) AS label,
                      SUM(TRY_CAST({metric_sql} AS DOUBLE)) AS value
                    FROM {table_expr}
                    WHERE TRY_CAST({date_sql} AS TIMESTAMP) IS NOT NULL
                    GROUP BY 1
                    ORDER BY 1
                    LIMIT 60
                    """,
                )
                if data:
                    charts.append({
                        "title": f"{selected_metric} trend",
                        "type": "line",
                        "xKey": "label",
                        "yKey": "value",
                        "sourceMetric": selected_metric,
                        "sourceDate": date_column,
                        "data": data,
                    })
        else:
            warnings.append("No numeric metric column was detected; returning record-count dashboard.")

        if not selected_metric and selected_dimension:
            dimension_sql = safe_identifier(selected_dimension)
            data = _records(
                con,
                f"""
                SELECT CAST({dimension_sql} AS VARCHAR) AS label, COUNT(*) AS value
                FROM {table_expr}
                WHERE {dimension_sql} IS NOT NULL
                GROUP BY 1
                ORDER BY value DESC
                LIMIT {limit}
                """,
            )
            charts.append({
                "title": f"Top {selected_dimension} by count",
                "type": "bar",
                "xKey": "label",
                "yKey": "value",
                "sourceDimension": selected_dimension,
                "data": data,
            })

        result = _json_safe({
            "engine": "duckdb",
            "cacheHit": False,
            "rowCount": row_count,
            "columns": columns,
            "selectedMetric": selected_metric,
            "selectedDimension": selected_dimension,
            "kpis": kpis,
            "charts": charts,
            "warnings": warnings,
            "durationMs": int((time.perf_counter() - start) * 1000),
        })
        CACHE[cache_key] = result
        return result
    finally:
        con.close()
