import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from services.project_classifier import detect_project_categories
from extractor import ProjectExtractor

class TestCategoryDetection(unittest.TestCase):
    def setUp(self):
        self.fixtures_dir = Path(__file__).resolve().parents[1] / "fixtures" / "projects"
        self.config_path = Path(__file__).resolve().parents[2] / "data" / "config.json"
        self.extractor = ProjectExtractor(self.config_path)

    def test_detect_react_frontend(self):
        root = self.fixtures_dir / "react_frontend"
        files = self.extractor.extract_project(root)
        cat_data = detect_project_categories(files, root)
        self.assertIn("Web Application", cat_data["categories"])

    def test_detect_node_backend(self):
        root = self.fixtures_dir / "node_backend"
        files = self.extractor.extract_project(root)
        cat_data = detect_project_categories(files, root)
        self.assertIn("Backend API", cat_data["categories"])

    def test_detect_aligned_python_api(self):
        root = self.fixtures_dir / "aligned_python"
        files = self.extractor.extract_project(root)
        cat_data = detect_project_categories(files, root)
        self.assertIn("Backend API", cat_data["categories"])

if __name__ == "__main__":
    unittest.main()
