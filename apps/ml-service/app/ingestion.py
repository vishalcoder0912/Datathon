"""Provider-based, credential-safe crime dataset ingestion."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse

import duckdb
import fsspec
import pandas as pd

from .config import get_settings
from .state import record_audit

SUPPORTED_SUFFIXES = {".csv", ".json", ".ndjson", ".parquet"}
SECRET_KEYS = re.compile(r"(secret|password|token|key|credential|connection.?string)", re.IGNORECASE)


class IngestionError(ValueError):
    """Safe ingestion failure suitable for returning through the API."""


@dataclass
class ConnectionResult:
    provider: str
    ok: bool
    message: str


@dataclass
class IngestionResult:
    provider: str
    uri: str
    row_count: int
    columns: list[dict[str, str]]
    preview: list[dict[str, Any]]

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


class StorageProvider(Protocol):
    def test_connection(self) -> ConnectionResult: ...

    def list_objects(self, prefix: str = "") -> list[str]: ...

    def inspect_schema(self, uri: str) -> list[dict[str, str]]: ...

    def preview(self, uri: str, limit: int = 20) -> pd.DataFrame: ...

    def load(self, uri: str) -> pd.DataFrame: ...


def redact_secrets(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: "***REDACTED***" if SECRET_KEYS.search(str(key)) else redact_secrets(item) for key, item in value.items()}
    if isinstance(value, list):
        return [redact_secrets(item) for item in value]
    text = str(value)
    text = re.sub(r"(?i)(secret|password|token|key)=([^&\s]+)", r"\1=***REDACTED***", text)
    return text


def _normalise_records(frame: pd.DataFrame, limit: int = 20) -> list[dict[str, Any]]:
    clean = frame.head(limit).where(pd.notna(frame), None)
    return json.loads(clean.to_json(orient="records", date_format="iso"))


def _columns(frame: pd.DataFrame) -> list[dict[str, str]]:
    return [{"name": str(name), "type": str(dtype)} for name, dtype in frame.dtypes.items()]


def _read_frame(uri: str, storage_options: dict[str, Any] | None = None) -> pd.DataFrame:
    suffix = Path(urlparse(uri).path).suffix.casefold()
    if suffix not in SUPPORTED_SUFFIXES:
        raise IngestionError("Supported formats are CSV, JSON, NDJSON and Parquet")
    options = storage_options or {}
    if suffix == ".csv":
        return pd.read_csv(uri, storage_options=options or None)
    if suffix in {".json", ".ndjson"}:
        return pd.read_json(uri, lines=suffix == ".ndjson", storage_options=options or None)
    return pd.read_parquet(uri, storage_options=options or None)


class LocalStorageProvider:
    provider = "local"

    @staticmethod
    def _resolve(uri: str) -> Path:
        import_root = get_settings().import_root
        raw_path = urlparse(uri).path if uri.startswith("file://") else uri
        candidate = Path(raw_path)
        if not candidate.is_absolute():
            candidate = import_root / candidate
        resolved = candidate.expanduser().resolve()
        try:
            resolved.relative_to(import_root)
        except ValueError as error:
            raise IngestionError("Local imports must remain inside CIAP_IMPORT_ROOT") from error
        if resolved.suffix.casefold() not in SUPPORTED_SUFFIXES:
            raise IngestionError("Supported formats are CSV, JSON, NDJSON and Parquet")
        return resolved

    def test_connection(self) -> ConnectionResult:
        return ConnectionResult(self.provider, get_settings().import_root.is_dir(), "Local import directory is available")

    def list_objects(self, prefix: str = "") -> list[str]:
        import_root = get_settings().import_root
        return [str(path.relative_to(import_root)) for path in import_root.rglob(f"{prefix}*") if path.is_file() and path.suffix.casefold() in SUPPORTED_SUFFIXES][:500]

    def preview(self, uri: str, limit: int = 20) -> pd.DataFrame:
        return self.load(uri).head(max(1, min(limit, 100)))

    def inspect_schema(self, uri: str) -> list[dict[str, str]]:
        return _columns(self.preview(uri, 100))

    def load(self, uri: str) -> pd.DataFrame:
        path = self._resolve(uri)
        if not path.is_file():
            raise IngestionError("Import file was not found")
        if path.suffix.casefold() in {".csv", ".parquet"}:
            reader = "read_csv_auto" if path.suffix.casefold() == ".csv" else "read_parquet"
            with duckdb.connect(":memory:") as connection:
                return connection.execute(f"SELECT * FROM {reader}(?)", [str(path)]).fetch_df()
        return _read_frame(str(path))


class FsspecStorageProvider:
    protocol = ""
    provider = "cloud"

    def __init__(self, credentials: dict[str, Any] | None = None) -> None:
        self.credentials = credentials or {}

    def _filesystem(self) -> Any:
        try:
            return fsspec.filesystem(self.protocol, **self.credentials)
        except Exception as error:
            raise IngestionError(str(redact_secrets(error))) from error

    def test_connection(self) -> ConnectionResult:
        try:
            self._filesystem()
            return ConnectionResult(self.provider, True, "Provider client is available")
        except IngestionError as error:
            return ConnectionResult(self.provider, False, str(error))

    def list_objects(self, prefix: str = "") -> list[str]:
        try:
            return [str(item) for item in self._filesystem().find(prefix)[:500]]
        except Exception as error:
            raise IngestionError(str(redact_secrets(error))) from error

    def preview(self, uri: str, limit: int = 20) -> pd.DataFrame:
        return self.load(uri).head(max(1, min(limit, 100)))

    def inspect_schema(self, uri: str) -> list[dict[str, str]]:
        return _columns(self.preview(uri, 100))

    def load(self, uri: str) -> pd.DataFrame:
        try:
            return _read_frame(uri, self.credentials)
        except IngestionError:
            raise
        except Exception as error:
            raise IngestionError(str(redact_secrets(error))) from error


class S3StorageProvider(FsspecStorageProvider):
    protocol = "s3"
    provider = "s3"


class GCSStorageProvider(FsspecStorageProvider):
    protocol = "gcs"
    provider = "gcs"


class AzureBlobStorageProvider(FsspecStorageProvider):
    protocol = "az"
    provider = "azure"


def provider_for(uri: str, credentials: dict[str, Any] | None = None) -> StorageProvider:
    scheme = urlparse(uri).scheme.casefold()
    if scheme in {"", "file"}:
        return LocalStorageProvider()
    providers: dict[str, type[FsspecStorageProvider]] = {
        "s3": S3StorageProvider,
        "gs": GCSStorageProvider,
        "gcs": GCSStorageProvider,
        "az": AzureBlobStorageProvider,
        "abfs": AzureBlobStorageProvider,
    }
    provider_type = providers.get(scheme)
    if provider_type is None:
        raise IngestionError("Unsupported URI scheme")
    return provider_type(credentials)


def fetch_cloud_data(uri: str, credentials: dict[str, Any] | None = None, limit: int = 20) -> IngestionResult:
    provider = provider_for(uri, credentials)
    frame = provider.load(uri)
    result = IngestionResult(
        provider=getattr(provider, "provider", "unknown"),
        uri=uri if not urlparse(uri).query else uri.split("?", 1)[0],
        row_count=len(frame),
        columns=_columns(frame),
        preview=_normalise_records(frame, limit),
    )
    record_audit("dataset_ingested", {"provider": result.provider, "row_count": result.row_count})
    return result
