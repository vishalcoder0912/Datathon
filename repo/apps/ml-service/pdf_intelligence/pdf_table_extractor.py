from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any, Dict, List

try:
    import pdfplumber
except Exception:  # pragma: no cover
    pdfplumber = None


def _table_id(file_path: str, page_number: int, table_index: int) -> str:
    stem = hashlib.sha1(str(Path(file_path).resolve()).encode("utf-8")).hexdigest()[:12]
    return f"pdf_{stem}_page_{page_number}_table_{table_index}"


def extract_tables_from_digital_pdf(file_path: str) -> List[Dict[str, Any]]:
    if pdfplumber is None:
        return []

    tables: List[Dict[str, Any]] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_index, page in enumerate(pdf.pages, start=1):
                for table_index, table in enumerate(page.extract_tables() or [], start=1):
                    rows = [[cell if cell is not None else "" for cell in row] for row in table if row]
                    if not rows:
                        continue
                    tables.append(
                        {
                            "tableId": _table_id(file_path, page_index, table_index),
                            "pageNumber": page_index,
                            "extractionMethod": "pdfplumber",
                            "rawRows": rows,
                            "rawColumns": rows[0] if rows else [],
                            "confidence": 0.78,
                            "warnings": [],
                        }
                    )
    except Exception as error:
        return [
            {
                "tableId": _table_id(file_path, 0, 0),
                "pageNumber": 0,
                "extractionMethod": "pdfplumber",
                "rawRows": [],
                "rawColumns": [],
                "confidence": 0.0,
                "warnings": [f"Digital table extraction failed: {error}"],
            }
        ]
    return tables


def _looks_like_table_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return "\t" in stripped or stripped.count("  ") >= 2 or stripped.count("|") >= 2 or len(re.findall(r"\d+[,.]?\d*", stripped)) >= 2


def _split_table_line(line: str) -> List[str]:
    if "|" in line:
        return [cell.strip() for cell in line.strip("|").split("|")]
    if "\t" in line:
        return [cell.strip() for cell in line.split("\t")]
    return [cell.strip() for cell in re.split(r"\s{2,}", line.strip()) if cell.strip()]


def extract_tables_from_ocr_text(ocr_pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    tables: List[Dict[str, Any]] = []
    for page in ocr_pages:
        candidates = [_split_table_line(line) for line in str(page.get("text", "")).splitlines() if _looks_like_table_line(line)]
        candidates = [row for row in candidates if len(row) >= 2]
        if len(candidates) < 2:
            continue
        page_number = int(page.get("pageNumber") or 0)
        tables.append(
            {
                "tableId": f"ocr_page_{page_number}_table_1",
                "pageNumber": page_number,
                "extractionMethod": "ocr_text_heuristic",
                "rawRows": candidates,
                "rawColumns": candidates[0],
                "confidence": min(float(page.get("confidence", 0.45)), 0.62),
                "warnings": ["Table inferred from OCR text; column alignment may be uncertain"],
            }
        )
    return tables


def extract_tables_hybrid(file_path: str, extracted_pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    digital_tables = extract_tables_from_digital_pdf(file_path)
    ocr_pages = [page for page in extracted_pages if page.get("method", "").startswith("ocr")]
    ocr_tables = extract_tables_from_ocr_text(ocr_pages)
    return digital_tables + ocr_tables

