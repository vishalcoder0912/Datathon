"""Deterministic, explainable modus-operandi similarity scoring."""

from __future__ import annotations

import re
from typing import Any

from .common import PROTOTYPE_DISCLAIMER, case_identifier, clamp, stable_identifier, value_for

MODEL_VERSION = "mo-similarity-structured-trigram-1.0.0"

FEATURES: dict[str, tuple[tuple[str, ...], float, str]] = {
    "entry_method": (("entry_method", "entryMethod"), 0.16, "Both incidents used {value} entry."),
    "weapon_type": (("weapon_type", "weaponType"), 0.10, "Both incidents recorded {value} as the weapon type."),
    "target_type": (("target_type", "targetType"), 0.16, "Both incidents targeted {value}."),
    "vehicle_used": (("vehicle_used", "vehicleUsed"), 0.09, "Both incidents used {value}."),
    "time_pattern": (("time_pattern", "timePattern"), 0.14, "Both incidents occurred in the {value} pattern."),
    "victim_selection_pattern": (("victim_selection_pattern", "victimSelectionPattern"), 0.10, "Both incidents share the same victim-selection pattern."),
    "communication_method": (("communication_method", "communicationMethod"), 0.08, "Both incidents used the same communication method."),
    "escape_method": (("escape_method", "escapeMethod"), 0.09, "Both incidents share the same escape method."),
    "property_targeted": (("property_targeted", "propertyTargeted"), 0.08, "Both incidents targeted the same property type."),
}


def _normalise(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value).strip().casefold())
    return text or None


def _feature_map(record: dict[str, Any]) -> dict[str, str]:
    mo = value_for(record, "modus_operandi", "modusOperandi", default={})
    source = mo if isinstance(mo, dict) else record
    extracted: dict[str, str] = {}
    for name, (aliases, _weight, _template) in FEATURES.items():
        value = _normalise(value_for(source, *aliases)) or _normalise(value_for(record, *aliases))
        if value:
            extracted[name] = value
    return extracted


def _text(record: dict[str, Any]) -> str:
    value = value_for(record, "mo_text", "moText", "modus_operandi_text", "modusOperandiText", "brief_facts", "briefFacts", "modus_operandi")
    if isinstance(value, dict):
        value = value.get("mo_text") or value.get("moText")
    return _normalise(value) or ""


def _trigrams(text: str) -> set[str]:
    compact = re.sub(r"[^a-z0-9]+", " ", text)
    padded = f"  {compact}  "
    return {padded[index : index + 3] for index in range(max(0, len(padded) - 2))}


def _trigram_similarity(first: str, second: str) -> float | None:
    if not first or not second:
        return None
    left = _trigrams(first)
    right = _trigrams(second)
    if not left and not right:
        return None
    return len(left & right) / max(len(left | right), 1)


def _structured_similarity(target: dict[str, str], candidate: dict[str, str]) -> tuple[float | None, list[str], list[str]]:
    denominator = 0.0
    numerator = 0.0
    matched: list[str] = []
    evidence: list[str] = []
    for feature, (_aliases, weight, template) in FEATURES.items():
        target_value = target.get(feature)
        candidate_value = candidate.get(feature)
        if target_value or candidate_value:
            denominator += weight
        if target_value and candidate_value and target_value == candidate_value:
            numerator += weight
            matched.append(feature)
            evidence.append(template.format(value=target_value.replace("_", " ")))
    return (numerator / denominator if denominator else None), matched, evidence


def find_similar_modus_operandi(
    cases: list[dict[str, Any]],
    *,
    target_case_id: str | int | None,
    target_case: dict[str, Any] | None,
    minimum_similarity: float,
    maximum_results: int,
    use_embeddings: bool,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Compare structured features and local trigram text; never sends data to a remote model."""

    target: dict[str, Any] | None = target_case
    requested_id = str(target_case_id) if target_case_id is not None else None
    if target is None and requested_id is not None:
        target = next((case for index, case in enumerate(cases) if case_identifier(case, index) == requested_id), None)
    if target is None and cases:
        target = cases[0]
    if target is None or len(cases) < 2:
        return {
            "status": "insufficient_data",
            "minimumRequired": 2,
            "available": len(cases),
            "reason": "A target case and at least one candidate case are required for MO comparison.",
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    target_id = case_identifier(target, 0)
    target_features = _feature_map(target)
    target_text = _text(target)
    comparisons: list[dict[str, Any]] = []
    for index, candidate in enumerate(cases):
        candidate_id = case_identifier(candidate, index)
        if candidate is target or candidate_id == target_id:
            continue
        structured_score, matched_features, evidence = _structured_similarity(target_features, _feature_map(candidate))
        trigram_score = _trigram_similarity(target_text, _text(candidate))
        if structured_score is None and trigram_score is None:
            continue
        if structured_score is None:
            score = trigram_score or 0.0
        elif trigram_score is None:
            score = structured_score
        else:
            score = 0.7 * structured_score + 0.3 * trigram_score
        if score < minimum_similarity:
            continue
        if trigram_score is not None and trigram_score >= 0.45:
            evidence.append("The normalized modus-operandi narrative has a high character-trigram overlap.")
        if not evidence:
            evidence.append("The cases share partial structured modus-operandi characteristics and should be reviewed by an investigator.")
        comparisons.append(
            {
                "caseId": candidate_id,
                "similarityScore": round(clamp(score), 3),
                "matchedFeatures": matched_features,
                "evidence": evidence,
                "componentScores": {
                    "structuredWeightedJaccard": round(structured_score, 3) if structured_score is not None else None,
                    "trigramTextSimilarity": round(trigram_score, 3) if trigram_score is not None else None,
                    "embeddingCosineSimilarity": None,
                },
                "algorithm": "structured_weighted_jaccard_plus_trigram",
                "modelVersion": model_version or MODEL_VERSION,
                "humanReviewStatus": "PENDING_REVIEW",
            }
        )
    comparisons.sort(key=lambda item: (-item["similarityScore"], item["caseId"]))
    return {
        "status": "ok",
        "targetCaseId": target_id,
        "similarCases": comparisons[:maximum_results],
        "candidateCount": max(0, len(cases) - 1),
        "recordCount": len(cases),
        "algorithm": "structured_weighted_jaccard_plus_trigram",
        "modelVersion": model_version or MODEL_VERSION,
        "embeddingUsed": False,
        "embeddingStatus": "not_requested" if not use_embeddings else "not_available_without_a_preinstalled_local_model",
        "limitations": [
            "Similarity measures case-pattern overlap in supplied structured fields and text; it does not establish that people or cases are linked.",
            "The deterministic trigram fallback is used unless a separately installed local embedding model is explicitly integrated by the operator.",
        ],
        "humanReviewRequired": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }
