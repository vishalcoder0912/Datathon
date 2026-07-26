from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from .messy_table_cleaner import clean_extracted_table
from .messy_text_cleaner import normalize_ocr_text, remove_repeated_headers_footers
from .pdf_chunker import create_pdf_chunks
from .pdf_detector import detect_pdf_page_modes
from .pdf_ocr_engine import run_ocr_for_page
from .pdf_summarizer import build_sections, summarize_document, summarize_page
from .pdf_table_extractor import extract_tables_hybrid
from .pdf_text_extractor import extract_page_text


def _document_id(file_path: str) -> str:
    path = Path(file_path)
    stat = path.stat()
    seed = f"{path.resolve()}:{stat.st_mtime_ns}:{stat.st_size}"
    return f"pdf_{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:16]}"


def _document_type(modes: List[str]) -> str:
    if not modes:
        return "empty_pdf"
    if all(mode in {"scanned_image", "low_confidence", "empty"} for mode in modes):
        return "scanned_pdf"
    if any(mode in {"scanned_image", "mixed", "low_confidence"} for mode in modes):
        return "mixed_pdf"
    if any(mode == "table_heavy" for mode in modes):
        return "table_pdf"
    return "digital_text_pdf"


def _summary(file_name: str, pages: List[Dict[str, Any]], tables: List[Dict[str, Any]], warnings: List[str]) -> Dict[str, Any]:
    text_preview = " ".join(page.get("text", "") for page in pages)[:900]
    return {
        "short": f"{file_name} contains {len(pages)} pages and {len(tables)} detected tables. {text_preview}".strip(),
        "keyPoints": [
            f"Pages analyzed: {len(pages)}",
            f"Tables detected: {len(tables)}",
            f"Extraction warnings: {len(warnings)}",
        ],
        "extractionWarnings": warnings[:20],
    }


def analyze_pdf(file_path: str, document_id: Optional[str] = None, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    options = options or {}
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError("PDF file not found")
    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported")

    max_pages = int(options.get("max_pages") or os.getenv("PDF_MAX_PAGES", "2000"))
    render_dpi = int(os.getenv("PDF_OCR_RENDER_DPI", os.getenv("PDF_RENDER_DPI", "250")))
    ocr_enabled = bool(options.get("ocr_enabled", True))
    force_ocr = bool(options.get("force_ocr", False))
    extract_tables = bool(options.get("extract_tables", True))
    document_id = document_id or _document_id(file_path)

    detection = detect_pdf_page_modes(file_path)
    page_infos = detection.get("pages", [])[:max_pages]
    warnings: List[str] = []
    pages: List[Dict[str, Any]] = []
    ocr_confidences: List[float] = []

    for page_info in page_infos:
        page_number = int(page_info.get("pageNumber"))
        page_warnings = list(page_info.get("warnings", []))
        embedded_result = extract_page_text(file_path, page_number)
        raw_embedded_text = embedded_result.get("text", "")
        ocr_result: Dict[str, Any] = {}
        raw_ocr_text = ""

        should_ocr = force_ocr or bool(page_info.get("needsOCR"))
        if should_ocr and ocr_enabled:
            ocr_result = run_ocr_for_page(file_path, page_number, dpi=render_dpi)
            raw_ocr_text = ocr_result.get("text", "")
            ocr_confidences.append(float(ocr_result.get("confidence", 0)))
        elif should_ocr and not ocr_enabled:
            page_warnings.append("OCR was recommended but disabled")

        merged_text = "\n\n".join(part for part in [raw_embedded_text, raw_ocr_text] if str(part).strip())
        normalized = normalize_ocr_text(merged_text or raw_embedded_text or raw_ocr_text)
        cleaned_text = normalized["text"]
        if normalized.get("corruption", {}).get("isRisky"):
            page_warnings.append("Text contains OCR-like corruption; repairs were applied conservatively")
        if force_ocr and not raw_ocr_text:
            page_warnings.append("Forced OCR was requested but no OCR text was produced")

        method = (
            "embedded_plus_ocr"
            if raw_embedded_text.strip() and raw_ocr_text.strip()
            else ocr_result.get("method")
            if raw_ocr_text.strip()
            else embedded_result.get("method")
        )
        confidence_values = [float(page_info.get("confidence", 0.75))]
        if ocr_result:
            confidence_values.append(float(ocr_result.get("confidence", 0)))
        page_confidence = round(sum(confidence_values) / len(confidence_values), 3)

        page_result = {
            "pageNumber": page_number,
            "method": method,
            "extractionMethod": method,
            "rawEmbeddedText": raw_embedded_text,
            "rawOcrText": raw_ocr_text,
            "mergedText": merged_text,
            "cleanedText": cleaned_text,
            "text": cleaned_text,
            "charCount": len(cleaned_text),
            "wordCount": len(cleaned_text.split()),
            "ocrConfidence": ocr_result.get("confidence"),
            "confidence": page_confidence,
            "ocrRepairs": normalized.get("repairs", []),
            "ocrCorruption": normalized.get("corruption", {}),
            "boxes": ocr_result.get("boxes", []),
            "warnings": [],
        }
        page_summary = summarize_page(page_result)
        page_result["pageSummary"] = page_summary["summary"]
        page_result["pageKeywords"] = page_summary["keywords"]
        page_result["pageHeadings"] = page_summary["headings"]

        page_result.update(
            {
                "mode": page_info.get("mode"),
                "imageCount": page_info.get("imageCount", 0),
                "needsOCR": page_info.get("needsOCR", False),
                "warnings": sorted(set(page_warnings + page_result.get("warnings", []))),
            }
        )
        if page_result.get("warnings"):
            warnings.extend(f"Page {page_number}: {warning}" for warning in page_result["warnings"])
        pages.append(page_result)

    cleaned_without_repeated = remove_repeated_headers_footers([page.get("cleanedText", "") for page in pages])
    for page, cleaned in zip(pages, cleaned_without_repeated):
        if cleaned and cleaned != page.get("cleanedText"):
            page["cleanedText"] = cleaned
            page["text"] = cleaned
            page_summary = summarize_page(page)
            page["pageSummary"] = page_summary["summary"]
            page["pageKeywords"] = page_summary["keywords"]
            page["pageHeadings"] = page_summary["headings"]

    raw_tables = extract_tables_hybrid(file_path, pages) if extract_tables else []
    tables = [clean_extracted_table(table) for table in raw_tables if table.get("rawRows")]
    table_confidences = [float(table.get("quality", {}).get("score", table.get("confidence", 0))) for table in tables]
    table_warnings = [warning for table in tables for warning in table.get("warnings", []) + table.get("quality", {}).get("issues", [])]
    warnings.extend(table_warnings)
    for table in tables:
        columns = table.get("cleanedColumns") or []
        preview = table.get("preview") or table.get("cleanedRows", [])[:5]
        joined_preview = " ".join(str(row) for row in preview)
        numeric_columns = [
            column
            for column in table.get("schema", {}).get("columns", [])
            if column.get("type") in {"number", "date"} or column.get("semanticType") in {"currency", "number", "date"}
        ]
        one_col_text_like = len(columns) <= 1 and len(joined_preview) > 120
        real_data_table = len(columns) >= 2 and len(table.get("cleanedRows") or []) >= 2 and not one_col_text_like
        table["summary"] = (
            f"Table {table.get('tableId')} on page {table.get('pageNumber')} has {len(table.get('cleanedRows') or [])} rows "
            f"and columns {', '.join(map(str, columns)) or 'unknown'}."
        )
        table["tableType"] = "text_block_table" if one_col_text_like else "real_data_table" if real_data_table else "weak_table"
        table["usableForDataset"] = bool(real_data_table)
        table["usableForAnalytics"] = bool(real_data_table and numeric_columns)
        table["usableForDashboard"] = bool(real_data_table and (numeric_columns or len(table.get("cleanedRows") or []) >= 3))
        table["usableForVisualization"] = bool(table["usableForDashboard"])
        if one_col_text_like:
            table.setdefault("warnings", []).append("One-column extraction looks like narrative/visual text; indexed as text as well as table metadata")

    modes = [str(page.get("mode")) for page in page_infos]
    average_ocr_confidence = round(sum(ocr_confidences) / len(ocr_confidences), 3) if ocr_confidences else None
    table_confidence = round(sum(table_confidences) / len(table_confidences), 3) if table_confidences else None
    overall_score_parts = [float(page.get("confidence", 0.6)) for page in pages]
    if table_confidence is not None:
        overall_score_parts.append(table_confidence)
    quality_score = round(sum(overall_score_parts) / len(overall_score_parts), 3) if overall_score_parts else 0.0

    sections = build_sections(pages, batch_size=int(os.getenv("PDF_SECTION_BATCH_SIZE", "10")))
    document_summary = summarize_document(path.name, pages, tables, warnings)
    summary = {
        **_summary(path.name, pages, tables, warnings),
        **document_summary,
        "short": document_summary.get("shortSummary"),
        "long": document_summary.get("detailedSummary"),
    }
    result = {
        "documentId": document_id,
        "fileName": path.name,
        "filePath": str(path.resolve()),
        "pageCount": detection.get("pageCount", 0),
        "documentType": _document_type(modes),
        "extractionSummary": {
            "digitalPages": sum(1 for mode in modes if mode in {"digital_text", "table_heavy"}),
            "ocrPages": len(ocr_confidences),
            "tableCount": len(tables),
            "averageOCRConfidence": average_ocr_confidence,
            "warnings": sorted(set(warnings))[:50],
        },
        "pages": pages,
        "tables": tables,
        "sections": sections,
        "cleanedText": "\n\n".join(page.get("text", "") for page in pages),
        "summary": summary,
        "quality": {
            "overallScore": quality_score,
            "ocrConfidence": average_ocr_confidence,
            "tableConfidence": table_confidence,
            "warnings": sorted(set(warnings))[:50],
        },
    }
    result["chunks"] = create_pdf_chunks(result)
    return result
