import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from utils.exclusions import (
    should_ignore_directory,
    should_ignore_file,
    CANONICAL_IGNORE_DIRECTORIES,
    CANONICAL_IGNORE_EXTENSIONS,
)

class TestExclusions(unittest.TestCase):
    def test_canonical_directories(self):
        self.assertTrue(should_ignore_directory(".git"))
        self.assertTrue(should_ignore_directory("node_modules"))
        self.assertTrue(should_ignore_directory("dist"))
        self.assertTrue(should_ignore_directory(".venv"))
        self.assertTrue(should_ignore_directory("__pycache__"))
        self.assertFalse(should_ignore_directory("src"))
        self.assertFalse(should_ignore_directory("lib"))

    def test_canonical_extensions(self):
        self.assertTrue(should_ignore_file(Path("photo.png")))
        self.assertTrue(should_ignore_file(Path("program.exe")))
        self.assertTrue(should_ignore_file(Path("music.mp3")))
        self.assertTrue(should_ignore_file(Path("bundle.js.map")))
        self.assertFalse(should_ignore_file(Path("main.py")))
        self.assertFalse(should_ignore_file(Path("index.ts")))

    def test_secret_files(self):
        self.assertTrue(should_ignore_file(Path(".env")))
        self.assertTrue(should_ignore_file(Path(".env.local")))
        self.assertTrue(should_ignore_file(Path(".env.production")))
        self.assertTrue(should_ignore_file(Path("private.pem")))
        self.assertTrue(should_ignore_file(Path("cert.key")))
        self.assertTrue(should_ignore_file(Path("id_rsa")))
        self.assertTrue(should_ignore_file(Path("id_ed25519")))
        self.assertTrue(should_ignore_file(Path("credentials.json")))
        self.assertTrue(should_ignore_file(Path("secrets.json")))
        self.assertFalse(should_ignore_file(Path("config.json")))

if __name__ == "__main__":
    unittest.main()
