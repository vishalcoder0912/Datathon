"""Runtime settings for the local CIAP analytics service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    """Validated paths and limits derived from environment variables."""

    import_root: Path
    state_database: Path
    analytics_database: Path
    maximum_request_bytes: int


def _path_setting(name: str, default: Path) -> Path:
    configured = Path(os.getenv(name, str(default))).expanduser().resolve()
    configured.parent.mkdir(parents=True, exist_ok=True)
    return configured


def get_settings() -> Settings:
    import_root = _path_setting("CIAP_IMPORT_ROOT", SERVICE_ROOT / "imports")
    import_root.mkdir(parents=True, exist_ok=True)
    maximum_request_bytes = int(os.getenv("CIAP_MAX_REQUEST_BYTES", str(5 * 1024 * 1024)))
    if maximum_request_bytes < 1_024:
        raise ValueError("CIAP_MAX_REQUEST_BYTES must be at least 1024")
    return Settings(
        import_root=import_root,
        state_database=_path_setting("CIAP_STATE_DATABASE", SERVICE_ROOT / "data" / "ciap-state.sqlite3"),
        analytics_database=_path_setting("CIAP_ANALYTICS_DATABASE", SERVICE_ROOT / "data" / "ciap-analytics.duckdb"),
        maximum_request_bytes=maximum_request_bytes,
    )


settings = get_settings()
