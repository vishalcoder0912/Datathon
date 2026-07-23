from __future__ import annotations

import hashlib
import os
from typing import Any, Dict, List


def _chunk_text(text: str, size: int, overlap: int) -> List[str]:
    clean = " ".join(str(text or "").split())
    if not clean:
        return []
    chunks: List[str] = []
    step = max(1, size - overlap)
    for start in range(0, len(clean), step):
        chunk = clean[start : start + size]
        if chunk:
            chunks.append(chunk)
        if start + size >= len(clean):
            break
    return chunks


def create_page_chunks(pages: List[Dict[str, Any]], document_id: str | None = None) -> List[Dict[str, Any]]:
    size = int(os.getenv("PDF_CHUNK_SIZE", "1200"))
    overlap = int(os.getenv("PDF_CHUNK_OVERLAP", "150"))
    chunks: List[Dict[str, Any]] = []
    for page in pages:
        page_number = int(page.get("pageNumber") or 0)
        source = page.get("method") or page.get("extractionMethod") or "unknown"
        page_summary = page.get("pageSummary")
        if page_summary:
            chunks.append(
                {
                    "chunkId": f"{document_id or 'pdf'}_page_{page_number}_summary",
                    "documentId": document_id,
                    "pageNumber": page_number,
                    "type": "page_summary",
                    "chunkType": "page_summary",
                    "text": page_summary,
                    "metadata": {
                        "source": "page_summary",
                        "confidence": page.get("confidence", 0.75),
                        "pageNumber": page_number,
                        "keywords": page.get("pageKeywords", []),
                        "headings": page.get("pageHeadings", []),
                        "warnings": page.get("warnings", []),
                    },
                }
            )
        if page_number == 1 and (page.get("cleanedText") or page.get("text")):
            chunks.append(
                {
                    "chunkId": f"{document_id or 'pdf'}_title_page",
                    "documentId": document_id,
                    "pageNumber": page_number,
                    "type": "title_page",
                    "chunkType": "title_page",
                    "text": str(page.get("cleanedText") or page.get("text"))[:1800],
                    "metadata": {"source": source, "confidence": page.get("confidence", 0.75), "pageNumber": page_number},
                }
            )
        if page.get("rawOcrText"):
            chunks.append(
                {
                    "chunkId": f"{document_id or 'pdf'}_page_{page_number}_visual_text",
                    "documentId": document_id,
                    "pageNumber": page_number,
                    "type": "visual_text",
                    "chunkType": "visual_text",
                    "text": str(page.get("rawOcrText"))[:1800],
                    "metadata": {
                        "source": "ocr_visual_text",
                        "confidence": page.get("ocrConfidence", page.get("confidence", 0.6)),
                        "pageNumber": page_number,
                        "warnings": page.get("warnings", []),
                    },
                }
            )
        for index, text in enumerate(_chunk_text(page.get("cleanedText") or page.get("text", ""), size, overlap), start=1):
            chunk_id = f"{document_id or 'pdf'}_page_{page_number}_chunk_{index}"
            chunks.append(
                {
                    "chunkId": chunk_id,
                    "documentId": document_id,
                    "pageNumber": page_number,
                    "type": "page_text",
                    "chunkType": "page_text",
                    "text": text,
                    "metadata": {
                        "source": source,
                        "confidence": page.get("confidence", 0.75),
                        "pageNumber": page_number,
                        "warnings": page.get("warnings", []),
                    },
                }
            )
    return chunks


def create_table_chunks(tables: List[Dict[str, Any]], document_id: str | None = None) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []
    for table in tables:
        columns = table.get("cleanedColumns") or table.get("rawColumns") or []
        preview = table.get("preview") or table.get("cleanedRows", [])[:5] or table.get("rawRows", [])[:5]
        text = table.get("summary") or f"Table {table.get('tableId')} on page {table.get('pageNumber')} has columns {columns}. Preview rows: {preview}"
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
        chunks.append(
            {
                "chunkId": f"{document_id or 'pdf'}_table_{digest}",
                "documentId": document_id,
                "pageNumber": table.get("pageNumber"),
                "type": "table_summary",
                "chunkType": "table_summary",
                "text": text[:1800],
                "metadata": {
                    "source": table.get("extractionMethod"),
                    "confidence": table.get("quality", {}).get("score", table.get("confidence", 0.6)),
                    "pageNumber": table.get("pageNumber"),
                    "tableId": table.get("tableId"),
                    "columns": columns,
                    "usableForDashboard": table.get("usableForDashboard"),
                    "warnings": table.get("warnings", []) + table.get("quality", {}).get("issues", []),
                },
            }
        )
        if len(columns) <= 1 and preview:
            chunks.append(
                {
                    "chunkId": f"{document_id or 'pdf'}_table_text_{digest}",
                    "documentId": document_id,
                    "pageNumber": table.get("pageNumber"),
                    "type": "visual_text",
                    "chunkType": "visual_text",
                    "text": " ".join(str(row) for row in preview)[:1800],
                    "metadata": {
                        "source": "one_column_table_text",
                        "confidence": table.get("quality", {}).get("score", table.get("confidence", 0.5)),
                        "pageNumber": table.get("pageNumber"),
                        "tableId": table.get("tableId"),
                        "warnings": ["One-column table indexed as text"],
                    },
                }
            )
    return chunks


def create_summary_chunks(summary: Dict[str, Any], document_id: str | None = None) -> List[Dict[str, Any]]:
    short = summary.get("short") or summary.get("shortSummary") or ""
    detailed = summary.get("detailedSummary") or summary.get("long") or short
    overview = (
        f"Title: {summary.get('documentTitle', '')}\n"
        f"Type: {summary.get('documentType', '')}\n"
        f"Main topic: {summary.get('mainTopic', '')}\n"
        f"Short summary: {short}\n"
        f"Key points: {summary.get('keyPoints', [])}\n"
        f"Detected sections: {summary.get('detectedSections', [])}\n"
        f"Detected tables: {summary.get('detectedTables', [])}\n"
        f"Detected charts: {summary.get('detectedCharts', [])}\n"
    ).strip()
    chunks: List[Dict[str, Any]] = []
    if overview:
        chunks.append(
            {
                "chunkId": f"{document_id or 'pdf'}_document_overview",
                "documentId": document_id,
                "pageNumber": None,
                "type": "document_overview",
                "chunkType": "document_overview",
                "text": overview[:3500],
                "metadata": {"source": "document_overview", "confidence": 0.82, "pageNumber": None},
            }
        )
    if detailed:
        chunks.append(
            {
                "chunkId": f"{document_id or 'pdf'}_document_summary",
                "documentId": document_id,
                "pageNumber": None,
                "type": "document_summary",
                "chunkType": "document_summary",
                "text": detailed[:5000],
                "metadata": {
                    "source": "full_document_summary_index",
                    "confidence": 0.82,
                    "pageNumber": None,
                    "keyPoints": summary.get("keyPoints", []),
                    "warnings": summary.get("extractionWarnings", []),
                },
            }
        )
    return chunks


def create_section_chunks(sections: List[Dict[str, Any]], document_id: str | None = None) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []
    for section in sections:
        text = f"{section.get('title')}\nPages {section.get('startPage')}-{section.get('endPage')}\n{section.get('summary')}"
        chunks.append(
            {
                "chunkId": f"{document_id or 'pdf'}_{section.get('sectionId')}",
                "documentId": document_id,
                "pageNumber": section.get("startPage"),
                "type": "section_summary",
                "chunkType": "section_summary",
                "text": text[:3000],
                "metadata": {
                    "source": "section_summary",
                    "confidence": 0.78,
                    "pageNumber": section.get("startPage"),
                    "pageRange": f"{section.get('startPage')}-{section.get('endPage')}",
                    "keywords": section.get("keywords", []),
                },
            }
        )
    return chunks


def create_pdf_chunks(document_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    document_id = document_result.get("documentId")
    return (
        create_summary_chunks(document_result.get("summary", {}), document_id)
        + create_section_chunks(document_result.get("sections", []), document_id)
        + create_page_chunks(document_result.get("pages", []), document_id)
        + create_table_chunks(document_result.get("tables", []), document_id)
    )
