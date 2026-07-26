from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List


STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "are",
    "was",
    "were",
    "you",
    "your",
    "into",
    "about",
    "page",
    "pdf",
    "document",
}


def _sentences(text: str, limit: int = 4) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", str(text or "").strip())
    return [part.strip() for part in parts if len(part.strip()) >= 30][:limit]


def _keywords(text: str, limit: int = 12) -> List[str]:
    words = [word.lower() for word in re.findall(r"\b[A-Za-z][A-Za-z0-9-]{3,}\b", text or "")]
    counts = Counter(word for word in words if word not in STOPWORDS)
    return [word for word, _count in counts.most_common(limit)]


def _headings(text: str, limit: int = 8) -> List[str]:
    headings: List[str] = []
    for line in str(text or "").splitlines():
        value = line.strip(" :-\t")
        if not value or len(value) > 110:
            continue
        word_count = len(value.split())
        uppercase_ratio = sum(ch.isupper() for ch in value) / max(sum(ch.isalpha() for ch in value), 1)
        if word_count <= 12 and (uppercase_ratio >= 0.55 or re.match(r"^(\d+\.|chapter|section|module|part)\b", value, re.I)):
            headings.append(value)
    seen: set[str] = set()
    unique = []
    for heading in headings:
        key = heading.lower()
        if key not in seen:
            seen.add(key)
            unique.append(heading)
    return unique[:limit]


def summarize_page(page: Dict[str, Any]) -> Dict[str, Any]:
    text = page.get("cleanedText") or page.get("mergedText") or page.get("text") or ""
    sentences = _sentences(text, 3)
    keywords = _keywords(text)
    headings = _headings(text)
    summary = " ".join(sentences)
    if not summary and keywords:
        summary = f"Page {page.get('pageNumber')} contains content about {', '.join(keywords[:6])}."
    if not summary:
        summary = f"Page {page.get('pageNumber')} had little extractable text."
    return {
        "summary": summary[:1600],
        "keywords": keywords,
        "headings": headings,
    }


def build_sections(pages: List[Dict[str, Any]], batch_size: int = 10) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []
    current: List[Dict[str, Any]] = []
    current_title = "Opening Pages"

    for page in pages:
        headings = page.get("pageHeadings") or []
        if headings and current and len(current) >= 2:
            sections.append(_section_from_pages(current_title, current))
            current = []
            current_title = headings[0]
        elif headings and not current:
            current_title = headings[0]
        current.append(page)
        if len(current) >= batch_size:
            sections.append(_section_from_pages(current_title, current))
            current = []
            current_title = f"Pages {int(page.get('pageNumber', 0)) + 1}-{int(page.get('pageNumber', 0)) + batch_size}"

    if current:
        sections.append(_section_from_pages(current_title, current))
    return sections


def _section_from_pages(title: str, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    start = int(pages[0].get("pageNumber") or 0)
    end = int(pages[-1].get("pageNumber") or start)
    summary_text = " ".join(str(page.get("pageSummary") or "") for page in pages)
    return {
        "sectionId": f"section_{start}_{end}",
        "title": title or f"Pages {start}-{end}",
        "startPage": start,
        "endPage": end,
        "summary": " ".join(_sentences(summary_text, 5))[:2200] or summary_text[:2200],
        "keywords": _keywords(summary_text, 15),
    }


def summarize_document(file_name: str, pages: List[Dict[str, Any]], tables: List[Dict[str, Any]], warnings: List[str]) -> Dict[str, Any]:
    page_summaries = " ".join(str(page.get("pageSummary") or "") for page in pages)
    first_page_text = pages[0].get("cleanedText") if pages else ""
    headings = []
    for page in pages:
        headings.extend(page.get("pageHeadings") or [])
    keywords = _keywords(page_summaries + " " + str(first_page_text), 20)
    title = headings[0] if headings else file_name
    short = " ".join(_sentences(page_summaries, 3)) or f"{file_name} contains {len(pages)} processed pages."
    detailed = " ".join(_sentences(page_summaries, 8)) or short
    table_points = [
        f"Table {table.get('tableId')} on page {table.get('pageNumber')} with columns {', '.join(map(str, table.get('cleanedColumns') or []))}"
        for table in tables[:12]
    ]
    return {
        "documentTitle": title,
        "documentType": "PDF document",
        "mainTopic": ", ".join(keywords[:5]) if keywords else "",
        "shortSummary": short[:1200],
        "detailedSummary": detailed[:4000],
        "keyPoints": [sentence for sentence in _sentences(page_summaries, 8)] or [f"Pages analyzed: {len(pages)}"],
        "importantPages": [
            {"pageNumber": page.get("pageNumber"), "summary": page.get("pageSummary")}
            for page in pages
            if len(str(page.get("cleanedText") or "")) > 250
        ][:10],
        "detectedSections": headings[:20],
        "detectedTables": table_points,
        "detectedCharts": [],
        "actionableInsights": [
            "Ask page-specific questions to inspect detailed content.",
            "Convert high-quality extracted tables to datasets for dashboards.",
        ],
        "extractionWarnings": warnings[:30],
    }

