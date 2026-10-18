from __future__ import annotations

import ast
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

try:
    from utils.exclusions import (
        CANONICAL_IGNORE_DIRECTORIES,
        CANONICAL_IGNORE_EXTENSIONS,
        MAX_FILE_SIZE_BYTES,
        should_ignore_directory,
        should_ignore_file,
    )
except ImportError:
    from backend.utils.exclusions import (
        CANONICAL_IGNORE_DIRECTORIES,
        CANONICAL_IGNORE_EXTENSIONS,
        MAX_FILE_SIZE_BYTES,
        should_ignore_directory,
        should_ignore_file,
    )

SYMBOL_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]{2,}")
COMMENT_PATTERN = re.compile(r"(//.*?$|#.*?$|/\*.*?\*/)", re.MULTILINE | re.DOTALL)
STRING_PATTERN = re.compile(r"['\"]([A-Za-z][A-Za-z0-9 _-]{3,})['\"]")
CAMEL_CASE_PATTERN = re.compile(r"([a-z0-9])([A-Z])")

JS_IMPORT_PATTERN = re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))""")
JS_FUNC_PATTERN = re.compile(r"""(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(""")
JS_CLASS_PATTERN = re.compile(r"""(?:export\s+)?class\s+([A-Za-z0-9_$]+)""")
JS_ROUTE_PATTERN = re.compile(r"""(?:app|router)\.(?:get|post|put|delete|patch|use)\(\s*['"]([^'"]+)['"]""")


@dataclass
class ExtractedFile:
    path: str
    language: str
    content: str
    extracted_text: str
    symbols: List[str]
    comments: List[str]
    imports: List[str]
    strings: List[str]
    keywords: List[str]
    line_count: int
    importance: float
    capability_level: str = "basic_scanner"
    routes: List[str] = field(default_factory=list)


def split_identifier(text: str) -> List[str]:
    normalized = CAMEL_CASE_PATTERN.sub(r"\1 \2", text.replace("-", " ").replace("_", " ").replace("/", " "))
    return [token.lower() for token in normalized.split() if len(token) >= 2]


def extract_python_semantics(content: str) -> tuple[list[str], list[str], list[str], list[str]]:
    imports: list[str] = []
    doc_parts: list[str] = []
    semantic_names: list[str] = []
    routes: list[str] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return imports, doc_parts, semantic_names, routes

    module_doc = ast.get_docstring(tree)
    if module_doc:
        doc_parts.append(module_doc)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.extend(split_identifier(alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.extend(split_identifier(node.module))
            for alias in node.names:
                imports.extend(split_identifier(alias.name))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            semantic_names.extend(split_identifier(node.name))
            doc = ast.get_docstring(node)
            if doc:
                doc_parts.append(doc)
            # Route decorators (@app.get('/route'), @app.route('/route'))
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call):
                    if hasattr(dec.func, "attr") and dec.func.attr in {"route", "get", "post", "put", "delete"}:
                        for arg in dec.args:
                            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                                routes.append(arg.value)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    semantic_names.extend(split_identifier(target.id))
        elif isinstance(node, ast.Constant) and isinstance(node.value, str) and len(node.value.strip()) > 6:
            doc_parts.append(node.value.strip())

    return imports[:80], doc_parts[:20], semantic_names[:120], routes[:20]


def extract_js_ts_semantics(content: str) -> tuple[list[str], list[str], list[str], list[str]]:
    imports: list[str] = []
    doc_parts: list[str] = []
    semantic_names: list[str] = []
    routes: list[str] = []

    # Imports
    for match in JS_IMPORT_PATTERN.findall(content):
        raw_imp = match[0] or match[1]
        base_mod = raw_imp.split("/")[-1].replace("@", "")
        imports.extend(split_identifier(base_mod))

    # Functions
    for match in JS_FUNC_PATTERN.findall(content):
        fn_name = match[0] or match[1]
        if fn_name:
            semantic_names.extend(split_identifier(fn_name))

    # Classes
    for match in JS_CLASS_PATTERN.findall(content):
        if match:
            semantic_names.extend(split_identifier(match))

    # Express / Node Routes
    for match in JS_ROUTE_PATTERN.findall(content):
        routes.append(match)

    return imports[:80], doc_parts[:20], semantic_names[:120], routes[:20]


class ProjectExtractor:
    def __init__(self, config_path: Path) -> None:
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        self.custom_dirs = set(self.config.get("ignoreDirectories", []))
        self.custom_exts = {ext.lower() for ext in self.config.get("ignoreExtensions", [])}
        self.max_file_size = int(self.config.get("maxFileSizeBytes", MAX_FILE_SIZE_BYTES))

    def collect_files(self, project_root: Path, requested_files: List[str] | None = None) -> List[Path]:
        resolved_root = project_root.resolve()
        files: List[Path] = []

        def include(candidate: Path) -> bool:
            try:
                resolved_cand = candidate.resolve()
                resolved_cand.relative_to(resolved_root)
            except (ValueError, RuntimeError):
                return False

            if should_ignore_file(candidate, self.custom_exts):
                return False

            for part in candidate.parts:
                if should_ignore_directory(part, self.custom_dirs):
                    return False

            if not candidate.is_file():
                return False

            try:
                if candidate.stat().st_size > self.max_file_size:
                    return False
            except OSError:
                return False

            return True

        if requested_files:
            for raw_path in requested_files:
                candidate = Path(raw_path)
                if include(candidate):
                    files.append(candidate)
        else:
            for candidate in resolved_root.rglob("*"):
                if include(candidate):
                    files.append(candidate)

        return sorted(files)

    def extract_project(self, project_root: Path, requested_files: List[str] | None = None) -> List[ExtractedFile]:
        extracted: List[ExtractedFile] = []
        for file_path in self.collect_files(project_root, requested_files):
            try:
                content = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                try:
                    content = file_path.read_text(encoding="latin-1")
                except Exception:
                    continue
            except Exception:
                continue

            ext = file_path.suffix.lower().lstrip(".")
            symbols = SYMBOL_PATTERN.findall(content)
            comments = [match.strip() for match in COMMENT_PATTERN.findall(content)]
            strings = [match.strip() for match in STRING_PATTERN.findall(content)]
            path_keywords = split_identifier(str(file_path.relative_to(project_root)).replace("\\", "/"))
            imports: list[str] = []
            semantic_keywords: list[str] = []
            semantic_docs: list[str] = []
            routes: list[str] = []
            capability_level = "basic_scanner"

            if ext == "py":
                imports, semantic_docs, semantic_keywords, routes = extract_python_semantics(content)
                capability_level = "ast_full"
            elif ext in {"js", "jsx", "ts", "tsx"}:
                imports, semantic_docs, semantic_keywords, routes = extract_js_ts_semantics(content)
                capability_level = "structural_regex"
            elif ext in {"go", "rs", "java", "cs", "dart", "cpp", "c"}:
                capability_level = "structural_regex"

            extracted_text = " ".join(
                path_keywords
                + semantic_keywords
                + imports
                + symbols[:250]
                + comments[:30]
                + strings[:20]
                + semantic_docs[:10]
            )
            importance = 1.0
            lower_name = file_path.name.lower()
            lower_path = str(file_path.relative_to(project_root)).lower()
            if lower_name.startswith(("readme", "app", "main", "index", "run", "server")):
                importance += 0.45
            if any(token in lower_path for token in ("core", "engine", "controller", "service", "model", "api", "route")):
                importance += 0.35
            if file_path.suffix.lower() in {".md", ".py", ".ts", ".js", ".tsx", ".jsx", ".go", ".rs"}:
                importance += 0.1

            extracted.append(
                ExtractedFile(
                    path=str(file_path.relative_to(project_root)).replace("\\", "/"),
                    language=ext or "text",
                    content=content,
                    extracted_text=extracted_text,
                    symbols=symbols[:250],
                    comments=comments[:20],
                    imports=imports,
                    strings=strings[:20],
                    keywords=(path_keywords + semantic_keywords)[:120],
                    line_count=content.count("\n") + 1,
                    importance=importance,
                    capability_level=capability_level,
                    routes=routes,
                )
            )
        return extracted
