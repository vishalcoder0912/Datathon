from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Tuple

from dateutil import parser as date_parser


def normalize_column_name(name: Any, index: int = 0) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "_", str(name or "").strip().lower()).strip("_")
    if not value or value in {"none", "nan", "unnamed"}:
        value = f"column_{index + 1}"
    if value[0].isdigit():
        value = f"column_{value}"
    return value


def normalize_column_names(columns: List[Any]) -> List[str]:
    seen: Dict[str, int] = {}
    result: List[str] = []
    for index, column in enumerate(columns):
        base = normalize_column_name(column, index)
        count = seen.get(base, 0)
        seen[base] = count + 1
        result.append(base if count == 0 else f"{base}_{count + 1}")
    return result


def repair_common_ocr_errors(value: Any) -> Tuple[Any, List[Dict[str, Any]]]:
    text = "" if value is None else str(value).strip()
    repairs: List[Dict[str, Any]] = []
    if re.search(r"[\d₹$,.%]", text) and re.search(r"[OoIl]", text):
        cleaned = text.translate(str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1"}))
        if cleaned != text:
            repairs.append(
                {
                    "originalValue": text,
                    "cleanedValue": cleaned,
                    "repairType": "ocr_numeric_correction",
                    "confidence": 0.72,
                }
            )
            return cleaned, repairs
    return value, repairs


def normalize_cell_value(value: Any) -> Tuple[Any, List[Dict[str, Any]]]:
    repaired, repairs = repair_common_ocr_errors(value)
    text = "" if repaired is None else str(repaired).strip()
    if text == "":
        return None, repairs

    currency = bool(re.search(r"[₹$€£]", text))
    percent = text.endswith("%")
    numeric_text = re.sub(r"[₹$€£,%\s]", "", text)
    if re.fullmatch(r"[-+]?\d+(\.\d+)?", numeric_text):
        number: Any = float(numeric_text) if "." in numeric_text else int(numeric_text)
        if percent:
            return number / 100, repairs + [{"originalValue": text, "cleanedValue": number / 100, "repairType": "percentage_normalization", "confidence": 0.9}]
        if currency:
            return number, repairs + [{"originalValue": text, "cleanedValue": number, "repairType": "currency_normalization", "confidence": 0.86}]
        return number, repairs

    try:
        if re.search(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}", text):
            parsed = date_parser.parse(text, fuzzy=True)
            if 1900 <= parsed.year <= 2100:
                return parsed.date().isoformat(), repairs + [{"originalValue": text, "cleanedValue": parsed.date().isoformat(), "repairType": "date_normalization", "confidence": 0.8}]
    except Exception:
        pass

    return text, repairs


def remove_empty_rows_columns(rows: List[List[Any]]) -> List[List[Any]]:
    rows = [row for row in rows if any(str(cell or "").strip() for cell in row)]
    if not rows:
        return rows
    width = max(len(row) for row in rows)
    padded = [row + [""] * (width - len(row)) for row in rows]
    keep_indexes = [index for index in range(width) if any(str(row[index] or "").strip() for row in padded)]
    return [[row[index] for index in keep_indexes] for row in padded]


def infer_header_row(rows: List[List[Any]]) -> int:
    for index, row in enumerate(rows[:5]):
        non_empty = [cell for cell in row if str(cell or "").strip()]
        textish = sum(1 for cell in non_empty if re.search(r"[A-Za-z]", str(cell)))
        if non_empty and textish / max(len(non_empty), 1) >= 0.5:
            return index
    return 0


def remove_repeated_headers(rows: List[List[Any]], header: List[str]) -> List[List[Any]]:
    normalized_header = [normalize_column_name(cell, index) for index, cell in enumerate(header)]
    cleaned: List[List[Any]] = []
    for row in rows:
        normalized_row = [normalize_column_name(cell, index) for index, cell in enumerate(row[: len(header)])]
        if normalized_row == normalized_header:
            continue
        cleaned.append(row)
    return cleaned


def remove_footer_noise(rows: List[List[Any]]) -> List[List[Any]]:
    footer_pattern = re.compile(r"^(page\s+\d+|total pages?|confidential|generated on)", re.I)
    return [row for row in rows if not footer_pattern.search(" ".join(str(cell or "") for cell in row).strip())]


def detect_total_rows(rows: List[Dict[str, Any]]) -> List[int]:
    indexes: List[int] = []
    for index, row in enumerate(rows):
        joined = " ".join(str(value or "") for value in row.values()).lower()
        if re.search(r"\b(total|subtotal|grand total)\b", joined):
            indexes.append(index)
    return indexes


def detect_column_types(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    types: Dict[str, str] = {}
    for column in rows[0].keys() if rows else []:
        values = [row.get(column) for row in rows if row.get(column) is not None]
        if not values:
            types[column] = "unknown"
        elif sum(isinstance(value, (int, float)) for value in values) / len(values) >= 0.65:
            types[column] = "number"
        elif sum(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value))) for value in values) / len(values) >= 0.65:
            types[column] = "date"
        else:
            types[column] = "string"
    return types


def detect_low_quality_columns(rows: List[Dict[str, Any]]) -> List[str]:
    low_quality: List[str] = []
    for column in rows[0].keys() if rows else []:
        values = [row.get(column) for row in rows]
        empty_ratio = sum(value in (None, "") for value in values) / max(len(values), 1)
        if empty_ratio > 0.6:
            low_quality.append(column)
    return low_quality


def repair_shifted_rows_if_safe(rows: List[List[Any]], width: int) -> List[List[Any]]:
    repaired: List[List[Any]] = []
    for row in rows:
        if len(row) == width:
            repaired.append(row)
        elif len(row) < width:
            repaired.append(row + [None] * (width - len(row)))
        else:
            repaired.append(row[: width - 1] + [" ".join(str(cell) for cell in row[width - 1 :])])
    return repaired


def infer_table_schema(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    detected = detect_column_types(rows)
    return {
        "columns": [
            {
                "name": column,
                "type": dtype,
                "semanticType": "currency" if re.search(r"(revenue|amount|price|cost|profit|salary)", column, re.I) else dtype,
                "confidence": 0.82 if dtype != "unknown" else 0.35,
            }
            for column, dtype in detected.items()
        ]
    }


def create_clean_table_preview(rows: List[Dict[str, Any]], limit: int = 25) -> List[Dict[str, Any]]:
    return rows[:limit]


def clean_extracted_table(table: Dict[str, Any]) -> Dict[str, Any]:
    raw_rows = table.get("rawRows") or []
    rows = remove_empty_rows_columns([list(row) if isinstance(row, (list, tuple)) else list((row or {}).values()) for row in raw_rows])
    rows = remove_footer_noise(rows)
    if not rows:
        return {**table, "cleanedColumns": [], "cleanedRows": [], "schema": {"columns": []}, "quality": {"score": 0.0, "issues": ["No usable rows"], "repairCount": 0}}

    header_index = infer_header_row(rows)
    header = rows[header_index]
    data_rows = remove_repeated_headers(rows[header_index + 1 :], header)
    columns = normalize_column_names(header)
    data_rows = repair_shifted_rows_if_safe(data_rows, len(columns))

    cleaned_rows: List[Dict[str, Any]] = []
    repair_metadata: List[Dict[str, Any]] = []
    for row_index, row in enumerate(data_rows):
        item: Dict[str, Any] = {}
        for column_index, column in enumerate(columns):
            cleaned_value, repairs = normalize_cell_value(row[column_index] if column_index < len(row) else None)
            item[column] = cleaned_value
            for repair in repairs:
                repair_metadata.append({"rowIndex": row_index, "column": column, **repair})
        if any(value is not None for value in item.values()):
            cleaned_rows.append(item)

    low_quality = detect_low_quality_columns(cleaned_rows)
    total_rows = detect_total_rows(cleaned_rows)
    schema = infer_table_schema(cleaned_rows)
    issues = []
    if low_quality:
        issues.append(f"Low quality columns: {', '.join(low_quality[:5])}")
    if total_rows:
        issues.append("Total/subtotal rows detected and preserved")
    score = max(0.2, min(0.95, float(table.get("confidence", 0.65)) - 0.04 * len(issues)))

    return {
        **table,
        "cleanedColumns": columns,
        "cleanedRows": cleaned_rows,
        "schema": schema,
        "quality": {"score": round(score, 3), "issues": issues, "repairCount": len(repair_metadata), "lowQualityColumns": low_quality},
        "repairMetadata": repair_metadata[:500],
        "preview": create_clean_table_preview(cleaned_rows),
    }

