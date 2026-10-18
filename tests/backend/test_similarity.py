import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from similarity import (
    tokenize,
    normalize_token,
    split_identifier,
    build_tfidf_vectors,
    cosine_similarity,
    compare_goal_to_code,
)


class TestSimilarity(unittest.TestCase):
    def test_token_normalization_regression_protected_words(self):
        """
        Regression test: Verify that critical technical identifiers are NOT
        destructively truncated (e.g. 'mapping' must not become 'mapp').
        """
        protected_cases = [
            ("mapping", "mapping"),
            ("processing", "processing"),
            ("tracking", "tracking"),
            ("logging", "logging"),
            ("classification", "classification"),
            ("authentication", "authentication"),
            ("configuration", "configuration"),
        ]
        for input_word, expected in protected_cases:
            normalized = normalize_token(input_word)
            self.assertEqual(
                normalized,
                expected,
                f"Expected '{input_word}' to normalize to '{expected}', got '{normalized}'"
            )

    def test_split_identifier_cases(self):
        """
        Verify case splitting for snake_case, camelCase, PascalCase, and kebab-case.
        """
        self.assertEqual(split_identifier("userAuthentication"), ["user", "authentication"])
        self.assertEqual(split_identifier("UserAuthentication"), ["user", "authentication"])
        self.assertEqual(split_identifier("user_authentication"), ["user", "authentication"])
        self.assertEqual(split_identifier("user-authentication-service"), ["user", "authentication", "service"])
        self.assertEqual(split_identifier("parseHTTPRequest"), ["parse", "http", "request"])

    def test_tokenize_pipeline(self):
        text = "Building a userAuthentication and meetingRecording service with JWT tokens"
        tokens = tokenize(text)
        self.assertIn("user", tokens)
        self.assertIn("authentication", tokens)
        self.assertIn("meeting", tokens)
        self.assertIn("recording", tokens)
        self.assertIn("service", tokens)
        self.assertIn("jwt", tokens)

    def test_cosine_similarity_identical(self):
        vec1 = {"code": 0.5, "python": 0.5}
        vec2 = {"code": 0.5, "python": 0.5}
        sim = cosine_similarity(vec1, vec2)
        self.assertAlmostEqual(sim, 1.0, places=2)

    def test_cosine_similarity_disjoint(self):
        vec1 = {"apple": 1.0}
        vec2 = {"banana": 1.0}
        sim = cosine_similarity(vec1, vec2)
        self.assertEqual(sim, 0.0)

    def test_compare_goal_to_code(self):
        goal = "Create a user authentication service with JWT tokens"
        code_docs = [
            "auth.py def login(username, password): pass jwt.encode(payload)",
            "database.py class User(Base): id = Column(Integer)",
        ]
        score, per_file, missing, coverage = compare_goal_to_code(goal, code_docs)
        self.assertGreater(score, 0.0)
        self.assertEqual(len(per_file), 2)


if __name__ == "__main__":
    unittest.main()
