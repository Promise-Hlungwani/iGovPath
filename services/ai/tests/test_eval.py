"""The accuracy script's comparison logic (no live calls)."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("eval_extraction", Path(__file__).resolve().parents[3] / "scripts" / "eval_extraction.py")
ev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ev)


def test_same():
    assert ev.same("LDARD 36/11/2026", "ldard  36/11/2026")
    assert ev.same(None, "")
    assert not ev.same(None, "R100")
    assert not ev.same("2026-12-04", "2026-12-05")


def test_list_recall():
    assert ev.list_recall(["Grade 12 certificate"], ["Grade 12 certificate or equivalent"]) == 1.0
    assert ev.list_recall([], ["x"]) is None
