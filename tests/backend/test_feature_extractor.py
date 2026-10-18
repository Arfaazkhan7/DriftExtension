import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from extractor import ExtractedFile
from services.feature_extractor import extract_goal_requirements, detect_dynamic_features, check_is_stub


class TestFeatureExtractor(unittest.TestCase):
    def test_extract_goal_requirements(self):
        goal = "Develop a meeting application with video calling, user authentication, meeting recording, speech transcription, and meeting history."
        desc = "Built with WebRTC, Node backend, and PostgreSQL database."
        requirements = extract_goal_requirements(goal, desc)

        req_text = " ".join(requirements).lower()
        self.assertIn("video", req_text)
        self.assertIn("authentication", req_text)
        self.assertIn("recording", req_text)
        self.assertIn("transcription", req_text)

    def test_stub_detection(self):
        file = ExtractedFile(
            path="service.py",
            language="py",
            content="""
def active_function(x, y):
    total = x + y
    return total * 2

def stub_pass(user_id):
    pass

def stub_not_implemented():
    raise NotImplementedError("Not ready")

def stub_ellipsis():
    ...
""",
            extracted_text="",
            symbols=["active_function", "stub_pass", "stub_not_implemented", "stub_ellipsis"],
            comments=[],
            imports=[],
            strings=[],
            keywords=[],
            line_count=15,
            importance=1.0,
        )

        self.assertFalse(check_is_stub(file, "active_function"))
        self.assertTrue(check_is_stub(file, "stub_pass"))
        self.assertTrue(check_is_stub(file, "stub_not_implemented"))
        self.assertTrue(check_is_stub(file, "stub_ellipsis"))

    def test_dynamic_feature_evidence_matching(self):
        reqs = ["user authentication", "video calling"]
        files = [
            ExtractedFile(
                path="auth.py",
                language="py",
                content="""
def login(username, password):
    token = generate_jwt(username)
    return token
""",
                extracted_text="auth login generate_jwt token",
                symbols=["login", "generate_jwt"],
                comments=[],
                imports=["jwt"],
                strings=[],
                keywords=["auth", "login"],
                line_count=6,
                importance=1.0,
            )
        ]

        enriched, legacy = detect_dynamic_features(reqs, files)
        auth_feature = next(f for f in enriched if "Auth" in f["name"])
        video_feature = next(f for f in enriched if "Video" in f["name"])

        self.assertEqual(auth_feature["status"], "implemented")
        self.assertEqual(video_feature["status"], "missing")


if __name__ == "__main__":
    unittest.main()
