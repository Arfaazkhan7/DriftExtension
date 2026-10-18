from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Dict, List, Set

from extractor import ExtractedFile

CATEGORY_INDICATORS = {
    "Web Application": {
        "manifest_keys": ["react", "vue", "svelte", "next", "nuxt", "@angular", "vite", "webpack", "tailwindcss"],
        "imports": ["react", "vue", "svelte", "next", "angular", "bootstrap"],
        "extensions": ["tsx", "jsx", "html", "css", "scss", "vue", "svelte"],
        "directories": ["components", "pages", "views", "screens", "public", "assets", "frontend", "client"],
    },
    "Backend API": {
        "manifest_keys": ["express", "fastapi", "flask", "django", "nest", "koa", "hapi", "apollo-server"],
        "imports": ["express", "fastapi", "flask", "django", "tornado", "aiohttp", "starlette", "rest_framework"],
        "extensions": ["py", "ts", "js", "go", "java", "rb"],
        "directories": ["routes", "controllers", "api", "endpoints", "handlers", "middleware", "services", "backend", "server"],
    },
    "Desktop Application": {
        "manifest_keys": ["electron", "tauri", "nwjs", "neutralinojs"],
        "imports": ["electron", "tkinter", "pyqt5", "pyqt6", "pyside2", "pyside6", "wx", "kivy"],
        "extensions": ["py", "ts", "js", "cpp", "cs"],
        "directories": ["electron", "desktop", "main", "renderer"],
    },
    "Mobile Application": {
        "manifest_keys": ["react-native", "expo", "ionic", "capacitor"],
        "imports": ["react-native", "expo", "flutter", "ionic"],
        "extensions": ["dart", "swift", "kt", "tsx", "jsx"],
        "directories": ["android", "ios", "screens", "navigation", "mobile"],
    },
    "AI / Machine Learning": {
        "manifest_keys": ["torch", "tensorflow", "keras", "transformers", "scikit-learn", "langchain", "openai"],
        "imports": ["torch", "tensorflow", "keras", "transformers", "sklearn", "langchain", "openai", "xgboost"],
        "extensions": ["py", "ipynb"],
        "directories": ["models", "training", "train", "dataset", "weights", "checkpoints", "inference"],
    },
    "Computer Vision": {
        "manifest_keys": ["opencv-python", "mediapipe", "pillow", "torchvision", "scikit-image"],
        "imports": ["cv2", "mediapipe", "pil", "imageio", "torchvision", "skimage", "dlib"],
        "extensions": ["py", "cpp"],
        "directories": ["vision", "camera", "detect", "tracking", "frames"],
    },
    "Data Science": {
        "manifest_keys": ["pandas", "numpy", "matplotlib", "seaborn", "scipy", "plotly", "polars", "jupyter"],
        "imports": ["pandas", "numpy", "matplotlib", "seaborn", "scipy", "plotly", "polars"],
        "extensions": ["py", "ipynb", "r"],
        "directories": ["notebooks", "analysis", "data", "reports", "pipelines"],
    },
    "CLI Application": {
        "manifest_keys": ["commander", "yargs", "click", "typer", "clap", "cobra"],
        "imports": ["argparse", "click", "typer", "sys", "commander", "yargs"],
        "extensions": ["py", "ts", "js", "go", "rs", "sh"],
        "directories": ["cmd", "cli", "bin", "commands"],
    },
    "Database-Driven Application": {
        "manifest_keys": ["mongoose", "prisma", "typeorm", "sequelize", "sqlalchemy", "psycopg2", "mysql2", "pg"],
        "imports": ["sqlalchemy", "sqlite3", "psycopg2", "pymongo", "redis", "mongoose", "prisma"],
        "extensions": ["sql", "py", "ts", "js"],
        "directories": ["migrations", "models", "schemas", "entities", "db", "database"],
    },
    "IoT & Embedded Application": {
        "manifest_keys": ["paho-mqtt", "pyserial", "rpi.gpio", "johnny-five"],
        "imports": ["serial", "paho", "rpi", "spidev", "i2c", "socket"],
        "extensions": ["c", "cpp", "ino", "py"],
        "directories": ["hardware", "sensors", "firmware", "device"],
    },
}

def detect_project_categories(files: List[ExtractedFile], project_root: Path) -> Dict[str, object]:
    manifest_deps: Set[str] = set()

    pkg_json = project_root / "package.json"
    if pkg_json.exists():
        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            manifest_deps.update(k.lower() for k in deps.keys())
        except Exception:
            pass

    req_txt = project_root / "requirements.txt"
    if req_txt.exists():
        try:
            for line in req_txt.read_text(encoding="utf-8").splitlines():
                line = line.strip().split("==")[0].split(">=")[0].split("<=")[0].lower()
                if line and not line.startswith("#"):
                    manifest_deps.add(line)
        except Exception:
            pass

    all_imports = {token.lower() for f in files for token in f.imports}
    all_dirs = {part.lower() for f in files for part in Path(f.path).parts[:-1]}
    all_exts = {f.language.lower() for f in files}

    category_scores: Dict[str, float] = {}
    category_evidence: Dict[str, List[str]] = {}

    for category, indicators in CATEGORY_INDICATORS.items():
        score = 0.0
        evidence: List[str] = []

        matched_manifest = [dep for dep in indicators["manifest_keys"] if any(dep in m for m in manifest_deps)]
        if matched_manifest:
            score += 0.40
            evidence.append(f"manifest:{matched_manifest[0]}")

        matched_imports = [imp for imp in indicators["imports"] if any(imp in i for i in all_imports)]
        if matched_imports:
            score += min(0.35, 0.20 + 0.05 * len(matched_imports))
            evidence.append(f"imports:{','.join(matched_imports[:2])}")

        matched_dirs = [d for d in indicators["directories"] if d in all_dirs]
        if matched_dirs:
            score += 0.15
            evidence.append(f"dir:{matched_dirs[0]}")

        matched_exts = [ext for ext in indicators["extensions"] if ext in all_exts]
        if matched_exts:
            score += 0.10

        if score >= 0.25:
            category_scores[category] = score
            category_evidence[category] = evidence

    sorted_categories = sorted(category_scores.items(), key=lambda item: item[1], reverse=True)
    detected = [cat for cat, score in sorted_categories if score >= 0.30]

    dominant = detected[0] if detected else "General Software"

    return {
        "categories": detected or [dominant],
        "dominant_category": dominant,
        "evidence": category_evidence,
    }
