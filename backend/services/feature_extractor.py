from __future__ import annotations

import ast
import re
from typing import Dict, List, Set, Tuple

from extractor import ExtractedFile
from similarity import split_identifier, tokenize

CLAUSE_DELIMITERS = re.compile(r"[,;.\n•\-–—]|\band\b|\bwith\b|\bincluding\b|\bfeatures\b|\bfeaturing\b", re.IGNORECASE)
LEAD_NOISE = re.compile(
    r"^(build|create|develop|implement|design|make|a|an|the|project|application|system|app|tool|platform|service|to|for|using)\s+",
    re.IGNORECASE,
)

COMMON_REQUIREMENT_CONCEPTS: Dict[str, Set[str]] = {
    "authentication": {"login", "signup", "signin", "logout", "token", "jwt", "password", "session", "credential", "auth"},
    "database": {"model", "schema", "query", "table", "entity", "orm", "repository", "migration", "storage", "sql"},
    "notification": {"notify", "email", "sms", "alert", "push", "message", "webhook"},
    "payment": {"checkout", "stripe", "paypal", "invoice", "billing", "card", "transaction", "charge", "pay"},
    "video": {"webrtc", "stream", "call", "camera", "media", "video", "frame", "videocall"},
    "recording": {"record", "recorder", "capture", "save", "audio", "meeting"},
    "scheduling": {"schedule", "calendar", "event", "booking", "appointment", "time", "date", "slot"},
    "transcription": {"transcribe", "speech", "audio", "whisper", "recognize", "voice", "text"},
}

def extract_goal_requirements(goal: str, description: str) -> List[str]:
    raw_text = f"{goal}\n{description}".strip()
    clauses: List[str] = []

    for chunk in CLAUSE_DELIMITERS.split(raw_text):
        cleaned = LEAD_NOISE.sub("", chunk.strip())
        cleaned = LEAD_NOISE.sub("", cleaned).strip()
        tokens = tokenize(cleaned)
        if len(tokens) >= 1 and len(cleaned) >= 4:
            phrase = " ".join(tokens)
            if phrase not in clauses and len(phrase) >= 3:
                clauses.append(phrase)

    if not clauses:
        tokens = tokenize(goal)
        if len(tokens) >= 2:
            clauses = [" ".join(tokens[:3]), " ".join(tokens[3:6])]
        elif tokens:
            clauses = [" ".join(tokens)]
        else:
            clauses = ["core functionality"]

    return clauses[:8]

def check_is_stub(file: ExtractedFile, symbol_name: str) -> bool:
    if file.language == "py":
        try:
            tree = ast.parse(file.content)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name == symbol_name:
                    body = node.body
                    if not body:
                        return True
                    filtered = body
                    if len(body) >= 1 and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
                        filtered = body[1:]
                    if not filtered:
                        return True
                    if len(filtered) == 1:
                        stmt = filtered[0]
                        if isinstance(stmt, ast.Pass):
                            return True
                        if isinstance(stmt, ast.Expr):
                            if isinstance(stmt.value, ast.Constant) and stmt.value.value is Ellipsis:
                                return True
                        if isinstance(stmt, ast.Raise):
                            if isinstance(stmt.exc, ast.Call) and hasattr(stmt.exc.func, "id") and stmt.exc.func.id == "NotImplementedError":
                                return True
                            if isinstance(stmt.exc, ast.Name) and stmt.exc.id == "NotImplementedError":
                                return True
                        if isinstance(stmt, ast.Return) and (stmt.value is None or (isinstance(stmt.value, ast.Constant) and stmt.value.value in (None, False, True, ""))):
                            return True
                    return False
        except SyntaxError:
            pass

    pattern = re.compile(
        rf"(?:def|function|class)\s+{re.escape(symbol_name)}\b[^{{:]*[:\{{]([\s\S]{{1,350}}?)(?=\n\s*(?:def|function|class|\Z)|\}})",
        re.MULTILINE,
    )
    match = pattern.search(file.content)
    if not match:
        return False
    body_text = match.group(1).strip()
    clean_lines = [l.strip() for l in body_text.splitlines() if l.strip() and not l.strip().startswith(("#", "//", "/*", "*"))]
    if not clean_lines:
        return True
    if len(clean_lines) == 1:
        single = clean_lines[0].rstrip(";")
        if single in {"pass", "...", "return", "return null", "return undefined", "return false", "return true", "{}"}:
            return True
        if single.startswith("throw new Error") or single.startswith("raise NotImplementedError"):
            return True
    return False

def detect_dynamic_features(
    requirements: List[str],
    files: List[ExtractedFile],
) -> Tuple[List[Dict[str, object]], List[Dict[str, object]]]:
    enriched_features: List[Dict[str, object]] = []
    legacy_feature_map: List[Dict[str, object]] = []

    for index, req in enumerate(requirements):
        req_tokens = set(tokenize(req))
        if not req_tokens:
            continue

        expanded_req_tokens = set(req_tokens)
        for t in req_tokens:
            if t in COMMON_REQUIREMENT_CONCEPTS:
                expanded_req_tokens.update(COMMON_REQUIREMENT_CONCEPTS[t])

        feature_name = req.title()
        feature_id = f"feat_{index + 1}_{'_'.join(req.split()[:3]).lower()}"

        evidence_items: List[str] = []
        matching_files: List[str] = []
        matching_lines: List[int] = []
        has_substantive_code = False
        stub_count = 0

        for file in files:
            path_tokens = set(tokenize(file.path))
            file_matched = False

            if expanded_req_tokens & path_tokens:
                file_matched = True
                evidence_items.append(f"file:{file.path}")

            for sym in file.symbols:
                sym_tokens = set(tokenize(sym))
                if len(expanded_req_tokens & sym_tokens) >= 1:
                    file_matched = True
                    is_stub = check_is_stub(file, sym)
                    if is_stub:
                        stub_count += 1
                        evidence_items.append(f"stub:{sym}")
                    else:
                        has_substantive_code = True
                        evidence_items.append(f"symbol:{sym}")

                    for line_no, line in enumerate(file.content.splitlines(), start=1):
                        if sym in line:
                            matching_lines.append(line_no)
                            break

            for kw in file.keywords:
                kw_tokens = set(tokenize(kw))
                if expanded_req_tokens & kw_tokens:
                    file_matched = True
                    evidence_items.append(f"concept:{kw}")

            for imp in file.imports:
                imp_tokens = set(tokenize(imp))
                if expanded_req_tokens & imp_tokens:
                    file_matched = True
                    has_substantive_code = True
                    evidence_items.append(f"import:{imp}")

            for route in file.routes:
                route_tokens = set(tokenize(route))
                if expanded_req_tokens & route_tokens:
                    file_matched = True
                    has_substantive_code = True
                    evidence_items.append(f"route:{route}")

            if file_matched and file.path not in matching_files:
                matching_files.append(file.path)

        unique_evidence = list(dict.fromkeys(evidence_items))

        if has_substantive_code and len(unique_evidence) >= 2 and stub_count == 0:
            status = "implemented"
            confidence = 0.85
            missing_details = "None identified; substantive implementation evidence found."
            next_action = f"Maintain and add unit tests for {feature_name}."
        elif has_substantive_code and len(unique_evidence) >= 2 and stub_count > 0:
            status = "partial"
            confidence = 0.65
            missing_details = f"Partial implementation detected alongside {stub_count} stub function(s)."
            next_action = f"Replace stubs with complete logic for {feature_name}."
        elif (stub_count > 0) or len(unique_evidence) >= 1:
            status = "partial" if (stub_count > 0 or has_substantive_code) else "unverified"
            confidence = 0.50
            missing_details = f"Only stubs or weak keyword matches found ({len(matching_files)} file(s))."
            next_action = f"Implement functional logic for {feature_name} in {matching_files[0] if matching_files else 'source'}."
        else:
            status = "missing"
            confidence = 0.90
            missing_details = f"No classes, functions, routes, or imports detected for '{req}'."
            next_action = f"Create initial module and implementation for {feature_name}."

        enriched_features.append({
            "id": feature_id,
            "name": feature_name,
            "description": f"Requirement: {req}",
            "status": status,
            "evidence": unique_evidence[:5],
            "files": matching_files[:4],
            "lines": matching_lines[:4],
            "confidence": confidence,
            "missing_details": missing_details,
            "next_action": next_action,
        })

        legacy_feature_map.append({
            "feature": feature_name,
            "status": status,
            "evidence": unique_evidence[:4],
        })

    return enriched_features, legacy_feature_map
