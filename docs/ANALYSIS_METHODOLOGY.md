# Code Drift Analysis Methodology & Engine Specification (v2.0.0)

## 1. Executive Summary

The Live Code Drift Detection engine analyzes source code repositories in real-time to determine whether the implementation adheres to or diverges from the user's declared project goals. 

In version 2.0.0, the engine was fundamentally restructured to eliminate domain-specific biases, remove hardcoded feature catalogs, implement non-destructive morphological token normalization, verify substantive implementation using AST-based stub detection, and calculate explainable, normalized drift scores.

---

## 2. Tokenization and Morphological Normalization

### 2.1 Identifier Normalization
Source code identifiers appear across diverse casing conventions. The tokenizer splits identifiers into semantic constituent words without corrupting acronyms or numbers:
- **`camelCase` / `PascalCase`**: `recordMeeting` -> `["record", "meeting"]`, `ASTParser` -> `["ast", "parser"]`
- **`snake_case`**: `auth_token_generator` -> `["auth", "token", "generator"]`
- **`kebab-case`**: `user-profile-view` -> `["user", "profile", "view"]`

### 2.2 Non-Destructive Technical Stemming
Naive stemmers (such as Porter stemming or truncation heuristics like stripping `ing` or `tion`) frequently mutilate technical terms (e.g. converting `mapping` -> `mapp` or `logging` -> `logg`).

Version 2.0.0 implements safe, non-destructive token normalization:
1. **Protected Technical Vocabulary**: Terms preserved verbatim:
   - `mapping`, `processing`, `tracking`, `logging`, `classification`, `authentication`, `configuration`, `routing`, `pooling`, `binding`, `caching`, `clustering`, `parsing`, `streaming`, `testing`, `debugging`.
2. **Double-Consonant Restoration**: When safe suffix reduction occurs (e.g. `running` -> `run`), duplicated consonants are normalized to their dictionary root (`nn` -> `n`, `pp` -> `p`).
3. **Plural Normalization**: Stripping plural `s`/`es` while preserving words like `status`, `analysis`, `process`, and `bus`.

---

## 3. Project Category Detection

The engine detects project types based on holistic evidence from project manifests, imports, directory structures, and source identifiers. It supports 10 distinct categories, allowing hybrid categorization where appropriate:

| Category | Primary Indicators | Evidence Sources |
|---|---|---|
| **Web Applications** | `react`, `vue`, `angular`, `next`, `svelte`, `html`, `css` | `package.json`, imports, UI templates |
| **Backend APIs** | `fastapi`, `flask`, `express`, `django`, `nest`, `gin`, `controllers`, `routes` | Dependencies, routing directories |
| **Desktop Applications** | `electron`, `tauri`, `pyqt`, `tkinter`, `wxwidgets` | Manifests, windowing imports |
| **Mobile Applications** | `react-native`, `flutter`, `swift`, `kotlin`, `expo` | `pubspec.yaml`, platform dirs (`ios`, `android`) |
| **AI / Machine Learning** | `torch`, `tensorflow`, `sklearn`, `transformers`, `keras`, `datasets` | Dependencies, training scripts |
| **Computer Vision** | `cv2`, `opencv`, `mediapipe`, `torchvision`, `yolo`, `albumentations` | Imports, pipeline scripts |
| **Data Science** | `pandas`, `numpy`, `scipy`, `matplotlib`, `seaborn`, `jupyter` | Notebooks, data processing files |
| **CLI Applications** | `click`, `argparse`, `typer`, `commander`, `yargs`, `cobra` | Entrypoints, command definitions |
| **Database-Driven** | `sqlalchemy`, `prisma`, `mongoose`, `alembic`, `typeorm`, `migrations` | Schema definitions, migration dirs |
| **IoT & Embedded** | `pyserial`, `gpio`, `rpi`, `arduino`, `micropython`, `ble`, `i2c` | Hardware communication libs |

Projects without specific framework signatures default to `Generic Software Application` without penalizing alignment.

---

## 4. Dynamic Feature Extraction & AST Stub Detection

### 4.1 Requirement Derivation
Rather than relying on static catalogs (e.g., the previous hardcoded 9-feature hackathon set), requirements are extracted dynamically from the user's goal statement:
- Explicit clauses (e.g., bulleted lists, comma-delimited phrases, `with X, Y, and Z`).
- Key functional noun-verb phrases extracted using part-of-speech heuristics.
- Deduplication and confidence scoring based on requirement specificity.

### 4.2 AST-Based Implementation Verification
A keyword match alone does **not** signify that a feature is implemented. The engine inspects AST syntax trees (Python) and structural token flows (JavaScript/TypeScript) to distinguish substantive implementations from placeholders:

- **Empty Stubs**: Functions consisting exclusively of:
  - `pass` statements
  - `...` (Ellipsis)
  - `raise NotImplementedError(...)`
  - Empty bodies or trivial `return None` / `return null` / `return`
- **Substantive Implementation**:
  - Contains assignments, conditionals, iterations, API calls, or non-trivial expressions.

Features backed only by empty stubs are classified as **`Partially Implemented`** or **`Missing`** with a low confidence score, accompanied by explicit notifications in the diagnostics findings.

---

## 5. Explainable Multi-Signal Drift Scoring

### 5.1 Scoring Formulation
The overall alignment score $A \in [0.0, 1.0]$ is a weighted combination of five distinct orthogonal signals:

$$A = w_{\text{lex}} S_{\text{lex}} + w_{\text{id}} S_{\text{id}} + w_{\text{imp}} S_{\text{imp}} + w_{\text{feat}} S_{\text{feat}} + w_{\text{struct}} S_{\text{struct}} + w_{\text{comp}} S_{\text{comp}}$$

| Signal | Weight | Description |
|---|---|---|
| **Lexical Similarity ($S_{\text{lex}}$)** | 0.20 | Non-biased TF-IDF cosine similarity between goal and workspace code text. |
| **Identifier Alignment ($S_{\text{id}}$)** | 0.20 | Overlap ratio between requirement terms and extracted function/class names. |
| **Import Domain Alignment ($S_{\text{imp}}$)** | 0.15 | Concordance between imported libraries and declared project category/goals. |
| **Dynamic Feature Coverage ($S_{\text{feat}}$)** | 0.25 | Proportion of derived requirements with verified substantive implementations. |
| **Structural Richness ($S_{\text{struct}}$)** | 0.10 | Depth of project structure, separation of concerns, and module count. |
| **Completion Signals ($S_{\text{comp}}$)** | 0.10 | Ratio of substantive code versus unhandled stubs or empty mocks. |

### 5.2 Drift Score
The drift score $D$ is formally defined as:
$$D = 1.0 - A$$

### 5.3 Classification Thresholds
- **`Aligned`**: $A \ge 0.65$ (or $A \ge 0.50$ with $\ge 70\%$ feature coverage)
- **`Drifting`**: $0.40 \le A < 0.65$
- **`Danger`**: $A < 0.40$
- **`Insufficient Evidence`**: Total non-excluded files $< 1$ or empty codebase.

All classification overrides (including project-name matching) have been completely excised.

---

## 6. Multi-File Syntax Diagnostics Engine

Errors are isolated so that syntax failures in individual files do not terminate analysis for the entire workspace:
1. Files are independently checked using `ast.parse()` (Python) and structural syntax verifiers.
2. Syntax errors capture:
   - File path (relative and absolute)
   - Line and column number
   - Offending source line snippet
   - Error type (`SyntaxError`, `IndentationError`, etc.)
3. The engine continues scanning remaining files, returning partial findings alongside a full list of detected diagnostics.
4. Drift analysis is cleanly partitioned from syntax error reporting.

---

## 7. Supported Languages and Analysis Depth

| Language | Analysis Depth | Capabilities |
|---|---|---|
| **Python** (`.py`) | **Deep AST** | AST parsing, class/function extraction, docstrings, imports, call relationships, empty stub detection, exact syntax diagnostics. |
| **JavaScript / TypeScript** (`.js`, `.jsx`, `.ts`, `.tsx`) | **Structural Extraction** | Regex & token-based export/function/class extraction, ESM/CJS import parsing, basic syntax verification. |
| **HTML / CSS** (`.html`, `.css`, `.scss`) | **Structural Lexical** | Class/ID identification, DOM hierarchy tokenization, style rule extraction. |
| **Java / Dart / Go / Rust / C++** | **Heuristic Lexical** | Manifest & dependency extraction, top-level function/class signatures, token frequency. Explicitly tagged as `shallow` in capability metadata. |

---

## 8. Verification & Empirical Test Results

All 35 automated tests run cleanly across the unified pipeline:
- **Python Backend Unit Tests**: 23 tests in `tests/backend/` (0.115s)
  - `test_tokenizer.py`: Token normalization, camelCase, snake_case, technical stems (`mapping`, `tracking`, etc.).
  - `test_feature_extractor.py`: Requirement extraction, stub detection, empty body detection.
  - `test_classifier.py`: 10-category classification across project fixtures.
  - `test_diagnostics.py`: Multi-file syntax error collection and line tracking.
  - `test_drift_engine.py`: Explainable scoring, normalized bounds, drift metrics.
  - `test_regression.py`: Gesture-control bias elimination tests.
- **TypeScript Extension Tests**: 12 tests in `tests/extension/` (1.49s)
  - `AnalysisQueue`: Coalescing, trailing run execution, runId monotonicity, error recovery.
  - `BackendProcessService`: Temp cleanup, timeout cancellation, malformed JSON handling.
  - `Security & Exclusions`: Canonical folders, file extension filters, secret file blocking, directory boundaries.
