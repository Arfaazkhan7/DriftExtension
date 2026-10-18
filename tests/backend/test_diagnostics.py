import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from extractor import ExtractedFile
from services.diagnostics import detect_code_diagnostics


class TestDiagnostics(unittest.TestCase):
    def test_multi_file_syntax_errors(self):
        files = [
            ExtractedFile(
                path="broken_one.py",
                language="py",
                content="def my_func(\n    return 1\n",
                extracted_text="",
                symbols=[],
                comments=[],
                imports=[],
                strings=[],
                keywords=[],
                line_count=3,
                importance=1.0,
            ),
            ExtractedFile(
                path="broken_two.py",
                language="py",
                content="if True\n    print('missing colon')\n",
                extracted_text="",
                symbols=[],
                comments=[],
                imports=[],
                strings=[],
                keywords=[],
                line_count=3,
                importance=1.0,
            ),
            ExtractedFile(
                path="clean_file.py",
                language="py",
                content="def clean_func():\n    return 42\n",
                extracted_text="",
                symbols=["clean_func"],
                comments=[],
                imports=[],
                strings=[],
                keywords=[],
                line_count=3,
                importance=1.0,
            ),
        ]

        diagnostics, primary = detect_code_diagnostics(files)

        self.assertEqual(len(diagnostics), 2, "Both broken files should produce diagnostic errors")
        err_files = [d["file"] for d in diagnostics]
        self.assertIn("broken_one.py", err_files)
        self.assertIn("broken_two.py", err_files)
        self.assertNotIn("clean_file.py", err_files)
        self.assertEqual(primary["file"], "broken_one.py")


if __name__ == "__main__":
    unittest.main()
