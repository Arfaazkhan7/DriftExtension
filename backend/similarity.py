from __future__ import annotations

import difflib
import math
import re
from collections import Counter
from typing import Dict, Iterable, List, Set, Tuple

TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9_]+")
CAMEL_CASE_SPLIT = re.compile(r"([a-z0-9])([A-Z])")
ACRONYM_SPLIT = re.compile(r"([A-Z]+)([A-Z][a-z0-9])")

# General English stop words (avoid removing meaningful domain nouns like 'database', 'system', etc.)
STOP_WORDS: Set[str] = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "which", "this", "that", "these", "those", "then", "just", "so", "than",
    "such", "both", "through", "about", "for", "is", "of", "while", "during",
    "to", "from", "in", "out", "on", "off", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "any", "both", "each",
    "few", "more", "most", "other", "some", "no", "nor", "not", "only", "own",
    "same", "too", "very", "can", "will", "just", "should", "now", "into",
    "with", "have", "has", "had", "having", "do", "does", "did", "doing",
    "would", "could", "ought", "i", "you", "he", "she", "it", "we", "they",
}

# General technical abbreviations and synonyms (domain-agnostic)
TECHNICAL_SYNONYMS: Dict[str, str] = {
    "auth": "authentication",
    "authn": "authentication",
    "authz": "authorization",
    "admin": "administrator",
    "app": "application",
    "apps": "application",
    "btn": "button",
    "calc": "calculate",
    "cfg": "configuration",
    "config": "configuration",
    "configs": "configuration",
    "ctrl": "controller",
    "db": "database",
    "dev": "development",
    "doc": "document",
    "docs": "document",
    "err": "error",
    "func": "function",
    "impl": "implementation",
    "info": "information",
    "init": "initialize",
    "lib": "library",
    "msg": "message",
    "param": "parameter",
    "params": "parameter",
    "prod": "production",
    "recv": "receive",
    "repo": "repository",
    "req": "request",
    "res": "response",
    "resp": "response",
    "sec": "security",
    "spec": "specification",
    "specs": "specification",
    "src": "source",
    "svc": "service",
    "sync": "synchronize",
    "util": "utility",
    "utils": "utility",
    "var": "variable",
}

# Protected technical words that must NEVER undergo destructive suffix truncation
PROTECTED_TECHNICAL_WORDS: Set[str] = {
    "mapping", "processing", "tracking", "logging", "classification",
    "authentication", "authorization", "configuration", "caching", "routing",
    "clustering", "parsing", "debugging", "profiling", "benchmarking",
    "indexing", "piping", "queuing", "streaming", "messaging", "pooling",
    "polling", "training", "testing", "monitoring", "rendering", "scaffolding",
    "bundling", "minifying", "middleware", "repository", "controller",
    "service", "analytics", "statistics", "diagnostics", "heuristics",
}


def split_identifier(token: str) -> List[str]:
    """
    Split snake_case, camelCase, PascalCase, and kebab-case tokens into individual words.
    Example: 'userAuthentication_service-v2' -> ['user', 'authentication', 'service', 'v2']
    """
    cleaned = token.replace("-", " ").replace("_", " ").replace(".", " ")
    spaced = CAMEL_CASE_SPLIT.sub(r"\1 \2", cleaned)
    spaced = ACRONYM_SPLIT.sub(r"\1 \2", spaced)
    words = [w.lower() for w in spaced.split() if w.strip()]
    return words


def normalize_token(token: str) -> str:
    """
    Safely normalize a token without destructive truncation.
    Preserves protected technical vocabulary (e.g. mapping, logging, authentication).
    """
    token = token.lower().strip()
    if not token or len(token) < 2:
        return ""

    if token in PROTECTED_TECHNICAL_WORDS:
        return TECHNICAL_SYNONYMS.get(token, token)

    if token in TECHNICAL_SYNONYMS:
        return TECHNICAL_SYNONYMS[token]

    # Handle plurals
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("sses") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us", "is")) and len(token) > 3:
        token = token[:-1]

    # Handle past tense -ed
    if token.endswith("ed") and len(token) > 4:
        if token.endswith("ied"):
            return token[:-3] + "y"
        if token.endswith(("ted", "ded")):
            return token[:-1]  # created -> create
        return token[:-2]

    return TECHNICAL_SYNONYMS.get(token, token)


def tokenize(text: str) -> List[str]:
    """
    Domain-independent tokenization.
    Splits compound identifiers (camelCase, snake_case), normalizes tokens,
    filters stopwords, and preserves valid technical identifiers.
    """
    tokens: List[str] = []
    for raw_match in TOKEN_PATTERN.findall(text):
        for sub_word in split_identifier(raw_match):
            normalized = normalize_token(sub_word)
            if len(normalized) >= 2 and normalized not in STOP_WORDS:
                tokens.append(normalized)
    return tokens


def build_tfidf_vectors(documents: List[str]) -> List[Dict[str, float]]:
    tokenized_docs = [tokenize(doc) for doc in documents]
    doc_count = len(tokenized_docs)
    doc_freq = Counter()

    for tokens in tokenized_docs:
        doc_freq.update(set(tokens))

    vectors: List[Dict[str, float]] = []
    for tokens in tokenized_docs:
        if not tokens:
            vectors.append({})
            continue
        term_freq = Counter(tokens)
        vector: Dict[str, float] = {}
        for token, count in term_freq.items():
            idf = math.log((1 + doc_count) / (1 + doc_freq[token])) + 1.0
            vector[token] = (count / len(tokens)) * idf
        vectors.append(vector)
    return vectors


def cosine_similarity(left: Dict[str, float], right: Dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    intersection = set(left) & set(right)
    if not intersection:
        return 0.0
    numerator = sum(left[token] * right[token] for token in intersection)
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if not left_norm or not right_norm:
        return 0.0
    return min(1.0, max(0.0, numerator / (left_norm * right_norm)))


def weighted_score(scores: List[float], weights: List[float]) -> float:
    if not scores:
        return 0.0
    ranked = sorted(zip(scores, weights), key=lambda item: item[0], reverse=True)
    head = ranked[: max(3, min(8, len(ranked)))]
    numerator = sum(score * weight for score, weight in head)
    denominator = sum(weight for _, weight in head) or 1.0
    return numerator / denominator


def build_fuzzy_matches(goal_tokens: Counter[str], code_tokens: Counter[str]) -> Tuple[List[str], List[str]]:
    code_vocab = list(code_tokens.keys())
    missing_terms: List[str] = []
    matched_terms: List[str] = []

    for token, _ in goal_tokens.most_common(30):
        if code_tokens[token] > 0:
            matched_terms.append(token)
            continue
        close = difflib.get_close_matches(token, code_vocab, n=1, cutoff=0.82)
        if close:
            matched_terms.append(token)
        else:
            missing_terms.append(token)

    return missing_terms[:5], matched_terms


def compare_goal_to_code(
    goal_text: str,
    code_documents: Iterable[str],
    weights: List[float] | None = None,
) -> Tuple[float, List[float], List[str], float]:
    code_documents = list(code_documents)
    weights = weights or [1.0] * len(code_documents)
    documents = [goal_text, *code_documents]
    vectors = build_tfidf_vectors(documents)
    goal_vector = vectors[0]
    file_vectors = vectors[1:]
    per_file_scores = [cosine_similarity(goal_vector, vector) for vector in file_vectors]
    tfidf_score = weighted_score(per_file_scores, weights)

    goal_tokens = Counter(tokenize(goal_text))
    code_tokens = Counter(token for doc in code_documents for token in tokenize(doc))
    missing_terms, matched_terms = build_fuzzy_matches(goal_tokens, code_tokens)
    coverage_score = len(matched_terms) / max(1, len(goal_tokens))
    overall_score = min(1.0, (tfidf_score * 0.60) + (coverage_score * 0.40))
    return overall_score, per_file_scores, missing_terms, coverage_score
