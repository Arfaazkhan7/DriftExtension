from __future__ import annotations

from typing import Dict, List, Tuple


def calculate_drift_classification(
    alignment_score: float,
    feature_coverage: float,
    implementation_strength: float,
    diagnostics_count: int,
    file_count: int,
    config: Dict[str, object],
) -> Tuple[str, float, str, List[str]]:
    """
    Explainable drift evaluation combining five independent signals:
    - alignment_score: 0.0 (total drift) to 1.0 (perfect alignment)
    - drift_score: round(1.0 - alignment_score, 2)
    - classifications: 'Aligned', 'Drifting', 'Danger', 'Insufficient Evidence'

    Returns: (status, drift_score, primary_reason, reasons_list)
    """
    aligned_threshold = float(config.get("alignedThreshold", 0.65))
    drifting_threshold = float(config.get("driftingThreshold", 0.38))

    reasons: List[str] = []
    drift_score = round(max(0.0, min(1.0, 1.0 - alignment_score)), 2)

    # 1. Check for insufficient evidence
    if file_count == 0 or implementation_strength < 0.05:
        primary = "Insufficient implementation evidence found in the workspace."
        return "Insufficient Evidence", 1.0, primary, [primary]

    # 2. Check quality signals
    if diagnostics_count > 0:
        reasons.append(f"Workspace contains {diagnostics_count} syntax error(s) or diagnostics warnings.")

    # 3. Check feature coverage
    if feature_coverage >= 0.70:
        reasons.append(f"Strong requirement coverage ({round(feature_coverage * 100)}% of stated features detected).")
    elif feature_coverage >= 0.40:
        reasons.append(f"Moderate feature coverage ({round(feature_coverage * 100)}% of features evidenced).")
    else:
        reasons.append(f"Low feature coverage: core goal requirements are not yet visible in source files.")

    # 4. Determine status based on clear, transparent thresholds
    if alignment_score >= aligned_threshold and feature_coverage >= 0.50:
        status = "Aligned"
        primary = "Code implementation closely aligns with the project goals."
    elif alignment_score >= drifting_threshold:
        status = "Drifting"
        primary = "The project is partially on track, but several key goal requirements are missing or incomplete."
    else:
        status = "Danger"
        primary = "The code implementation diverges significantly from the stated project goals."

    reasons.insert(0, primary)
    return status, drift_score, primary, reasons
