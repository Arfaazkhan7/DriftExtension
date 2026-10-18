from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from analyzer import DriftAnalyzer

def load_payload(payload_path: Path) -> dict:
    return json.loads(payload_path.read_text(encoding="utf-8"))

def main() -> int:
    parser = argparse.ArgumentParser(description="Live Code Drift Detection AI backend")
    parser.add_argument("--payload", required=True, help="Path to the JSON payload file")
    args = parser.parse_args()

    payload_path = Path(args.payload).resolve()
    payload = load_payload(payload_path)
    project_root = Path(payload["projectRoot"]).resolve()
    config_path = Path(__file__).resolve().parents[1] / "data" / "config.json"

    analyzer = DriftAnalyzer(project_root=project_root, config_path=config_path)
    result = analyzer.analyze(
        goal=payload.get("goal", ""),
        description=payload.get("description", ""),
        file_paths=payload.get("filePaths", []),
        history=payload.get("history", []),
    )

    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    sys.exit(main())
