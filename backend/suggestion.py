from __future__ import annotations

from typing import Dict, List

def build_actionable_suggestions(
    status: str,
    missing_features: List[str],
    missing_terms: List[str],
    diagnostics: List[Dict[str, object]],
    area_distribution: Dict[str, int],
    dominant_category: str,
) -> List[str]:
    suggestions: List[str] = []

    if diagnostics:
        err_file = diagnostics[0].get("file", "source")
        err_line = diagnostics[0].get("line", "")
        suggestions.append(f"Fix syntax error in {err_file} (line {err_line}) before adding new logic.")

    if missing_features:
        top_missing = missing_features[:2]
        suggestions.append(f"Implement required capabilities next: {', '.join(top_missing)}.")

    if missing_terms:
        suggestions.append(f"Make these project concepts visible in code identifiers or modules: {', '.join(missing_terms[:3])}.")

    logic_share = area_distribution.get("Logic", 0)
    backend_share = area_distribution.get("Backend", 0)
    ui_share = area_distribution.get("UI", 0)

    if dominant_category == "Backend API" and backend_share < 30:
        suggestions.append("Add endpoint handlers and service layers to establish the API structure.")
    elif dominant_category == "Web Application" and ui_share < 25:
        suggestions.append("Establish UI components and layout views for user interaction.")
    elif logic_share < 20 and ui_share >= 50:
        suggestions.append("Add core computational logic to back the UI surfaces.")

    if not suggestions:
        suggestions.append("Project implementation closely matches stated requirements. Focus on tests and polish.")

    return suggestions[:4]
