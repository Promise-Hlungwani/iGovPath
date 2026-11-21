"""Copy the accuracy numbers into the website bundle (apps/web/src/generated/accuracy.json).

The deployed website can't read the repo's data/ folder, so the /accuracy page imports
this small file instead. Run after scripts/eval_extraction.py or scripts/build_samples.py.
Usage: services/ai/.venv/bin/python -I scripts/sync_accuracy.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    results_path = ROOT / "data/eval/results.json"
    results = json.loads(results_path.read_text()) if results_path.exists() else None
    samples = json.loads((ROOT / "data/sample/opportunities.json").read_text())
    out = {
        "results": results,
        "sample": {
            "adverts": len(samples),
            "guardrail_errors": sum(1 for s in samples for f in s.get("flags", []) if f.get("level") == "error"),
        },
    }
    dest = ROOT / "apps/web/src/generated/accuracy.json"
    dest.write_text(json.dumps(out, indent=1))
    print(f"wrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
