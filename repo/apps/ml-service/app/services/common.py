"""Small, dependency-light normalization helpers shared by analytics modules."""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable


PROTOTYPE_DISCLAIMER = (
    "Prototype using synthetic data. All intelligence outputs require human verification "
    "and must not be used as the sole basis for law-enforcement action."
)

PROTECTED_ATTRIBUTE_TOKENS = (
    "caste",
    "religion",
    "gender",
    "sex",
    "ethnicity",
    "race",
    "nationality",
    "date_of_birth",
    "dob",
)

EARTH_RADIUS_METERS = 6_371_008.8


def _normalise_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def value_for(record: dict[str, Any], *aliases: str, default: Any = None) -> Any:
    """Find a value using case/underscore/camelCase-insensitive aliases."""

    direct = {_normalise_key(str(key)): value for key, value in record.items()}
    for alias in aliases:
        value = direct.get(_normalise_key(alias))
        if value not in (None, ""):
            return value
    return default


def as_identifier(value: Any, default: str | None = None) -> str | None:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def as_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        converted = float(value)
    except (TypeError, ValueError):
        return None
    return converted if math.isfinite(converted) else None


def as_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if hasattr(value, "to_pydatetime"):
        return as_datetime(value.to_pydatetime())
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y"):
            try:
                parsed = datetime.strptime(text, pattern)
                break
            except ValueError:
                parsed = None
        if parsed is None:
            return None
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def incident_datetime(record: dict[str, Any]) -> datetime | None:
    timestamp = value_for(
        record,
        "incident_from_at",
        "incidentAt",
        "incident_datetime",
        "incidentDateTime",
        "occurred_at",
        "crime_registered_at",
        "registered_date",
        "registeredAt",
        "incident_date",
        "incidentDate",
    )
    result = as_datetime(timestamp)
    if result is not None:
        return result
    date_value = value_for(record, "date", "incident_date", "incidentDate")
    time_value = value_for(record, "incident_time", "incidentTime")
    if date_value and time_value:
        return as_datetime(f"{date_value}T{time_value}")
    return None


def period_for(records: Iterable[dict[str, Any]]) -> dict[str, str | None]:
    values = [incident_datetime(record) for record in records]
    datetimes = [value for value in values if value is not None]
    return {
        "start": min(datetimes).isoformat() if datetimes else None,
        "end": max(datetimes).isoformat() if datetimes else None,
    }


def select_reference_time(records: Iterable[dict[str, Any]], explicit: datetime | None = None) -> datetime:
    if explicit is not None:
        return explicit.astimezone(timezone.utc) if explicit.tzinfo else explicit.replace(tzinfo=timezone.utc)
    values = [incident_datetime(record) for record in records]
    available = [value for value in values if value is not None]
    return max(available) if available else datetime.now(timezone.utc)


def case_identifier(record: dict[str, Any], fallback_index: int | None = None) -> str:
    value = value_for(record, "case_master_id", "caseId", "case_id", "crime_no", "crimeNo", "fir_number", "firNumber", "id")
    identifier = as_identifier(value)
    return identifier or f"synthetic-case-{fallback_index or 0}"


def district_identifier(record: dict[str, Any]) -> str | None:
    return as_identifier(value_for(record, "district_id", "districtId", "district_code", "districtCode", "district"))


def station_identifier(record: dict[str, Any]) -> str | None:
    return as_identifier(
        value_for(record, "police_station_id", "policeStationId", "station_id", "stationId", "police_station", "policeStation")
    )


def crime_category(record: dict[str, Any]) -> str:
    return as_identifier(
        value_for(record, "crime_head_id", "crimeHeadId", "crime_type", "crimeType", "crime_category", "crimeCategory", "crime_major_head"),
        "UNSPECIFIED",
    ) or "UNSPECIFIED"


def crime_sub_category(record: dict[str, Any]) -> str | None:
    return as_identifier(
        value_for(record, "crime_sub_head_id", "crimeSubHeadId", "crime_sub_head", "crimeSubHead", "crime_minor_head_id")
    )


def status_value(record: dict[str, Any]) -> str | None:
    return as_identifier(value_for(record, "case_status", "caseStatus", "status"))


def severity_label(record: dict[str, Any]) -> str:
    return (as_identifier(value_for(record, "severity", "gravity_offence", "gravityOffence"), "MEDIUM") or "MEDIUM").upper()


def severity_weight(record: dict[str, Any]) -> float:
    direct = as_float(value_for(record, "severity_weight", "severityWeight", "gravity_weight", "gravityWeight"))
    if direct is not None:
        return max(0.0, min(direct, 5.0))
    return {"LOW": 1.0, "MEDIUM": 2.0, "HIGH": 3.0, "CRITICAL": 4.0, "SEVERE": 4.0}.get(severity_label(record), 2.0)


def coordinates(record: dict[str, Any]) -> tuple[float, float] | None:
    latitude = as_float(value_for(record, "latitude", "lat", "y"))
    longitude = as_float(value_for(record, "longitude", "lon", "lng", "x"))
    if latitude is None or longitude is None or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return latitude, longitude


def daypart_for(record: dict[str, Any]) -> str:
    value = as_identifier(value_for(record, "daypart"))
    if value:
        return value.upper()
    timestamp = incident_datetime(record)
    if timestamp is None:
        return "UNKNOWN"
    hour = timestamp.hour
    if 5 <= hour < 12:
        return "MORNING"
    if 12 <= hour < 17:
        return "AFTERNOON"
    if 17 <= hour < 22:
        return "EVENING"
    return "NIGHT"


def apply_filters(records: list[dict[str, Any]], filters: Any, crime_category_value: str | None = None) -> list[dict[str, Any]]:
    """Apply only whitelisted filters; records themselves remain immutable."""

    if filters is None:
        return list(records)
    date_from = as_datetime(getattr(filters, "date_from", None))
    date_to = as_datetime(getattr(filters, "date_to", None))
    district = as_identifier(getattr(filters, "district_id", None))
    station = as_identifier(getattr(filters, "station_id", None))
    crime_head = as_identifier(getattr(filters, "crime_head_id", None))
    crime_sub_head = as_identifier(getattr(filters, "crime_sub_head_id", None))
    status = as_identifier(getattr(filters, "status", None))
    severity = as_identifier(getattr(filters, "severity", None))
    daypart = as_identifier(getattr(filters, "daypart", None))
    wanted_category = as_identifier(crime_category_value)
    filtered: list[dict[str, Any]] = []
    for record in records:
        timestamp = incident_datetime(record)
        if date_from and (timestamp is None or timestamp < date_from):
            continue
        if date_to and (timestamp is None or timestamp > date_to):
            continue
        if district and district_identifier(record) != district:
            continue
        if station and station_identifier(record) != station:
            continue
        if crime_head and crime_category(record) != crime_head:
            continue
        if crime_sub_head and crime_sub_category(record) != crime_sub_head:
            continue
        if wanted_category and crime_category(record).casefold() != wanted_category.casefold():
            continue
        if status and (status_value(record) or "").casefold() != status.casefold():
            continue
        if severity and severity_label(record).casefold() != severity.casefold():
            continue
        if daypart and daypart_for(record).casefold() != daypart.casefold():
            continue
        filtered.append(record)
    return filtered


def haversine_meters(first: tuple[float, float], second: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, first)
    lat2, lon2 = map(math.radians, second)
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(a))


def stable_identifier(prefix: str, *values: Any) -> str:
    serialized = "|".join(str(value) for value in values)
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}"


def mask_person_identifier(person_id: Any) -> str:
    text = as_identifier(person_id, "unknown") or "unknown"
    suffix = re.sub(r"[^a-zA-Z0-9]", "", text)[-4:] or "----"
    return f"Person • {suffix.rjust(4, '•')}"


def extract_person_roles(record: dict[str, Any]) -> list[tuple[str, str]]:
    """Return person IDs and role labels without ever using names as identities."""

    roles: list[tuple[str, str]] = []
    raw_roles = value_for(record, "case_person_roles", "casePersonRoles", "person_roles", "personRoles", default=[])
    if isinstance(raw_roles, list):
        for item in raw_roles:
            if not isinstance(item, dict):
                continue
            identifier = as_identifier(value_for(item, "person_id", "personId", "canonical_person_id", "canonicalPersonId", "id"))
            role = as_identifier(value_for(item, "role_type", "roleType", "role"), "PERSON_OF_INTEREST")
            if identifier:
                roles.append((identifier, role.upper()))

    role_sources = {
        "ACCUSED": ("accused_ids", "accusedIds", "accused_person_ids", "accusedPersonIds"),
        "VICTIM": ("victim_ids", "victimIds", "victim_person_ids", "victimPersonIds"),
        "COMPLAINANT": ("complainant_ids", "complainantIds", "complainant_person_ids", "complainantPersonIds"),
        "ASSOCIATE": ("associate_ids", "associateIds"),
    }
    for role, aliases in role_sources.items():
        raw = value_for(record, *aliases, default=[])
        if not isinstance(raw, list):
            raw = [raw]
        for item in raw:
            if isinstance(item, dict):
                identifier = as_identifier(value_for(item, "person_id", "personId", "canonical_person_id", "canonicalPersonId", "id"))
            else:
                identifier = as_identifier(item)
            if identifier:
                roles.append((identifier, role))
    return list(dict.fromkeys(roles))


def safe_counter(values: Iterable[Any]) -> dict[str, int]:
    return dict(Counter(str(value) for value in values if value not in (None, "")))


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(value, upper))


def is_protected_feature(name: str) -> bool:
    normalised = _normalise_key(name)
    return any(_normalise_key(token) in normalised for token in PROTECTED_ATTRIBUTE_TOKENS)


def iso_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def rolling_windows(reference: datetime, current_days: int, baseline_days: int) -> tuple[datetime, datetime, datetime]:
    current_start = reference - timedelta(days=current_days)
    baseline_start = current_start - timedelta(days=baseline_days)
    return baseline_start, current_start, reference
