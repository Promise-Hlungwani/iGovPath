"""Measure extraction accuracy against hand-labelled adverts (data/eval/labels/*.json).

Only files with "labelled_by" set are used. Writes data/eval/results.json, shown at /accuracy.
Numbers are reported as they are.
Usage: services/ai/.venv/bin/python -I scripts/eval_extraction.py
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ai"))

from extract import extract_advert  # noqa: E402
from rules import norm  # noqa: E402

SCALARS = ["department", "post_title", "reference_number", "closing_date", "salary", "location", "form_required"]
NESTED = [("apply_route", "email"), ("apply_route", "portal_url"), ("apply_route", "postal"),
          ("apply_route", "hand_delivery"), ("contact", "name"), ("contact", "phone")]
LISTS = ["minimum_requirements", "documents_required"]


def same(a, b) -> bool:
    if a in (None, "") and b in (None, ""):
        return True
    if a in (None, "") or b in (None, ""):
        return False
    na, nb = norm(str(a)), norm(str(b))
    return na == nb or (len(nb) > 6 and (na in nb or nb in na))


def list_recall(expected: list[str], got: list[str]) -> float | None:
    if not expected:
        return None
    joined = norm(" ".join(got))
    hits = 0
    for e in expected:
        words = re.findall(r"[a-z0-9]{4,}", norm(e))
        if words and sum(w in joined for w in words) / len(words) >= 0.7:
            hits += 1
    return hits / len(expected)


def main() -> None:
    files = sorted((ROOT / "data/eval/labels").glob("*.json"))
    labelled = [json.loads(f.read_text()) for f in files]
    labelled = [x for x in labelled if x.get("labelled_by")]
    fields = {f: {"correct": 0, "total": 0} for f in SCALARS + [f"{p}.{k}" for p, k in NESTED]}
    nulls = {"correct": 0, "total": 0}
    recalls: dict[str, list[float]] = {f: [] for f in LISTS}
    evidence_errors = 0
    per_advert = []
    for lab in labelled:
        t = time.time()
        r = extract_advert(lab["advert_text"], is_sample=True, document_date="2026-11-20")
        got = r.record.model_dump()
        exp = lab["expected"]
        evidence_errors += sum(1 for f in r.flags if f.level == "error")
        wrong = []
        for f in SCALARS:
            ok = same(got.get(f), exp.get(f))
            fields[f]["total"] += 1
            fields[f]["correct"] += ok
            if exp.get(f) in (None, ""):
                nulls["total"] += 1
                nulls["correct"] += got.get(f) in (None, "")
            if not ok:
                wrong.append(f)
        for p, k in NESTED:
            e, g = (exp.get(p) or {}).get(k), (got.get(p) or {}).get(k)
            ok = same(g, e)
            fields[f"{p}.{k}"]["total"] += 1
            fields[f"{p}.{k}"]["correct"] += ok
            if e in (None, ""):
                nulls["total"] += 1
                nulls["correct"] += g in (None, "")
            if not ok:
                wrong.append(f"{p}.{k}")
        for f in LISTS:
            rc = list_recall(exp.get(f) or [], got.get(f) or [])
            if rc is not None:
                recalls[f].append(rc)
        per_advert.append({"chunk_ref": lab["chunk_ref"], "wrong_fields": wrong, "status": r.status})
        if time.time() - t > 1:
            time.sleep(6)

    total = sum(v["total"] for v in fields.values())
    correct = sum(v["correct"] for v in fields.values())
    result = {
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": r.model if labelled else None,
        "adverts_labelled": len(labelled),
        "templates_total": len(files),
        "overall_field_accuracy": (correct / total) if total else None,
        "fields": {f: {**v, "accuracy": (v["correct"] / v["total"]) if v["total"] else None} for f, v in fields.items()},
        "nulls_kept_null": {**nulls, "rate": (nulls["correct"] / nulls["total"]) if nulls["total"] else None},
        "list_item_recall": {f: (sum(v) / len(v) if v else None) for f, v in recalls.items()},
        "evidence_check_failures": evidence_errors,
        "per_advert": per_advert,
    }
    (ROOT / "data/eval/results.json").write_text(json.dumps(result, indent=1))
    import subprocess, sys as _sys  # keep the website's copy in step
    subprocess.run([_sys.executable, "-I", str(ROOT / "scripts/sync_accuracy.py")], check=False)
    print(json.dumps({k: result[k] for k in ("adverts_labelled", "overall_field_accuracy", "evidence_check_failures")}))


if __name__ == "__main__":
    main()
