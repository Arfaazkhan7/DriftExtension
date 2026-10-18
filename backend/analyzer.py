from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Dict, List, Tuple

from area_analysis import analyze_areas
from domain_detector import (
    compute_import_goal_alignment,
    compute_structural_richness,
    get_project_library_concepts,
    score_identifier_goal_alignment,
)
from drift import calculate_drift_classification
from extractor import ExtractedFile, ProjectExtractor
from risk import predict_comprehensive_risk
from services.diagnostics import detect_code_diagnostics
from services.feature_extractor import detect_dynamic_features, extract_goal_requirements
from services.project_classifier import detect_project_categories
from similarity import compare_goal_to_code, tokenize
from suggestion import build_actionable_suggestions


class DriftAnalyzer:
    def __init__(self, project_root: Path, config_path: Path) -> None:
        self.project_root = project_root
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        self.extractor = ProjectExtractor(config_path)

    def analyze(self, goal: str, description: str, file_paths: List[str], history: List[float]) -> Dict[str, object]:
        # 1. Extract workspace files
        files = self.extractor.extract_project(self.project_root, file_paths)
        combined_goal = f"{goal}\n{description}".strip()

        # 2. Dynamic requirements & feature detection
        requirements = extract_goal_requirements(goal, description)
        enriched_features, legacy_feature_map = detect_dynamic_features(requirements, files)

        implemented_count = sum(1 for f in enriched_features if f["status"] == "implemented")
        partial_count = sum(1 for f in enriched_features if f["status"] == "partial")
        feature_coverage = (
            ((implemented_count * 1.0) + (partial_count * 0.5)) / max(1, len(enriched_features))
        ) if enriched_features else 0.0

        # 3. Detect multi-file syntax diagnostics across all files
        diagnostics_list, primary_error_fix = detect_code_diagnostics(files)

        # 4. Detect project categories (Web, API, Mobile, Desktop, Vision, etc.)
        category_data = detect_project_categories(files, self.project_root)
        dominant_category = str(category_data["dominant_category"])

        # 5. Enrich semantic code documents with imported library concepts
        project_concepts, _known_libs = get_project_library_concepts(files)
        concept_str = " ".join(sorted(project_concepts))
        code_documents = [
            f"{file.path} {file.extracted_text} {concept_str}"
            for file in files
        ]
        weights = [file.importance for file in files]

        # 6. Lexical and similarity measurements
        similarity_score, per_file_scores, missing_terms, coverage_score = compare_goal_to_code(
            combined_goal, code_documents, weights
        )

        # 7. Multi-signal domain intelligence
        import_alignment = compute_import_goal_alignment(files, combined_goal)
        identifier_score = score_identifier_goal_alignment(files, combined_goal)
        structural_richness = compute_structural_richness(files)
        areas = analyze_areas(files)
        completion_score, completion_notes = self.estimate_completion(files)

        # 8. Documented, normalized multi-signal alignment calculation
        # Weights: Goal Lexical (0.20) + Identifiers (0.20) + Imports (0.15) + Feature Coverage (0.25) + Structure (0.10) + Completion (0.10)
        raw_alignment = (
            (similarity_score * 0.20)
            + (identifier_score * 0.20)
            + (import_alignment * 0.15)
            + (feature_coverage * 0.25)
            + (structural_richness * 0.10)
            + (completion_score * 0.10)
        )

        # Apply diagnostics adjustment if syntax errors exist
        if diagnostics_list:
            raw_alignment = max(0.10, raw_alignment - (0.05 * min(4, len(diagnostics_list))))

        alignment_score = round(min(1.0, max(0.0, raw_alignment)), 2)

        # 9. Explainable drift classification (no project-specific overrides)
        status, drift_score, primary_reason, reason_list = calculate_drift_classification(
            alignment_score=alignment_score,
            feature_coverage=feature_coverage,
            implementation_strength=structural_richness,
            diagnostics_count=len(diagnostics_list),
            file_count=len(files),
            config=self.config,
        )

        # 10. Risk prediction (separating drift, code quality, and volatility)
        updated_history = (history + [alignment_score])[-20:]
        risk_data = predict_comprehensive_risk(
            status=status,
            alignment_score=alignment_score,
            drift_score=drift_score,
            history=updated_history,
            feature_coverage=feature_coverage,
            diagnostics_count=len(diagnostics_list),
            area_distribution=areas["distribution"],
        )

        # 11. Refine missing terms and generate suggestions
        missing_features = [f["name"] for f in enriched_features if f["status"] == "missing"]
        missing_terms = [t for t in missing_terms if t.lower() not in project_concepts][:5]
        suggestions = build_actionable_suggestions(
            status=status,
            missing_features=missing_features,
            missing_terms=missing_terms,
            diagnostics=diagnostics_list,
            area_distribution=areas["distribution"],
            dominant_category=dominant_category,
        )

        # 12. Synthesize architecture and guidance artifacts
        architecture = self.summarize_architecture(files, areas["distribution"], dominant_category)
        top_matches = self.build_top_matches(files, per_file_scores)
        strengths = self.build_strengths(files, enriched_features, areas["distribution"], completion_notes)
        action_plan = self.build_action_plan(status, missing_features, missing_terms, diagnostics_list, top_matches)
        confidence_score = self.compute_confidence(alignment_score, feature_coverage, structural_richness, files)
        mentor_brief = self.build_mentor_brief(status, confidence_score, dominant_category, enriched_features, completion_notes)
        readiness = self.build_readiness(files, completion_score, enriched_features)
        project_summary = self.build_project_summary(files, architecture, dominant_category, status)
        file_reviews = self.build_file_reviews(files, top_matches)
        why_drift = self.build_why_drift(reason_list, missing_features, missing_terms, top_matches)

        return {
            # Versioned Schema
            "schema_version": "2.0.0",
            "score": alignment_score,  # Primary alignment score (0.0 to 1.0)
            "alignment_score": alignment_score,
            "drift_score": drift_score,
            "status": status,
            "reason": primary_reason,
            "why": why_drift,
            "score_breakdown": {
                "goal_lexical_similarity": round(similarity_score, 2),
                "identifier_alignment": round(identifier_score, 2),
                "library_import_alignment": round(import_alignment, 2),
                "feature_coverage": round(feature_coverage, 2),
                "structural_richness": round(structural_richness, 2),
                "completion_score": round(completion_score, 2),
            },
            "project_categories": category_data["categories"],
            "dominant_category": dominant_category,
            "features": enriched_features,
            "feature_map": legacy_feature_map,  # Backward compatible for panel.js
            "diagnostics": diagnostics_list,
            "error_fix": primary_error_fix,     # Backward compatible for panel.js
            "mentor_brief": mentor_brief,
            "project_summary": project_summary,
            "suggestion": suggestions[0] if suggestions else "",
            "suggestions": suggestions,
            "action_plan": action_plan,
            "risk": risk_data["message"],
            "risk_level": risk_data["level"],
            "risk_findings": risk_data["findings"],
            "area": areas["distribution"],
            "area_details": areas["top_files"],
            "architecture": architecture,
            "strengths": strengths,
            "readiness": readiness,
            "confidence": round(confidence_score, 2),
            "feature_alignment_score": round(feature_coverage, 2),
            "graph": updated_history,
            "top_matches": top_matches,
            "file_reviews": file_reviews,
            "file_count": len(files),
            "missing_terms": missing_terms,
            "completion_score": round(completion_score, 2),
            "coverage_score": round(feature_coverage, 2),
            "completion_notes": completion_notes,
            "capabilities": [
                "dynamic_requirements_extraction",
                "ast_code_intelligence",
                "stub_implementation_detection",
                "multi_file_syntax_diagnostics",
                "domain_category_detection",
                "explainable_drift_scoring",
            ],
        }

    def summarize_architecture(
        self,
        files: List[ExtractedFile],
        distribution: Dict[str, int],
        dominant_category: str,
    ) -> Dict[str, object]:
        languages = Counter(file.language for file in files)
        primary_files = sorted(files, key=lambda file: (file.importance, file.line_count), reverse=True)[:4]

        return {
            "type": f"{dominant_category} ({max(distribution, key=distribution.get)}-heavy)",
            "languages": [f"{lang}:{count}" for lang, count in languages.most_common(4)],
            "primary_files": [file.path for file in primary_files],
            "dominant_area": max(distribution, key=distribution.get),
        }

    def compute_confidence(
        self,
        alignment_score: float,
        feature_coverage: float,
        structural_richness: float,
        files: List[ExtractedFile],
    ) -> float:
        repo_depth = min(1.0, sum(file.line_count for file in files) / 800)
        conf = (alignment_score * 0.35) + (feature_coverage * 0.30) + (structural_richness * 0.20) + (repo_depth * 0.15)
        return min(1.0, max(0.20, conf))

    def build_strengths(
        self,
        files: List[ExtractedFile],
        features: List[Dict[str, object]],
        area_distribution: Dict[str, int],
        completion_notes: List[str],
    ) -> List[str]:
        strengths: List[str] = []
        implemented = [f["name"] for f in features if f["status"] == "implemented"]
        if implemented:
            strengths.append(f"Implemented core requirements: {', '.join(implemented[:3])}.")
        if area_distribution.get("Logic", 0) >= 40:
            strengths.append("Codebase demonstrates solid functional logic and algorithmic structure.")
        if completion_notes:
            strengths.append(completion_notes[0])
        if any(f.line_count >= 150 for f in files):
            strengths.append("Found substantive, structured modules with real functional depth.")
        return strengths[:4]

    def build_action_plan(
        self,
        status: str,
        missing_features: List[str],
        missing_terms: List[str],
        diagnostics: List[Dict[str, object]],
        top_matches: List[Dict[str, object]],
    ) -> List[str]:
        steps: List[str] = []
        if diagnostics:
            steps.append(f"Resolve syntax diagnostics in {diagnostics[0]['file']} (line {diagnostics[0]['line']}).")
        if missing_features:
            steps.append(f"Implement foundational logic for: {', '.join(missing_features[:2])}.")
        if missing_terms:
            steps.append(f"Reflect core goal concepts in source identifiers: {', '.join(missing_terms[:3])}.")
        if top_matches:
            steps.append(f"Extend implementation starting from: {top_matches[0]['path']}.")
        if not steps:
            steps.append("Maintain feature coverage and expand unit test verification.")
        return steps[:4]

    def build_mentor_brief(
        self,
        status: str,
        confidence_score: float,
        category: str,
        features: List[Dict[str, object]],
        completion_notes: List[str],
    ) -> str:
        impl_count = sum(1 for f in features if f["status"] == "implemented")
        total_reqs = len(features)
        note = completion_notes[0] if completion_notes else "Project baseline established."
        return (
            f"Detected {category}. Alignment status is {status} (confidence {round(confidence_score * 100)}%). "
            f"{impl_count}/{total_reqs} requirement clauses show verified implementation evidence. {note}"
        )

    def build_readiness(
        self,
        files: List[ExtractedFile],
        completion_score: float,
        features: List[Dict[str, object]],
    ) -> Dict[str, object]:
        paths = [file.path.lower() for file in files]
        has_manifest = any(p.endswith(("requirements.txt", "package.json", "pyproject.toml", "cargo.toml")) for p in paths)
        has_entrypoint = any(p.endswith(("main.py", "app.py", "index.ts", "index.js", "server.py")) for p in paths)
        impl_count = sum(1 for f in features if f["status"] == "implemented")

        if completion_score >= 0.60 and has_entrypoint:
            level = "High"
            summary = "Workspace has clear entrypoints, manifest configuration, and implemented requirements."
        elif completion_score >= 0.35:
            level = "Medium"
            summary = "Workspace has functional code, but configuration or entrypoints are incomplete."
        else:
            level = "Low"
            summary = "Initial setup phase; foundational architecture and entrypoints are still needed."

        return {
            "level": level,
            "summary": summary,
            "signals": [
                f"manifest_found:{'yes' if has_manifest else 'no'}",
                f"entrypoint_found:{'yes' if has_entrypoint else 'no'}",
                f"verified_features:{impl_count}",
            ],
        }

    def build_project_summary(
        self,
        files: List[ExtractedFile],
        architecture: Dict[str, object],
        category: str,
        status: str,
    ) -> str:
        lead_files = ", ".join(f.path for f in sorted(files, key=lambda i: i.line_count, reverse=True)[:3])
        return f"Architecture: {category} ({len(files)} files). Primary modules: {lead_files}. Status: {status}."

    def build_file_reviews(self, files: List[ExtractedFile], top_matches: List[Dict[str, object]]) -> List[Dict[str, str]]:
        score_map = {item["path"]: item["score"] for item in top_matches}
        reviews: List[Dict[str, str]] = []
        for file in sorted(files, key=lambda item: item.line_count, reverse=True)[:4]:
            reviews.append({
                "path": file.path,
                "summary": f"{file.language.upper()} module ({file.line_count} lines, {len(file.symbols)} symbols).",
                "alignment": f"{round(score_map.get(file.path, 0.0) * 100)}%",
            })
        return reviews

    def build_top_matches(self, files: List[ExtractedFile], per_file_scores: List[float]) -> List[Dict[str, object]]:
        matches = []
        for index, file in enumerate(files):
            score = per_file_scores[index] if index < len(per_file_scores) else 0.0
            matches.append({
                "path": file.path,
                "score": round(score, 2),
            })
        return sorted(matches, key=lambda item: item["score"], reverse=True)[:5]

    def build_why_drift(
        self,
        reason_list: List[str],
        missing_features: List[str],
        missing_terms: List[str],
        top_matches: List[Dict[str, object]],
    ) -> str:
        parts = list(reason_list[:2])
        if missing_features:
            parts.append(f"Unfulfilled requirements: {', '.join(missing_features[:2])}.")
        if missing_terms:
            parts.append(f"Missing domain concepts: {', '.join(missing_terms[:2])}.")
        return " ".join(parts) if parts else "Code implementation aligns with stated requirements."

    def estimate_completion(self, files: List[ExtractedFile]) -> Tuple[float, List[str]]:
        notes: List[str] = []
        score = 0.0
        paths = [file.path.lower() for file in files]

        if any("readme" in p for p in paths):
            score += 0.20
            notes.append("Documentation (README) is present.")
        if any(p.endswith(("requirements.txt", "package.json", "pyproject.toml", "cargo.toml")) for p in paths):
            score += 0.20
            notes.append("Dependency / build manifest is present.")
        entrypoints = set(self.config.get("entrypointFiles", ["main.py", "app.py", "index.ts", "index.js"]))
        if any(p.split("/")[-1] in entrypoints for p in paths):
            score += 0.25
            notes.append("Standard application entrypoints identified.")
        if any("test" in p or "spec" in p for p in paths):
            score += 0.15
            notes.append("Test suites or specifications detected.")
        if sum(file.line_count for file in files) >= 300:
            score += 0.20
            notes.append("Code volume indicates active, substantial implementation.")

        return min(1.0, score), notes[:4]
