"""SQLite metadata and audit ownership for CIAP application state."""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from typing import Any

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    masked_uri TEXT NOT NULL,
    status TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_records (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def initialise_state() -> None:
    with closing(sqlite3.connect(settings.state_database)) as connection:
        connection.executescript(SCHEMA)
        connection.commit()


def record_audit(action: str, metadata: dict[str, Any] | None = None, actor: str = "local-user") -> None:
    """Persist non-sensitive operation metadata; request bodies and credentials are forbidden."""

    safe_metadata = {
        key: value
        for key, value in (metadata or {}).items()
        if key.casefold() not in {"credentials", "secret", "password", "token", "connection_string"}
    }
    with closing(sqlite3.connect(settings.state_database)) as connection:
        connection.execute(
            "INSERT INTO audit_records(action, actor, metadata_json, created_at) VALUES (?, ?, ?, ?)",
            (action, actor, json.dumps(safe_metadata, default=str), datetime.now(UTC).isoformat()),
        )
        connection.commit()


initialise_state()
