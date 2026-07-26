from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import fitz
except Exception:  # pragma: no cover
    fitz = None

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None

from PIL import Image, ImageEnhance


def render_page_to_image(file_path: str, page_number: int, dpi: int = 250) -> Image.Image:
    if fitz is None:
        raise RuntimeError("PyMuPDF is not installed")
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError("PDF file not found")
    with fitz.open(path) as document:
        if page_number < 1 or page_number > len(document):
            raise ValueError("page_number is outside PDF page range")
        page = document[page_number - 1]
        pixmap = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
        return Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)


def preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    gray = image.convert("L")
    enhanced = ImageEnhance.Contrast(gray).enhance(1.6)
    if cv2 is None or np is None:
        return enhanced

    array = np.array(enhanced)
    array = cv2.fastNlMeansDenoising(array, None, 10, 7, 21)
    array = cv2.threshold(array, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    height, width = array.shape[:2]
    if max(height, width) < 1600:
        array = cv2.resize(array, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
    return Image.fromarray(array)


def run_tesseract_ocr(image: Image.Image) -> Dict[str, Any]:
    if pytesseract is None:
        return {
            "text": "",
            "confidence": 0.0,
            "wordCount": 0,
            "boxes": [],
            "warnings": ["pytesseract is not installed"],
        }
    try:
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT, config="--psm 6")
        words: List[str] = []
        confidences: List[float] = []
        boxes: List[Dict[str, Any]] = []
        for index, text in enumerate(data.get("text", [])):
            value = str(text or "").strip()
            if not value:
                continue
            conf = float(data.get("conf", ["-1"])[index])
            if conf >= 0:
                confidences.append(conf)
            words.append(value)
            boxes.append(
                {
                    "text": value,
                    "confidence": max(conf, 0) / 100,
                    "bbox": [
                        int(data.get("left", [0])[index]),
                        int(data.get("top", [0])[index]),
                        int(data.get("width", [0])[index]),
                        int(data.get("height", [0])[index]),
                    ],
                }
            )
        confidence = (sum(confidences) / len(confidences) / 100) if confidences else 0.0
        return {
            "text": " ".join(words),
            "confidence": round(confidence, 3),
            "wordCount": len(words),
            "boxes": boxes[:500],
            "warnings": [] if words else ["OCR found no readable words"],
        }
    except Exception as error:
        return {
            "text": "",
            "confidence": 0.0,
            "wordCount": 0,
            "boxes": [],
            "warnings": [f"Tesseract OCR failed: {error}"],
        }


def run_ocr_for_page(file_path: str, page_number: int, dpi: int = 250) -> Dict[str, Any]:
    warnings: List[str] = []
    image = render_page_to_image(file_path, page_number, dpi=dpi)
    processed = preprocess_image_for_ocr(image)
    result = run_tesseract_ocr(processed)
    warnings.extend(result.get("warnings", []))
    if result.get("confidence", 0) < 0.55:
        warnings.append("OCR confidence is low; extracted values may be uncertain")
    return {
        "pageNumber": page_number,
        "method": "ocr_tesseract",
        "text": result.get("text", ""),
        "confidence": result.get("confidence", 0.0),
        "wordCount": result.get("wordCount", 0),
        "boxes": result.get("boxes", []),
        "warnings": warnings,
    }


def run_ocr_for_pdf(file_path: str, pages: Optional[List[int]] = None, dpi: int = 250) -> Dict[str, Any]:
    if fitz is None:
        raise RuntimeError("PyMuPDF is not installed")
    with fitz.open(file_path) as document:
        page_numbers = pages or list(range(1, len(document) + 1))
    results = [run_ocr_for_page(file_path, page_number, dpi=dpi) for page_number in page_numbers]
    confidences = [float(page.get("confidence", 0)) for page in results if page.get("confidence") is not None]
    return {
        "pages": results,
        "averageConfidence": round(sum(confidences) / len(confidences), 3) if confidences else 0.0,
        "warnings": sorted({warning for page in results for warning in page.get("warnings", [])}),
    }

