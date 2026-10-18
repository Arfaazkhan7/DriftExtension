from __future__ import annotations

import ast
import re
from typing import Dict, List, Tuple

from extractor import ExtractedFile

ASSIGNMENT_IN_CONDITION = re.compile(r"\b(if|while)\s*\([^)]*[^=!<>]=[^=].*\)")

def detect_code_diagnostics(files: List[ExtractedFile]) -> Tuple[List[Dict[str, object]], Dict[str, str]]:
    diagnostics: List[Dict[str, object]] = []

    for file in files:
        if file.language == "py":
            try:
                ast.parse(file.content, filename=file.path)
            except SyntaxError as error:
                line_no = error.lineno or 1
                col_no = error.offset or 1
                lines = file.content.splitlines()
                snippet = lines[max(line_no - 1, 0)].strip() if lines and line_no <= len(lines) else ""
                diagnostics.append({
                    "file": file.path,
                    "line": line_no,
                    "column": col_no,
                    "severity": "error",
                    "type": "SyntaxError",
                    "message": f"Python syntax error: {error.msg}",
                    "snippet": snippet,
                    "suggested_fix": build_python_suggestion(error.msg, snippet),
                })

        elif file.language in {"js", "ts", "jsx", "tsx"}:
            for index, line in enumerate(file.content.splitlines(), start=1):
                if ASSIGNMENT_IN_CONDITION.search(line):
                    stripped = line.strip()
                    diagnostics.append({
                        "file": file.path,
                        "line": index,
                        "column": 1,
                        "severity": "warning",
                        "type": "AssignmentInCondition",
                        "message": "Potential assignment '=' inside conditional statement instead of comparison '==='.",
                        "snippet": stripped,
                        "suggested_fix": "Replace single '=' with strict comparison '===' inside condition.",
                    })
                    break  # report one per file to avoid noise

    if diagnostics:
        primary = diagnostics[0]
        primary_error_fix = {
            "issue": str(primary["message"]),
            "fix": str(primary["suggested_fix"]),
            "file": str(primary["file"]),
            "line": str(primary["line"]),
            "bad_code": str(primary["snippet"]),
            "fixed_code": str(primary["suggested_fix"]),
        }
    else:
        primary_error_fix = {
            "issue": "No syntax error detected.",
            "fix": "Code syntax looks clean across scanned files.",
            "file": "",
            "line": "",
            "bad_code": "",
            "fixed_code": "",
        }

    return diagnostics, primary_error_fix

def build_python_suggestion(error_msg: str, snippet: str) -> str:
    msg = error_msg.lower()
    if "expected ':'" in msg:
        return f"{snippet}:"
    if "invalid syntax" in msg and not snippet.endswith(":"):
        return f"Verify syntax and punctuation on line: '{snippet}'"
    if "unexpected indent" in msg or "unindent" in msg:
        return f"Fix indentation alignment for line: '{snippet}'"
    return f"Correct syntax near: '{snippet}'"
