from __future__ import annotations

import re
from pathlib import Path
from typing import Set

MAX_FILE_SIZE_BYTES = 1024 * 1024  # 1MB

CANONICAL_IGNORE_DIRECTORIES: Set[str] = {
    ".git", ".svn", ".hg",
    "node_modules", "bower_components", "vendor",
    "dist", "build", "out", "target", "bin", "obj",
    ".next", ".nuxt", ".turbo", ".cache",
    ".venv", "venv", "env", "__pycache__", ".pytest_cache", ".mypy_cache", ".tox",
    "coverage", ".nyc_output",
    ".idea", ".vs",
}

CANONICAL_IGNORE_EXTENSIONS: Set[str] = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".mp4", ".mp3", ".wav", ".ogg", ".mov", ".avi", ".pdf",
    ".zip", ".tar", ".gz", ".7z", ".rar", ".exe", ".dll", ".so", ".dylib", ".bin",
    ".pyc", ".pyo", ".class",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".map", ".lock",
}

SECRET_FILE_PATTERNS = [
    re.compile(r"^\.env(\..+)?$", re.IGNORECASE),
    re.compile(r"\.(pem|key|cert|crt|p12|pfx|pkcs12)$", re.IGNORECASE),
    re.compile(r"^(id_rsa|id_ed25519|id_ecdsa)$", re.IGNORECASE),
    re.compile(r"^(credentials|secrets|tokens)\.json$", re.IGNORECASE),
]

def should_ignore_file(file_path: Path, custom_extensions: Set[str] | None = None) -> bool:
    name = file_path.name
    ext = file_path.suffix.lower()

    if ext in CANONICAL_IGNORE_EXTENSIONS:
        return True
    if custom_extensions and ext in custom_extensions:
        return True

    for pattern in SECRET_FILE_PATTERNS:
        if pattern.search(name):
            return True

    return False

VENV_NAME_PATTERN = re.compile(
    r"^(.*[._-])?(venv|virtualenv|conda)([0-9._-].*)?$|^(.*[._-])?env([0-9._-].*)?$|^myenv$|^pyenv$|^venv$|^env$|^\.venv$|^\.env$|^site-packages$",
    re.IGNORECASE,
)

def should_ignore_directory(dir_name: str, custom_dirs: Set[str] | None = None) -> bool:
    if dir_name in CANONICAL_IGNORE_DIRECTORIES or VENV_NAME_PATTERN.match(dir_name):
        return True
    if custom_dirs and dir_name in custom_dirs:
        return True
    return False
