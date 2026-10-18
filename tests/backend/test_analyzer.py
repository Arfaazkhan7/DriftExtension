import json
import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from analyzer import DriftAnalyzer


class TestAnalyzer(unittest.TestCase):
    def setUp(self):
        self.workspace_root = Path(__file__).resolve().parents[2]
        self.fixtures_dir = self.workspace_root / "tests" / "fixtures" / "projects"
        self.config_path = self.workspace_root / "data" / "config.json"

    def test_aligned_project_analysis(self):
        root = self.fixtures_dir / "aligned_python"
        analyzer = DriftAnalyzer(root, self.config_path)
        result = analyzer.analyze(
            goal="Build a meeting management system with user authentication and meeting scheduling",
            description="FastAPI service with notification alerts",
            file_paths=[],
            history=[0.75],
        )

        self.assertEqual(result["schema_version"], "2.0.0")
        self.assertEqual(result["status"], "Aligned")
        self.assertGreaterEqual(result["score"], 0.60)
        self.assertIn("score_breakdown", result)
        self.assertIn("features", result)
        self.assertTrue(len(result["features"]) >= 2)
        self.assertIn("project_categories", result)

    def test_drifting_project_analysis(self):
        root = self.fixtures_dir / "drifting_project"
        analyzer = DriftAnalyzer(root, self.config_path)
        result = analyzer.analyze(
            goal="Build a high-frequency cryptocurrency trading bot and market arbitrage engine",
            description="Automated blockchain trading algorithms",
            file_paths=[],
            history=[0.30],
        )

        # Weather forecast code vs crypto trading bot goal -> Danger or Drifting
        self.assertIn(result["status"], ["Drifting", "Danger"])
        self.assertLess(result["score"], 0.40)
        self.assertGreater(result["drift_score"], 0.60)

    def test_stubs_project_does_not_get_full_credit(self):
        root = self.fixtures_dir / "stubs_project"
        analyzer = DriftAnalyzer(root, self.config_path)
        result = analyzer.analyze(
            goal="Build a payment processing and invoice generation system",
            description="",
            file_paths=[],
            history=[],
        )

        # Stubs should NOT be marked as completed implementations
        for feature in result["features"]:
            self.assertNotEqual(
                feature["status"],
                "implemented",
                f"Feature '{feature['name']}' with empty stubs must not be marked 'implemented'"
            )

    def test_syntax_errors_fixture_captured_in_diagnostics(self):
        root = self.fixtures_dir / "syntax_errors"
        analyzer = DriftAnalyzer(root, self.config_path)
        result = analyzer.analyze(
            goal="General math calculation service",
            description="",
            file_paths=[],
            history=[],
        )

        self.assertIn("diagnostics", result)
        self.assertTrue(len(result["diagnostics"]) >= 2, "Must detect errors across multiple files")
        self.assertIn("SyntaxError", [d["type"] for d in result["diagnostics"]])

    def test_empty_project_reports_insufficient_evidence(self):
        root = self.fixtures_dir / "empty_project"
        analyzer = DriftAnalyzer(root, self.config_path)
        result = analyzer.analyze(
            goal="Build an application",
            description="",
            file_paths=[],
            history=[],
        )

        self.assertEqual(result["status"], "Insufficient Evidence")
        self.assertEqual(result["drift_score"], 1.0)


if __name__ == "__main__":
    unittest.main()
