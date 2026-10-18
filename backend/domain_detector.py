from __future__ import annotations

from typing import Dict, List, Set, Tuple

from extractor import ExtractedFile
from similarity import tokenize

LIBRARY_CONCEPT_MAP: Dict[str, List[str]] = {
    "cv2":              ["vision", "webcam", "camera", "detect", "image", "video",
                         "capture", "frame", "movement", "track", "visual", "pixel", "draw"],
    "mediapipe":        ["recognition", "landmark", "gesture", "hand", "tracking",
                         "detect", "movement", "finger", "skeleton", "pose"],
    "PIL":              ["image", "picture", "pixel", "photo", "visual", "resize", "crop", "draw"],
    "skimage":          ["image", "vision", "visual", "detect", "segment", "filter"],
    "imageio":          ["image", "video", "capture", "read", "write"],
    "dlib":             ["face", "landmark", "detect", "recognition", "tracking"],
    "pyautogui":        ["mouse", "cursor", "click", "control", "keyboard", "desktop",
                         "scroll", "zoom", "screenshot", "automate", "move"],
    "pynput":           ["keyboard", "mouse", "input", "control", "click", "listen"],
    "keyboard":         ["keyboard", "hotkey", "control", "input", "press", "shortcut"],
    "mouse":            ["mouse", "cursor", "click", "control", "drag", "move"],
    "win32api":         ["windows", "desktop", "control", "system", "api"],
    "win32con":         ["windows", "desktop", "control", "system", "constant"],
    "ctypes":           ["system", "api", "native", "control", "window", "dll"],
    "flask":            ["web", "server", "api", "route", "http", "endpoint", "backend", "rest"],
    "django":           ["web", "server", "api", "model", "database", "admin", "orm", "backend"],
    "fastapi":          ["api", "server", "route", "http", "async", "rest", "backend", "openapi"],
    "tornado":          ["async", "web", "server", "http", "websocket"],
    "aiohttp":          ["async", "http", "server", "client", "api"],
    "starlette":        ["async", "web", "api", "http"],
    "sqlite3":          ["database", "storage", "query", "sql", "persist", "table"],
    "sqlalchemy":       ["database", "orm", "model", "query", "persist", "sql"],
    "pymongo":          ["database", "nosql", "storage", "document", "collection"],
    "redis":            ["cache", "storage", "queue", "pubsub", "key"],
    "psycopg2":         ["database", "postgres", "sql", "persist", "query"],
    "motor":            ["database", "async", "mongodb", "storage"],
    "tensorflow":       ["machine_learning", "model", "neural", "train", "predict", "ai", "tensor"],
    "keras":            ["neural", "model", "train", "deep_learning", "ai", "layer"],
    "torch":            ["machine_learning", "neural", "model", "train", "ai", "tensor", "grad"],
    "sklearn":          ["machine_learning", "classify", "cluster", "predict", "train", "fit"],
    "transformers":     ["nlp", "language_model", "ai", "bert", "gpt", "tokenize", "text"],
    "spacy":            ["nlp", "text", "language", "parse", "entity", "token"],
    "nltk":             ["nlp", "text", "language", "token", "corpus", "stem"],
    "tkinter":          ["ui", "window", "widget", "button", "gui", "desktop", "label", "canvas"],
    "pygame":           ["game", "display", "event", "render", "graphics", "sprite", "sound"],
    "PyQt5":            ["ui", "widget", "gui", "window", "desktop", "dialog"],
    "PyQt6":            ["ui", "widget", "gui", "window", "desktop", "dialog"],
    "streamlit":        ["dashboard", "ui", "web", "data", "visualization", "interactive"],
    "gradio":           ["ui", "demo", "model", "interface", "web"],
    "numpy":            ["array", "compute", "matrix", "numerical", "data", "vector", "math"],
    "pandas":           ["data", "table", "analysis", "csv", "dataframe", "filter"],
    "matplotlib":       ["plot", "chart", "graph", "visualize", "display", "figure"],
    "scipy":            ["scientific", "numerical", "statistical", "compute", "optimize"],
    "plotly":           ["interactive", "chart", "plot", "visualize", "dashboard"],
    "requests":         ["http", "api", "web", "network", "client", "download", "fetch"],
    "httpx":            ["http", "async", "client", "api", "fetch"],
    "websockets":       ["realtime", "websocket", "streaming", "live", "push"],
    "socketio":         ["realtime", "websocket", "streaming", "live", "event"],
    "pyaudio":          ["audio", "sound", "microphone", "record", "stream", "voice"],
    "sounddevice":      ["audio", "sound", "record", "playback", "stream"],
    "speech_recognition": ["speech", "voice", "audio", "recognize", "transcribe"],
    "pyttsx3":          ["speech", "text_to_speech", "voice", "audio"],
    "express":          ["server", "api", "route", "http", "middleware", "backend"],
    "react":            ["ui", "component", "web", "frontend", "jsx", "render"],
    "vue":              ["ui", "component", "web", "frontend", "render"],
    "angular":          ["ui", "component", "web", "frontend", "typescript"],
    "mongoose":         ["database", "mongodb", "model", "schema", "query"],
    "sequelize":        ["database", "orm", "model", "sql", "query"],
    "axios":            ["http", "api", "client", "request", "fetch"],
    "next":             ["web", "frontend", "ssr", "react", "routing"],
}

HIGH_CONFIDENCE_LIBS: Set[str] = {
    "cv2", "mediapipe", "tensorflow", "torch", "flask", "django", "fastapi",
    "pygame", "tkinter", "pyautogui", "sklearn", "transformers",
    "pyaudio", "speech_recognition",
}

def _base_name(token: str) -> str:
    return token.split(".")[0].lower().strip()

def get_project_library_concepts(files: List[ExtractedFile]) -> Tuple[Set[str], List[str]]:
    all_bases: Set[str] = set()
    for file in files:
        for tok in file.imports:
            base = _base_name(tok)
            if base:
                all_bases.add(base)

    concepts: Set[str] = set()
    known_libs: List[str] = []

    for base in all_bases:
        if base in LIBRARY_CONCEPT_MAP:
            concepts.update(LIBRARY_CONCEPT_MAP[base])
            known_libs.append(base)
        else:
            for lib_key, lib_concepts in LIBRARY_CONCEPT_MAP.items():
                if base.startswith(lib_key) or lib_key.startswith(base):
                    concepts.update(lib_concepts)
                    known_libs.append(lib_key)
                    break

    return concepts, known_libs

def compute_import_goal_alignment(files: List[ExtractedFile], goal_text: str) -> float:
    goal_tokens = set(tokenize(goal_text))
    if not goal_tokens:
        return 0.0

    project_concepts, known_libs = get_project_library_concepts(files)
    if not project_concepts:
        return 0.0

    matched = 0.0
    for goal_tok in goal_tokens:
        if goal_tok in project_concepts:
            matched += 1.0
            continue
        for concept in project_concepts:
            if len(goal_tok) > 3 and len(concept) > 3:
                if goal_tok in concept or concept in goal_tok:
                    matched += 0.65
                    break

    base_coverage = min(1.0, matched / max(1, len(goal_tokens)))

    hc_bonus = sum(0.10 for lib in known_libs if lib in HIGH_CONFIDENCE_LIBS)
    hc_bonus = min(0.35, hc_bonus)

    return min(1.0, base_coverage + hc_bonus)

def score_identifier_goal_alignment(files: List[ExtractedFile], goal_text: str) -> float:
    goal_tokens = set(tokenize(goal_text))
    if not goal_tokens:
        return 0.0

    id_vocab: Set[str] = set()
    for file in files:
        for kw in file.keywords:
            parts = kw.lower().replace("-", "_").split("_")
            id_vocab.update(p for p in parts if len(p) > 2)
        for sym in file.symbols[:200]:
            parts = sym.lower().replace("-", "_").split("_")
            id_vocab.update(p for p in parts if len(p) > 2)

    matched = 0.0
    for goal_tok in goal_tokens:
        if len(goal_tok) < 3:
            continue
        if goal_tok in id_vocab:
            matched += 1.0
            continue
        for ide in id_vocab:
            if len(ide) > 3 and (goal_tok in ide or ide in goal_tok):
                matched += 0.55
                break

    return min(1.0, matched / max(1, len(goal_tokens)))

def compute_structural_richness(files: List[ExtractedFile]) -> float:
    total_symbols = sum(len(f.symbols) for f in files)
    total_lines = sum(f.line_count for f in files)
    file_count = max(1, len(files))

    symbol_score = min(1.0, total_symbols / 400)
    line_score = min(1.0, total_lines / 600)
    file_score = min(1.0, file_count / 8)

    return (symbol_score * 0.5) + (line_score * 0.35) + (file_score * 0.15)
