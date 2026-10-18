from __future__ import annotations

from typing import Dict, List
from extractor import ExtractedFile

UI_FRAMEWORKS = {
    "react", "vue", "svelte", "angular", "tkinter", "pygame", "pyqt5", "pyqt6",
    "pyside2", "pyside6", "html", "css", "scss", "tailwind", "bootstrap",
    "component", "template", "webview", "view", "render",
}

BACKEND_FRAMEWORKS = {
    "api", "server", "backend", "route", "router", "endpoint", "database",
    "sql", "db", "query", "orm", "model", "express", "fastapi", "flask",
    "django", "spring", "controller", "service", "repository", "schema",
}

LOGIC_KEYWORDS = {
    "core", "engine", "algorithm", "process", "pipeline", "compute",
    "math", "filter", "kalman", "transform", "tracking", "detection",
    "automation", "action", "handler", "manager", "parser", "lexer",
    "pyautogui", "pynput", "ctypes", "win32api", "opencv", "cv2", "mediapipe",
}


def analyze_areas(files: List[ExtractedFile]) -> Dict[str, object]:
    """
    Classify codebase distribution across UI, Backend, and Logic surfaces.
    Accurately avoids misclassifying OS automation or coordinate math as UI.
    """
    ui_weight = 0.0
    backend_weight = 0.0
    logic_weight = 0.0
    top_files = []

    for file in files:
        path_lower = file.path.lower()
        lang = file.language.lower()
        semantic_tokens = set(file.keywords + file.imports + [s.lower() for s in file.symbols[:50]])
        weight = float(max(len(file.symbols), min(file.line_count, 800)))

        f_ui = 0.0
        f_backend = 0.0
        f_logic = 0.0

        # UI evidence
        if lang in {"html", "css", "scss", "jsx", "tsx", "vue", "svelte"}:
            f_ui += 3.0
        f_ui += sum(1.5 for token in UI_FRAMEWORKS if token in semantic_tokens or token in path_lower)

        # Backend evidence
        if any(term in path_lower for term in ("api", "server", "backend", "routes", "controllers", "models", "db")):
            f_backend += 2.5
        f_backend += sum(1.5 for token in BACKEND_FRAMEWORKS if token in semantic_tokens or token in path_lower)

        # Logic evidence
        if any(term in path_lower for term in ("core", "engine", "service", "logic", "utils", "lib", "algo")):
            f_logic += 2.0
        f_logic += sum(1.5 for token in LOGIC_KEYWORDS if token in semantic_tokens or token in path_lower)

        # Disambiguate: automation coordinates (e.g. screen width, cursor position) are Logic
        if any(tok in semantic_tokens for tok in ("pyautogui", "pynput", "ctypes", "win32api", "coordinate", "cursor")):
            # If no real frontend markup or UI framework is present, suppress false UI classification
            if lang not in {"html", "css", "jsx", "tsx", "vue", "svelte"} and not any(fw in semantic_tokens for fw in ("react", "vue", "tkinter", "pygame", "pyqt5")):
                f_logic += f_ui * 0.8
                f_ui *= 0.2

        total_hits = f_ui + f_backend + f_logic
        if total_hits == 0.0:
            if lang in {"html", "css", "jsx", "tsx"}:
                f_ui = 1.0
            elif lang in {"sql"}:
                f_backend = 1.0
            else:
                f_logic = 1.0
            total_hits = 1.0

        p_ui = (f_ui / total_hits) * weight
        p_backend = (f_backend / total_hits) * weight
        p_logic = (f_logic / total_hits) * weight

        ui_weight += p_ui
        backend_weight += p_backend
        logic_weight += p_logic

        # Dominant area for this specific file
        if p_ui >= p_backend and p_ui >= p_logic:
            dominant = "UI"
        elif p_backend >= p_logic:
            dominant = "Backend"
        else:
            dominant = "Logic"

        top_files.append({"path": file.path, "area": dominant, "weight": int(weight)})

    total_all = ui_weight + backend_weight + logic_weight or 1.0
    pct_ui = round((ui_weight / total_all) * 100)
    pct_backend = round((backend_weight / total_all) * 100)
    pct_logic = 100 - (pct_ui + pct_backend)  # Guarantees exactly 100% total

    percentages = {
        "UI": max(0, pct_ui),
        "Backend": max(0, pct_backend),
        "Logic": max(0, pct_logic),
    }

    return {
        "distribution": percentages,
        "top_files": sorted(top_files, key=lambda item: item["weight"], reverse=True)[:5],
    }
