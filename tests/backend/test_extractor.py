import json
import tempfile
import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from extractor import ProjectExtractor, extract_python_semantics


class TestExtractor(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.config_path = self.root / "config.json"
        self.config_path.write_text(json.dumps({
            "ignoreDirectories": [".git", "node_modules"],
            "ignoreExtensions": [".png", ".exe"],
            "maxFileSizeBytes": 1024 * 1024,
        }), encoding="utf-8")
        self.extractor = ProjectExtractor(self.config_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_collect_files_and_boundaries(self):
        (self.root / "app.py").write_text("print('app')", encoding="utf-8")
        (self.root / "secret.key").write_text("PRIVATE KEY", encoding="utf-8")
        (self.root / "image.png").write_text("IMAGE", encoding="utf-8")
        
        git_dir = self.root / ".git"
        git_dir.mkdir()
        (git_dir / "HEAD").write_text("ref", encoding="utf-8")

        files = self.extractor.collect_files(self.root)
        file_names = [f.name for f in files]

        self.assertIn("app.py", file_names)
        self.assertNotIn("secret.key", file_names)
        self.assertNotIn("image.png", file_names)
        self.assertNotIn("HEAD", file_names)

    def test_extract_python_semantics(self):
        py_code = """
import os
from math import sqrt

class Calculator:
    '''A simple math calculator.'''
    def add(self, x, y):
        '''Add two numbers.'''
        result = x + y
        return result
"""
        imports, doc_parts, semantic_names, routes = extract_python_semantics(py_code)

        self.assertIn("os", imports)
        self.assertIn("math", imports)
        self.assertIn("sqrt", imports)
        self.assertIn("calculator", semantic_names)
        self.assertIn("add", semantic_names)
        self.assertIn("result", semantic_names)
        self.assertTrue(any("simple math calculator" in doc for doc in doc_parts))


if __name__ == "__main__":
    unittest.main()
