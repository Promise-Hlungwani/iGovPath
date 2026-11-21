"""Run the real extraction pipeline over the selected sample adverts and save the results.

Usage (from repo root):  services/ai/.venv/bin/python -I scripts/build_samples.py
Writes data/sample/opportunities.json. Paced to stay under Groq's free-tier limits;
results are cached by the AI service, so re-running doesn't call the model again.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ai"))

import fitz  # noqa: E402

from extract import extract_advert  # noqa: E402
from split_psvc import split_circular  # noqa: E402

PACE_SECONDS = 8


def main() -> None:
    sel = json.loads((ROOT / "data/sample/selection.json").read_text())
    docs = {d["file"]: d for d in sel["documents"]}
    chunks: dict[str, dict] = {}
    for f in {o["file"] for o in sel["opportunities"]}:
        doc = fitz.open(ROOT / "data/sources" / f)
        chunks[f] = {c.chunk_ref: c for c in split_circular([doc[i].get_text() for i in range(doc.page_count)])}

    out = []
    for i, o in enumerate(sel["opportunities"], 1):
        c = chunks[o["file"]][o["ref"]]
        t = time.time()
        r = extract_advert(c.text, is_sample=True, document_date=docs[o["file"]]["date"])
        rec = r.record.model_dump()
        if o.get("type"):
            rec["opportunity_type"] = o["type"]
        out.append({
            "file": o["file"],
            "chunk_ref": o["ref"],
            "page": c.page,
            "dept": o["dept"],
            "why": o["why"],
            "text": c.text,
            "record": rec,
            "flags": [f.model_dump() for f in r.flags],
            "status": r.status,
            "model": r.model,
        })
        errors = sum(1 for f in r.flags if f.level == "error")
        print(f"[{i}/{len(sel['opportunities'])}] {o['ref']} {r.status} errors={errors} "
              f"title={rec.get('post_title')!r} closing={rec.get('closing_date')} ({time.time() - t:.1f}s)", flush=True)
        if time.time() - t > 1:  # real call (not cache): pace
            time.sleep(PACE_SECONDS)
    (ROOT / "data/sample/opportunities.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"wrote {len(out)} records")


if __name__ == "__main__":
    main()
