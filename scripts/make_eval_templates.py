"""Create blank labelling templates for the accuracy test set (data/eval/labels/*.json).

Picks 15 posts from PSVC 42 that are NOT in the demo sample, spread across annexures.
A person fills in the correct values by reading `advert_text`; the model never fills them.
Usage: services/ai/.venv/bin/python -I scripts/make_eval_templates.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ai"))
import fitz  # noqa: E402

from split_psvc import split_circular  # noqa: E402

PICK = ["42/01", "42/12", "42/23", "42/36", "42/49", "42/101", "42/130", "42/189", "42/230",
        "42/266", "42/284", "42/300", "42/383", "42/414", "42/447"]

BLANK = {
    "department": None, "post_title": None, "reference_number": None, "closing_date": None, "salary": None,
    "location": None, "minimum_requirements": [], "documents_required": [], "form_required": None,
    "apply_route": {"email": None, "portal_url": None, "postal": None, "hand_delivery": None},
    "contact": {"name": None, "phone": None},
}


def main() -> None:
    doc = fitz.open(ROOT / "data/sources/psvc-42-2026.pdf")
    chunks = {c.chunk_ref: c for c in split_circular([doc[i].get_text() for i in range(doc.page_count)])}
    out_dir = ROOT / "data/eval/labels"
    out_dir.mkdir(parents=True, exist_ok=True)
    for ref in PICK:
        c = chunks[ref]
        path = out_dir / f"{ref.replace('/', '-')}.json"
        if path.exists():
            continue  # never overwrite a person's labels
        path.write_text(json.dumps({
            "source": "psvc-42-2026.pdf", "chunk_ref": ref, "page": c.page,
            "labelled_by": None, "labelled_on": None,
            "instructions": "Fill 'expected' from advert_text only. Use null when the advert does not state it. Dates as YYYY-MM-DD. Copy reference numbers exactly (without '(X2 POSTS)'). Then set labelled_by and labelled_on.",
            "expected": BLANK,
            "advert_text": c.text,
        }, ensure_ascii=False, indent=1))
    print(f"templates in {out_dir}")


if __name__ == "__main__":
    main()
