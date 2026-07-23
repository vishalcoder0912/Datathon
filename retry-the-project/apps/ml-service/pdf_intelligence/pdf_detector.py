from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List

try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover - optional runtime dependency
    fitz = None

from .messy_text_cleaner import detect_ocr_corruption


def detect_page_text_quality(text: str | None) -> Dict[str, Any]:
    value = text or ""
    words = re.findall(r"\b[\w%$₹.,-]+\b", value)
    alpha_words = [word for word in words if re.search(r"[A-Za-z0-9]", word)]
    garbage_chars = len(re.findall(r"[^\w\s.,:%$₹/\-()]", value))
    char_count = len(value.strip())
    garbage_ratio = garbage_chars / max(char_count, 1)
    word_count = len(alpha_words)
    clean_word_ratio = word_count / max(len(words), 1)
    corruption = detect_ocr_corruption(value)
    confidence = 0.1

    if char_count >= 400 and word_count >= 60 and garbage_ratio < 0.08:
        confidence = 0.95
    elif char_count >= 120 and word_count >= 20 and garbage_ratio < 0.15:
        confidence = 0.78
    elif char_count >= 40 and word_count >= 8:
        confidence = 0.45

    if corruption["isRisky"]:
        confidence = min(confidence, 0.52)

    return {
        "textCharCount": char_count,
        "wordCount": word_count,
        "garbageRatio": round(garbage_ratio, 4),
        "cleanWordRatio": round(clean_word_ratio, 4),
        "ocrCorruptionScore": corruption["score"],
        "suspiciousOcrWords": corruption["suspiciousWords"],
        "confidence": round(confidence, 3),
    }


def classify_pdf_page(page_info: Dict[str, Any]) -> Dict[str, Any]:
    quality = page_info.get("quality") or {}
    text_chars = int(quality.get("textCharCount") or 0)
    word_count = int(quality.get("wordCount") or 0)
    image_count = int(page_info.get("imageCount") or 0)
    table_like_lines = int(page_info.get("tableLikeLines") or 0)
    confidence = float(quality.get("confidence") or 0)
    warnings = []
    needs_ocr = False

    if quality.get("ocrCorruptionScore", 0) >= 0.18:
        warnings.append("Embedded text has OCR/text-corruption risk")

    if text_chars < 40 or word_count < 8:
        mode = "scanned_image" if image_count else "empty"
        needs_ocr = image_count > 0
        confidence = min(confidence, 0.35)
    elif confidence < 0.55:
        mode = "low_confidence"
        needs_ocr = image_count > 0 or quality.get("ocrCorruptionScore", 0) >= 0.18
    elif image_count and text_chars > 120:
        mode = "mixed"
        needs_ocr = confidence < 0.75
    elif table_like_lines >= 4:
        mode = "table_heavy"
    else:
        mode = "digital_text"

    return {
        **page_info,
        "mode": mode,
        "needsOCR": needs_ocr,
        "confidence": round(confidence, 3),
        "warnings": warnings,
    }


def detect_pdf_page_modes(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError("PDF file not found")
    if fitz is None:
        raise RuntimeError("PyMuPDF is not installed")

    pages: List[Dict[str, Any]] = []
    try:
        with fitz.open(path) as document:
            if document.is_encrypted:
                raise RuntimeError("PDF is encrypted and cannot be processed")
            for index, page in enumerate(document, start=1):
                text = page.get_text("text") or ""
                image_count = len(page.get_images(full=True))
                table_like_lines = sum(1 for line in text.splitlines() if line.count("  ") >= 2 or "\t" in line)
                quality = detect_page_text_quality(text)
                pages.append(
                    classify_pdf_page(
                        {
                            "pageNumber": index,
                            "textCharCount": quality["textCharCount"],
                            "wordCount": quality["wordCount"],
                            "imageCount": image_count,
                            "tableLikeLines": table_like_lines,
                            "quality": quality,
                        }
                    )
                )
    except Exception as error:
        raise RuntimeError(f"PDF detection failed: {error}") from error

    return {"pageCount": len(pages), "pages": pages}
