"""Optional PostgreSQL/PostGIS access for the internal analytics service.

The Node backend normally sends authorized, scoped rows in endpoint payloads.
This module exists for controlled batch jobs and is deliberately lazy: importing
or calling the payload-based analytics endpoints never requires PostgreSQL.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover - supports a slim local analytical install
    psycopg = None
    dict_row = None


class DatabaseUnavailable(RuntimeError):
    """Raised when an optional database operation is requested without a database."""


def database_url() -> str | None:
    return os.getenv("DATABASE_URL") or None


@contextmanager
def connection() -> Iterator[Any]:
    url = database_url()
    if not url:
        raise DatabaseUnavailable("DATABASE_URL is not configured")
    if psycopg is None:
        raise DatabaseUnavailable("psycopg is not installed")
    try:
        with psycopg.connect(url, connect_timeout=2, row_factory=dict_row) as conn:
            yield conn
    except DatabaseUnavailable:
        raise
    except Exception as error:
        raise DatabaseUnavailable("PostgreSQL is unavailable") from error


def database_health() -> dict[str, Any]:
    """Return a sanitized status; never reveal a URL, credential, or server error."""

    if not database_url():
        return {"configured": False, "available": False, "postgis": False}
    if psycopg is None:
        return {"configured": True, "available": False, "postgis": False}
    try:
        with connection() as conn:
            version = conn.execute("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis").fetchone()
            return {"configured": True, "available": True, "postgis": bool(version["postgis"])}
    except DatabaseUnavailable:
        return {"configured": True, "available": False, "postgis": False}


def fetch_incident_rows(filters: dict[str, Any], *, page_size: int = 5_000) -> list[dict[str, Any]]:
    """Fetch a bounded, whitelisted incident projection using parameterized SQL.

    This is intentionally not exposed directly to browsers. Authorization and
    geographic scope must be applied by the Node backend before any batch call.
    """

    safe_page_size = max(1, min(int(page_size), 10_000))
    clauses: list[str] = []
    parameters: list[Any] = []
    allowed = {
        "districtId": "district_id",
        "stationId": "police_station_id",
        "crimeHeadId": "crime_major_head_id",
        "dateFrom": "incident_date >= %s",
        "dateTo": "incident_date <= %s",
    }
    for key, expression in allowed.items():
        value = filters.get(key)
        if value in (None, ""):
            continue
        if "%s" in expression:
            clauses.append(expression)
        else:
            clauses.append(f"{expression} = %s")
        parameters.append(value)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    query = (
        "SELECT case_master_id, fir_number, incident_date, incident_time, district_id, police_station_id, "
        "crime_type, severity, latitude, longitude, modus_operandi "
        "FROM analytics.v_incidents"
        f"{where} ORDER BY incident_date DESC NULLS LAST LIMIT %s"
    )
    with connection() as conn:
        return list(conn.execute(query, [*parameters, safe_page_size]).fetchall())
