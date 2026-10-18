from __future__ import annotations

from typing import Dict, List


def predict_comprehensive_risk(
    status: str,
    alignment_score: float,
    drift_score: float,
    history: List[float],
    feature_coverage: float,
    diagnostics_count: int,
    area_distribution: Dict[str, int],
) -> Dict[str, object]:
    """
    Distinguishes project drift risk, code quality risk, and volatility risk.
    Returns:
    - level: 'Low' | 'Medium' | 'High'
    - message: primary summary string
    - findings: list of structured findings (severity, explanation, confidence, suggestion)
    """
    findings: List[Dict[str, object]] = []

    # 1. Trend velocity & drift trajectory
    trend = 0.0
    if len(history) >= 2:
        recent = history[-4:]
        trend = recent[-1] - recent[0]

    # Evaluate drift risk
    if status == "Danger" or alignment_score < 0.35:
        findings.append({
            "category": "drift",
            "severity": "high",
            "explanation": "Critical divergence between project implementation and declared goals.",
            "confidence": 0.90,
            "suggested_correction": "Review project requirements and re-align primary module implementations.",
        })
    elif status == "Drifting" or trend < -0.07:
        findings.append({
            "category": "drift",
            "severity": "medium",
            "explanation": "Drift score is degrading across recent revisions or missing key features.",
            "confidence": 0.75,
            "suggested_correction": "Focus next implementation pass on unfulfilled goal requirements.",
        })

    # Evaluate code quality risk
    if diagnostics_count > 0:
        findings.append({
            "category": "quality",
            "severity": "high" if diagnostics_count >= 3 else "medium",
            "explanation": f"Workspace contains {diagnostics_count} syntax error(s) preventing complete execution.",
            "confidence": 0.95,
            "suggested_correction": "Resolve syntax errors and linter issues before implementing new features.",
        })

    # Evaluate feature completeness risk
    if feature_coverage < 0.40:
        findings.append({
            "category": "features",
            "severity": "medium",
            "explanation": "More than half of the user's primary requirements lack code evidence.",
            "confidence": 0.80,
            "suggested_correction": "Implement foundational models and services for missing capabilities.",
        })

    # Determine overall risk level
    has_high = any(f["severity"] == "high" for f in findings)
    has_med = any(f["severity"] == "medium" for f in findings)

    if has_high:
        level = "High"
        message = "High risk: Project has significant drift or syntax errors blocking progression."
    elif has_med:
        level = "Medium"
        message = "Medium risk: Project has moderate drift or unfulfilled requirement clauses."
    else:
        level = "Low"
        message = "Low risk: Implementation is on track and stable relative to project goals."

    return {
        "level": level,
        "message": message,
        "findings": findings,
    }
