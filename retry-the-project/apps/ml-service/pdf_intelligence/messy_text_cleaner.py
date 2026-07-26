from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List


SAFE_REPLACEMENTS = {
    "0pti0n": "option",
    "0pti0ns": "options",
    "Pr0mpt": "Prompt",
    "Pr0mpts": "Prompts",
    "pr0mpt": "prompt",
    "pr0mpts": "prompts",
    "M1NUTES": "MINUTES",
    "M1NUTE": "MINUTE",
    "F10w": "Flow",
    "f10w": "flow",
    "JS0N": "JSON",
    "P0st": "Post",
    "p0st": "post",
    "Ready-t0-Use": "Ready-to-Use",
    "1N 10 M1NUTES": "IN 10 MINUTES",
}


def detect_ocr_corruption(text: str | None) -> Dict[str, Any]:
    value = text or ""
    words = re.findall(r"\b[\w-]+\b", value)
    suspicious = [
        word
        for word in words
        if re.search(r"[A-Za-z][01][A-Za-z]|[01][A-Za-z]{1,}|[A-Za-z]{2,}[01]", word)
        and not re.fullmatch(r"[A-Z]{1,4}\d{1,4}", word)
    ]
    single_chars = [word for word in words if len(word) == 1]
    broken_line_count = sum(1 for line in value.splitlines() if 0 < len(line.strip()) <= 3)
    symbol_ratio = len(re.findall(r"[^\w\s.,:%$₹€£/\-()]", value)) / max(len(value), 1)
    score = min(
        1.0,
        (len(suspicious) / max(len(words), 1) * 4.0)
        + (len(single_chars) / max(len(words), 1) * 1.2)
        + min(broken_line_count / 40, 0.25)
        + min(symbol_ratio * 2.0, 0.25),
    )
    return {
        "score": round(score, 3),
        "suspiciousWords": suspicious[:25],
        "singleCharacterWordRatio": round(len(single_chars) / max(len(words), 1), 3),
        "symbolRatio": round(symbol_ratio, 3),
        "brokenLineCount": broken_line_count,
        "isRisky": score >= 0.18 or len(suspicious) >= 3,
    }


def normalize_ocr_text(text: str | None) -> Dict[str, Any]:
    original = text or ""
    cleaned = original.replace("\r\n", "\n").replace("\r", "\n")
    repairs: List[Dict[str, Any]] = []

    for before, after in SAFE_REPLACEMENTS.items():
        if before in cleaned:
            cleaned = cleaned.replace(before, after)
            repairs.append(
                {
                    "original": before,
                    "cleaned": after,
                    "repairType": "ocr_text_normalization",
                    "confidence": 0.78,
                }
            )

    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    return {
        "text": cleaned,
        "repairs": repairs[:200],
        "corruption": detect_ocr_corruption(original),
    }


def remove_repeated_headers_footers(page_texts: List[str]) -> List[str]:
    line_counter: Counter[str] = Counter()
    normalized_pages: List[List[str]] = []
    for text in page_texts:
        lines = [line.strip() for line in str(text or "").splitlines()]
        normalized_pages.append(lines)
        candidates = [line for line in lines[:3] + lines[-3:] if 4 <= len(line) <= 120]
        line_counter.update(candidates)

    threshold = max(3, int(len(page_texts) * 0.45))
    repeated = {line for line, count in line_counter.items() if count >= threshold}
    if not repeated:
        return page_texts

    result: List[str] = []
    for lines in normalized_pages:
        result.append("\n".join(line for line in lines if line not in repeated).strip())
    return result

