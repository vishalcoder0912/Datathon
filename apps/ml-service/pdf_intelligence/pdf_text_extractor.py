from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

try:
    import fitz
except Exception:  # pragma: no cover
    fitz = None


def _open_pdf(file_path: str):
    if fitz is None:
        raise RuntimeError("PyMuPDF is not installed")
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError("PDF file not found")
    return fitz.open(path)


def extract_page_text(file_path: str, page_number: int) -> Dict[str, Any]:
    with _open_pdf(file_path) as document:
        if page_number < 1 or page_number > len(document):
            raise ValueError("page_number is outside PDF page range")
        page = document[page_number - 1]
        text = page.get_text("text") or ""
        return {
            "pageNumber": page_number,
            "method": "pymupdf_text",
            "text": text,
            "charCount": len(text.strip()),
            "wordCount": len(text.split()),
            "warnings": [] if text.strip() else ["No embedded text found on page"],
        }


def extract_digital_text(file_path: str) -> Dict[str, Any]:
    pages: List[Dict[str, Any]] = []
    with _open_pdf(file_path) as document:
        for index in range(1, len(document) + 1):
            pages.append(extract_page_text(file_path, index))
    return {"pageCount": len(pages), "pages": pages, "text": "\n\n".join(page["text"] for page in pages)}


def extract_layout_blocks(file_path: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    with _open_pdf(file_path) as document:
        for page_index, page in enumerate(document, start=1):
            for block_index, block in enumerate(page.get_text("blocks") or [], start=1):
                text = str(block[4] or "").strip() if len(block) > 4 else ""
                if not text:
                    continue
                blocks.append(
                    {
                        "pageNumber": page_index,
                        "blockId": f"page_{page_index}_block_{block_index}",
                        "bbox": [float(block[0]), float(block[1]), float(block[2]), float(block[3])],
                        "text": text,
                    }
                )
    return blocks

