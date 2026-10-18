# Live Code Drift Detection AI (v1.0.0)

<p align="center">
  <img src="assets/icon.png" alt="Drift AI Logo" width="96" height="96" />
</p>

**Real-time project direction intelligence and goal alignment for Visual Studio Code.**

---

## 1. Overview

**Live Code Drift Detection AI** continuously evaluates your active workspace code against your original project objective. As you implement features, fix bugs, or add dependencies, the engine computes real-time alignment scores, extracts dynamic requirements, identifies empty stubs, detects multi-file syntax errors, and alerts you when your implementation starts to diverge (*"drift"*) from your stated goals.

In version 1.0.0 (featuring Drift Engine v2.0.0), all hardcoded biases, gesture-control expansions, and destructive stemming rules have been completely removed in favor of domain-independent heuristics, AST verification, and explainable multi-signal scoring.

---

## 2. Key Capabilities

- **🎯 Dynamic Goal Extraction:** Derives functional requirements directly from your goal statement without hardcoded catalogs.
- **🔍 AST Stub Detection:** Uses Python AST inspection to differentiate between substantive logic and empty placeholder stubs (`pass`, `...`, `raise NotImplementedError`, `return null`).
- **⚡ Two-Way Interactive Dashboard:** Real-time Webview dashboard with live controls: **Rescan Workspace**, **Auto-Scan Pause/Resume**, **Edit Goal**, and **Refresh**.
- **📍 Two-Way File Navigation:** Direct click-to-editor jumping for detected features, diagnostics, risk findings, and file reviews.
- **🛡️ Multi-File Syntax Diagnostics:** Isolates Python syntax errors across multiple files with exact line, column, snippet, and suggested fix without aborting workspace analysis.
- **🎨 Native VS Code Theme Alignment:** Seamlessly adapts to Light, Dark, and High-Contrast themes using native VS Code CSS variables, keyboard focus rings, and reduced-motion preferences.
- **🔒 100% Offline & Private:** Zero cloud calls, zero external analytics, zero tracking. All analysis runs locally on your machine.
- **🐍 Pure Standard Library:** The analytical Python engine requires **zero external pip dependencies**.

---

## 3. Supported Languages & Analysis Depth

| Language | Analysis Depth | Mechanism | Extracted Metadata |
|---|---|---|---|
| **Python** (`.py`) | **Deep AST** | Python `ast` stdlib | Full AST traversal, class/function extraction, docstrings, imports, call relationships, empty stub detection, exact syntax diagnostics. |
| **TypeScript / JavaScript** (`.ts`, `.tsx`, `.js`, `.jsx`) | **Structural Extraction** | Lexer / Regex | Functions, arrow functions, classes, ESM/CJS imports, routes (`express`, `fastify`), basic syntax balance warnings. |
| **HTML / CSS** (`.html`, `.css`, `.scss`) | **Structural Lexical** | Tokenizer | Class/ID identification, DOM hierarchy tokenization, style rule extraction. |
| **Java / Dart / Go / Rust / C++** | **Heuristic Lexical** | Scanner | Manifest & dependency extraction, top-level function/class signatures, token frequency. Explicitly tagged as `shallow` in capability metadata. |

---

## 4. Installation & Setup

### Option A: Install via Pre-built VSIX (Recommended for Users)

1. Download the latest `live-code-drift-detection-ai-x.x.x.vsix` package from [GitHub Releases](https://github.com/Arfaazkhan7/DriftExtension/releases).
2. Install via command line:
   ```bash
   code --install-extension live-code-drift-detection-ai-1.0.0.vsix
   ```
   *Or install via VS Code GUI:*
   - Open the Extensions pane (`Ctrl+Shift+X` / `Cmd+Shift+X`).
   - Click the **`...`** (Views and More Actions) menu in the top-right corner.
   - Select **`Install from VSIX...`** and choose the downloaded file.

### Option B: Build and Run from Source (Recommended for Developers)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Arfaazkhan7/DriftExtension.git
   cd DriftExtension
   ```
2. **Install Node dependencies:**
   ```bash
   npm install
   ```
3. **Compile the extension:**
   ```bash
   npm run compile
   ```
4. **Launch Extension Development Host:**
   - Open the repository in VS Code.
   - Press `F5` (or select `Run Extension` from the Run & Debug menu).
   - A new Extension Development Host window will launch with the extension activated.

---

## 5. Prerequisites

- **VS Code:** `^1.85.0` or higher.
- **Python:** Python 3.8+ installed on your system and accessible on PATH (or configured via `driftDetection.pythonPath`).
- **Python Dependencies:** **None!** The engine runs exclusively on Python's built-in standard library (`ast`, `sys`, `json`, `math`, `re`, `os`, `pathlib`, `typing`, `collections`).

---

## 6. How to Use

### 1. Start Drift Analysis
1. Open any project workspace in VS Code.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **`Drift AI: Start Drift Analysis`** (or right-click any folder in the File Explorer and choose **`Start Drift Analysis`**).
3. Enter your primary project goal (e.g. `Build a meeting application with video calling, user authentication, meeting recording, speech transcription, and meeting history`).
4. Optionally enter implementation details (e.g. `React frontend, Node API, PostgreSQL`).
5. The extension performs an initial baseline scan and automatically opens the **Drift AI Engine** dashboard.

### 2. Live Save Detection
Whenever you save an eligible file (`.py`, `.ts`, `.js`, etc.), the extension automatically queues a background re-scan. Rapid saves are debounced (400ms) and coalesced so your system remains responsive.

### 3. Dashboard Controls
- **Rescan Workspace:** Click **`⟳ Rescan Workspace`** in the toolbar to run an immediate fresh analysis.
- **Auto-Scan Toggle:** Click **`⏸ Auto-Scan: Active`** to pause automatic re-analysis on file saves. Manual rescans remain available.
- **Edit Goal:** Click **`✎ Edit Goal`** to update your project goal and architecture details in an accessible modal dialog. Saving automatically triggers a new analysis.
- **Source Code Navigation:** Click any file badge (e.g. `📄 auth.py:15`) in Features, Diagnostics, or Reviews to jump directly to that exact line in the editor.

---

## 7. Explainable Scoring Formulation

The overall alignment score $A \in [0.0, 1.0]$ is computed using 6 orthogonal, evidence-based signals:

$$A = 0.20 \cdot S_{\text{lex}} + 0.20 \cdot S_{\text{id}} + 0.15 \cdot S_{\text{imp}} + 0.25 \cdot S_{\text{feat}} + 0.10 \cdot S_{\text{struct}} + 0.10 \cdot S_{\text{comp}}$$

| Signal | Weight | Description |
|---|---|---|
| **Lexical Similarity ($S_{\text{lex}}$)** | 0.20 | Normalized TF-IDF cosine similarity between stated goal and source text. |
| **Identifier Alignment ($S_{\text{id}}$)** | 0.20 | Overlap ratio between requirement concepts and extracted function/class identifiers. |
| **Import Domain Alignment ($S_{\text{imp}}$)** | 0.15 | Concordance between imported libraries and expected technical domains. |
| **Dynamic Feature Coverage ($S_{\text{feat}}$)** | 0.25 | Proportion of derived requirements with AST-verified implementations. |
| **Structural Richness ($S_{\text{struct}}$)** | 0.10 | Module separation, file count, and symbol density. |
| **Completion Signals ($S_{\text{comp}}$)** | 0.10 | Ratio of substantive code versus unhandled stubs or empty mocks. |

$$\text{Drift Score } D = 1.0 - A$$

### Status Classifications:
- **`Aligned`**: $A \ge 0.65$ (or $A \ge 0.50$ with $\ge 70\%$ feature coverage).
- **`Drifting`**: $0.40 \le A < 0.65$.
- **`Danger`**: $A < 0.40$.
- **`Insufficient Evidence`**: Empty codebase or $< 1$ eligible source file.

---

## 8. Security & Privacy Guarantees

- **No Remote Telemetry:** Source code is never transmitted outside your local machine.
- **Strict File Boundary Validation:** File opening commands validate that target paths resolve within the active project root, rejecting directory traversal (`..`) or symlink escape attempts.
- **Automated Secret Filtering:** Credential files (`.env`, `*.pem`, `*.key`, `id_rsa`, `credentials.json`) are strictly excluded from scans.
- **Sandboxed Execution:** Backend runs via direct binary execution without shell wrapping (`shell: false`), isolating arguments and preventing shell injection attacks.
- **Secure Temporary Files:** Temp payloads use randomized directories with strict `0o600` permissions and cleanup in `finally` blocks.

---

## 9. Configuration Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `driftDetection.pythonPath` | `string` | `"python"` | Python executable path used to run the backend engine. |
| `driftDetection.backendTimeout` | `number` | `15000` | Timeout in milliseconds before a background analysis pass is safely cancelled. |
| `driftDetection.autoAnalyzeOnSave` | `boolean` | `true` | Automatically re-run drift analysis whenever a workspace file is saved. |
| `driftDetection.maxFiles` | `number` | `500` | Maximum number of files processed during a single scan pass. |

## 10. Repository Structure

```
drift-extension/
├── assets/                  # Extension icons and media assets
│   └── icon.png             # Extension logo (128x128 PNG)
├── backend/                 # Pure Python analysis engine (stdlib only)
│   ├── services/            # Diagnostic extraction, feature discovery, classification
│   │   ├── diagnostics.py   # Multi-file syntax error parsing and AST validation
│   │   ├── feature_extractor.py # AST-based requirement and feature mapping
│   │   └── project_classifier.py # Technology stack and domain detection
│   ├── utils/               # File filtering and exclusion heuristics
│   │   └── exclusions.py    # Exclusions rules for build artifacts, caches, and secrets
│   ├── analyzer.py          # Primary analysis orchestrator and multi-signal scoring
│   ├── area_analysis.py     # Functional domain breakdown and progress tracking
│   ├── domain_detector.py   # Keyword and framework inference
│   ├── drift.py             # Score computation and status classification
│   ├── extractor.py         # Source code symbol and AST token extraction
│   ├── main.py              # CLI entry point invoked by VS Code extension
│   ├── risk.py              # Architectural risk and drift heuristics
│   ├── similarity.py        # TF-IDF cosine similarity and identifier alignment
│   └── suggestion.py        # Remediation recommendations
├── data/                    # Extension static configurations
│   └── config.json          # File exclusion lists, limits, and scoring thresholds
├── docs/                    # Deep-dive documentation
│   ├── ANALYSIS_METHODOLOGY.md # Mathematical and heuristic scoring formulation
│   ├── ARCHITECTURE.md      # Process communication and extension architecture
│   └── PROJECT_AUDIT.md     # Engineering audit and refactoring history
├── src/                     # VS Code TypeScript extension host
│   ├── commands/            # Extension command palette registrations
│   ├── providers/           # Webview dashboard panel provider & two-way bridge
│   ├── services/            # Process lifecycle, file collection, and queue management
│   ├── types/               # TypeScript interfaces and messaging contracts
│   ├── utils/               # Path traversal security checks and file exclusions
│   └── extension.ts         # Extension activation lifecycle and event listeners
├── tests/                   # Automated test suites (42 automated tests)
│   ├── backend/             # Python unittest test cases (23 tests)
│   ├── extension/           # TypeScript node:test test cases (19 tests)
│   └── fixtures/            # Sample projects and JSON payloads for test suites
├── webview/                 # Native Webview dashboard interface
│   ├── panel.html           # Accessible HTML5 dashboard layout
│   ├── panel.js             # Two-way event handling, charts, and state rendering
│   └── style.css            # VS Code theme-aware styling and animations
├── .vscode/                 # VS Code development configurations (launch & tasks)
├── package.json             # Extension manifest, contributes, and build scripts
├── package-lock.json        # Deterministic npm dependency lockfile
├── requirements.txt         # Python dependencies manifest (stdlib only)
├── tsconfig.json            # Extension TypeScript compiler configuration
├── tsconfig.test.json       # Test runner TypeScript compiler configuration
├── .gitignore               # Industry-standard Git ignore specifications
├── .vscodeignore            # VSIX packaging ignore rules
└── LICENSE                  # MIT License
```

---

## 11. Development & Testing

```bash
# Install dependencies
npm install

# Compile TypeScript extension
npm run compile

# Run all 42 automated tests (23 Python backend + 19 TypeScript extension)
npm test

# Run Python backend unit tests only
npm run test:backend

# Run Extension TypeScript unit tests only
npm run test:extension

# Package extension into an installable .vsix
npm run package
```

---

## 12. Known Limitations

- **Language AST Depth:** Deep AST traversal, empty stub detection, and exact line/column syntax diagnostics are currently implemented for Python (`.py`). TypeScript, JavaScript, HTML, and CSS are analyzed using structural lexing and regex tokenization. Other languages (Go, Rust, Java, C++) use shallow heuristic analysis.
- **Offline Local Analysis:** All analysis runs locally on your workstation using deterministic algorithms and heuristics. No cloud LLMs or remote APIs are called.
- **Single Workspace Scope:** The extension analyzes the active workspace folder currently open in VS Code. Multi-root workspaces evaluate the primary root folder.

---

## 13. Troubleshooting

- **Python not found error:** Ensure Python 3.8+ is installed on your PATH or configure the absolute path in VS Code settings under `driftDetection.pythonPath` (e.g. `C:\Python312\python.exe` or `/usr/bin/python3`).
- **Dashboard shows "Waiting":** Run `Drift AI: Start Drift Analysis` from the Command Palette to establish an initial project goal baseline.
- **Saves not triggering analysis:** Check the dashboard header to ensure `Auto-Scan: Active` is enabled and verify that `driftDetection.autoAnalyzeOnSave` is set to `true`.

---

## 14. License

MIT License. Copyright (c) 2026 Drift AI Team.

